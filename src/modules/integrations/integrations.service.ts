import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { randomBytes, scrypt as scryptCallback, timingSafeEqual } from 'crypto';
import { promisify } from 'util';
import { BillingMeteringService } from '../../common/modules/billing-metering/billing-metering.service';
import { EntitlementsService } from '../entitlements/entitlements.service';
import { TenantsService } from '../tenants/tenants.service';
import { TokenService } from '../auth/token.service';
import { ClientApp } from './entities/client-app.entity';
import { ServiceAccount } from './entities/service-account.entity';
import { CreateClientAppDto } from './dto/create-client-app.dto';
import { UpdateClientAppDto } from './dto/update-client-app.dto';
import { CreateServiceAccountDto } from './dto/create-service-account.dto';
import { UpdateServiceAccountDto } from './dto/update-service-account.dto';
import { IssueServiceAccountTokenDto } from './dto/issue-service-account-token.dto';

@Injectable()
export class IntegrationsService {
  private readonly scrypt = promisify(scryptCallback);

  constructor(
    @InjectRepository(ClientApp)
    private readonly clientAppsRepository: Repository<ClientApp>,
    @InjectRepository(ServiceAccount)
    private readonly serviceAccountsRepository: Repository<ServiceAccount>,
    private readonly billingMetering: BillingMeteringService,
    private readonly tenantsService: TenantsService,
    private readonly entitlementsService: EntitlementsService,
    private readonly tokenService: TokenService,
  ) {}

  async listClientApps(tenantId: string) {
    await this.assertAuthApiEnabled(tenantId);

    const apps = await this.clientAppsRepository.find({
      where: { tenantId },
      order: { createdAt: 'ASC' },
    });

    return Promise.all(
      apps.map(async (app) => ({
        ...this.toClientApp(app),
        serviceAccounts: await this.listServiceAccounts(tenantId, app.id),
      })),
    );
  }

  async createClientApp(
    tenantId: string,
    dto: CreateClientAppDto,
    createdByUserId?: string | null,
  ) {
    const tenant = await this.assertAuthApiEnabled(tenantId);

    const currentCount = await this.clientAppsRepository.count({
      where: { tenantId },
    });
    const maxClientApps = tenant.maxClientApps ?? 0;

    if (maxClientApps > 0 && currentCount >= maxClientApps) {
      throw new ForbiddenException('Client app limit reached for this tenant');
    }

    const existing = await this.clientAppsRepository.findOne({
      where: { tenantId, slug: dto.slug },
    });

    if (existing) {
      throw new ConflictException(
        'Client app slug already exists in this tenant',
      );
    }

    const app = this.clientAppsRepository.create({
      tenantId,
      name: dto.name,
      slug: dto.slug,
      description: dto.description?.trim() || null,
      createdByUserId: createdByUserId ?? null,
      isActive: true,
    });

    return this.toClientApp(await this.clientAppsRepository.save(app));
  }

  async updateClientApp(
    tenantId: string,
    clientAppId: string,
    dto: UpdateClientAppDto,
  ) {
    await this.assertAuthApiEnabled(tenantId);
    const app = await this.findClientApp(tenantId, clientAppId);

    if (dto.slug && dto.slug !== app.slug) {
      const existing = await this.clientAppsRepository.findOne({
        where: { tenantId, slug: dto.slug },
      });

      if (existing) {
        throw new ConflictException(
          'Client app slug already exists in this tenant',
        );
      }
    }

    Object.assign(app, {
      ...(dto.name == null ? {} : { name: dto.name }),
      ...(dto.slug == null ? {} : { slug: dto.slug }),
      ...(dto.description === undefined
        ? {}
        : { description: dto.description?.trim() || null }),
      ...(dto.isActive == null ? {} : { isActive: dto.isActive }),
    });

    return this.toClientApp(await this.clientAppsRepository.save(app));
  }

  async listServiceAccounts(tenantId: string, clientAppId: string) {
    await this.assertAuthApiEnabled(tenantId);
    await this.findClientApp(tenantId, clientAppId);

    const accounts = await this.serviceAccountsRepository.find({
      where: { tenantId, clientAppId },
      order: { createdAt: 'ASC' },
    });

    return accounts.map((account) => this.toServiceAccount(account));
  }

  async createServiceAccount(
    tenantId: string,
    clientAppId: string,
    dto: CreateServiceAccountDto,
    createdByUserId?: string | null,
  ) {
    const tenant = await this.assertAuthApiEnabled(tenantId);
    await this.findClientApp(tenantId, clientAppId);

    const currentCount = await this.serviceAccountsRepository.count({
      where: { tenantId, clientAppId },
    });
    const maxServiceAccounts = tenant.maxServiceAccounts ?? 0;

    if (maxServiceAccounts > 0 && currentCount >= maxServiceAccounts) {
      throw new ForbiddenException(
        'Service account limit reached for this tenant',
      );
    }

    const plainSecret = this.generateSecret();
    const secretHash = await this.hashSecret(plainSecret);
    const preview = `••••${plainSecret.slice(-6)}`;

    const account = this.serviceAccountsRepository.create({
      tenantId,
      clientAppId,
      name: dto.name,
      description: dto.description?.trim() || null,
      secretHash,
      secretPreview: preview,
      createdByUserId: createdByUserId ?? null,
      isActive: true,
      lastUsedAt: null,
    });

    const saved = await this.serviceAccountsRepository.save(account);

    return {
      serviceAccount: this.toServiceAccount(saved),
      clientSecret: plainSecret,
    };
  }

  async updateServiceAccount(
    tenantId: string,
    serviceAccountId: string,
    dto: UpdateServiceAccountDto,
  ) {
    await this.assertAuthApiEnabled(tenantId);
    const account = await this.findServiceAccount(tenantId, serviceAccountId);

    Object.assign(account, {
      ...(dto.name == null ? {} : { name: dto.name }),
      ...(dto.description === undefined
        ? {}
        : { description: dto.description?.trim() || null }),
      ...(dto.isActive == null ? {} : { isActive: dto.isActive }),
    });

    return this.toServiceAccount(
      await this.serviceAccountsRepository.save(account),
    );
  }

  async rotateServiceAccountSecret(tenantId: string, serviceAccountId: string) {
    await this.assertAuthApiEnabled(tenantId);
    const account = await this.findServiceAccount(tenantId, serviceAccountId);

    const plainSecret = this.generateSecret();
    account.secretHash = await this.hashSecret(plainSecret);
    account.secretPreview = `••••${plainSecret.slice(-6)}`;
    account.lastUsedAt = null;

    const saved = await this.serviceAccountsRepository.save(account);

    return {
      serviceAccount: this.toServiceAccount(saved),
      clientSecret: plainSecret,
    };
  }

  async issueServiceAccountToken(dto: IssueServiceAccountTokenDto) {
    const tenant = dto.tenantId
      ? await this.tenantsService.findById(dto.tenantId)
      : dto.tenantSlug
        ? await this.tenantsService.findBySlug(dto.tenantSlug)
        : null;

    if (!tenant) {
      throw new UnauthorizedException('Invalid service account credentials');
    }

    if (!tenant.isActive) {
      throw new UnauthorizedException('Invalid service account credentials');
    }

    const entitlements = this.entitlementsService.resolveForTenant(tenant);
    if (!entitlements.features.apiAuth) {
      throw new ForbiddenException(
        'Auth API Pack is not enabled for this tenant',
      );
    }

    const clientApp = await this.findClientAppForTokenIssuance(tenant.id, dto.clientAppId);
    if (!clientApp.isActive) {
      throw new UnauthorizedException('Invalid service account credentials');
    }

    const account = await this.findServiceAccountForTokenIssuance(
      tenant.id,
      dto.serviceAccountId,
    );
    this.assertTokenIssuanceAllowed(account);

    if (account.clientAppId !== clientApp.id) {
      await this.registerTokenFailure(account);
      throw new UnauthorizedException('Invalid service account credentials');
    }

    if (!account.isActive) {
      await this.registerTokenFailure(account);
      throw new UnauthorizedException('Invalid service account credentials');
    }

    const secretOk = await this.verifySecret(
      dto.clientSecret,
      account.secretHash,
    );
    if (!secretOk) {
      await this.registerTokenFailure(account);
      throw new UnauthorizedException('Invalid service account credentials');
    }

    await this.clearTokenFailures(account);
    account.lastUsedAt = new Date();
    await this.serviceAccountsRepository.save(account);

    const sessionId = `sa:${account.id}`;
    const accessToken = await this.tokenService.signAccessToken({
      userId: account.id,
      tenantId: tenant.id,
      roles: ['API_CLIENT'],
      sessionId,
      actorType: 'service_account',
      clientAppId: clientApp.id,
      serviceAccountId: account.id,
    });

    await this.billingMetering.recordUsageEvent({
      tenantId: tenant.id,
      addonCode: 'AUTH_API',
      metric: 'service_account_tokens_issued',
      quantity: 1,
      sourceService: 'auth-api',
      actorType: 'service_account',
      clientAppId: clientApp.id,
      serviceAccountId: account.id,
      metadata: {
        tenantSlug: tenant.slug,
        clientAppSlug: clientApp.slug,
      },
    });

    return {
      accessToken,
      accessTokenExpiresIn: this.tokenService.getAccessTokenExpiresInSeconds(),
      tokenType: 'Bearer' as const,
      tenant: {
        id: tenant.id,
        slug: tenant.slug,
        name: tenant.name,
      },
      clientApp: this.toClientApp(clientApp),
      serviceAccount: this.toServiceAccount(account),
    };
  }

  private async assertAuthApiEnabled(tenantId: string) {
    const tenant = await this.tenantsService.findById(tenantId);
    const entitlements = this.entitlementsService.resolveForTenant(tenant);

    if (!entitlements.features.apiAuth) {
      throw new ForbiddenException(
        'Auth API Pack is not enabled for this tenant',
      );
    }

    return tenant;
  }

  private async findClientApp(tenantId: string, clientAppId: string) {
    const app = await this.clientAppsRepository.findOne({
      where: { id: clientAppId, tenantId },
    });

    if (!app) {
      throw new NotFoundException('Client app not found');
    }

    return app;
  }

  private async findServiceAccount(tenantId: string, serviceAccountId: string) {
    const account = await this.serviceAccountsRepository.findOne({
      where: { id: serviceAccountId, tenantId },
    });

    if (!account) {
      throw new NotFoundException('Service account not found');
    }

    return account;
  }

  private async findClientAppForTokenIssuance(tenantId: string, clientAppId: string) {
    try {
      return await this.findClientApp(tenantId, clientAppId);
    } catch {
      throw new UnauthorizedException('Invalid service account credentials');
    }
  }

  private async findServiceAccountForTokenIssuance(
    tenantId: string,
    serviceAccountId: string,
  ) {
    try {
      return await this.findServiceAccount(tenantId, serviceAccountId);
    } catch {
      throw new UnauthorizedException('Invalid service account credentials');
    }
  }

  private assertTokenIssuanceAllowed(account: ServiceAccount): void {
    if (account.authBlockedUntil && account.authBlockedUntil.getTime() > Date.now()) {
      throw new UnauthorizedException('Too many failed attempts');
    }
  }

  private async registerTokenFailure(account: ServiceAccount): Promise<void> {
    const nextCount = (account.failedAuthAttempts ?? 0) + 1;
    account.failedAuthAttempts = nextCount;
    account.authBlockedUntil =
      nextCount >= 5 ? new Date(Date.now() + 5 * 60 * 1000) : null;
    await this.serviceAccountsRepository.save(account);
  }

  private async clearTokenFailures(account: ServiceAccount): Promise<void> {
    if (!account.failedAuthAttempts && !account.authBlockedUntil) {
      return;
    }

    account.failedAuthAttempts = 0;
    account.authBlockedUntil = null;
    await this.serviceAccountsRepository.save(account);
  }

  private generateSecret() {
    return `syt_${randomBytes(24).toString('hex')}`;
  }

  private async hashSecret(secret: string) {
    const salt = randomBytes(16).toString('hex');
    const derivedKey = (await this.scrypt(secret, salt, 64)) as Buffer;
    return `${salt}:${derivedKey.toString('hex')}`;
  }

  private async verifySecret(secret: string, storedHash: string) {
    const [salt, expectedHex] = storedHash.split(':');
    if (!salt || !expectedHex) {
      return false;
    }

    const actual = (await this.scrypt(secret, salt, 64)) as Buffer;
    const expected = Buffer.from(expectedHex, 'hex');

    return (
      actual.length === expected.length && timingSafeEqual(actual, expected)
    );
  }

  private toClientApp(app: ClientApp) {
    return {
      id: app.id,
      tenantId: app.tenantId,
      name: app.name,
      slug: app.slug,
      description: app.description,
      createdByUserId: app.createdByUserId,
      isActive: app.isActive,
      createdAt: app.createdAt,
      updatedAt: app.updatedAt,
    };
  }

  private toServiceAccount(account: ServiceAccount) {
    return {
      id: account.id,
      tenantId: account.tenantId,
      clientAppId: account.clientAppId,
      name: account.name,
      description: account.description,
      secretPreview: account.secretPreview,
      createdByUserId: account.createdByUserId,
      isActive: account.isActive,
      lastUsedAt: account.lastUsedAt,
      createdAt: account.createdAt,
      updatedAt: account.updatedAt,
    };
  }
}
