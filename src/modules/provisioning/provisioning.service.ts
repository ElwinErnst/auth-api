import {
  ConflictException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
  Inject,
} from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { createHash, randomBytes, scrypt as scryptCallback } from 'crypto';
import { promisify } from 'util';
import { DataSource, Repository } from 'typeorm';
import { BillingAccount } from '../organizations/entities/billing-account.entity';
import { OrganizationMembership } from '../organizations/entities/organization-membership.entity';
import { OrganizationTenant } from '../organizations/entities/organization-tenant.entity';
import { Organization } from '../organizations/entities/organization.entity';
import { TenantMembership } from '../memberships/entities/tenant-membership.entity';
import { ClientApp } from '../integrations/entities/client-app.entity';
import { Environment } from '../integrations/entities/environment.entity';
import { ServiceAccount } from '../integrations/entities/service-account.entity';
import { Tenant } from '../tenants/entities/tenant.entity';
import { User } from '../users/entities/user.entity';
import { ProvisionSaaSRequestDto } from './provisioning.dto';
import { ProvisioningOperation } from './provisioning-operation.entity';
import { ProvisioningSecretCipher } from './provisioning-secret-cipher';

const scrypt = promisify(scryptCallback);

type ProvisioningResult = {
  operationId: string;
  status: string;
  currentStep: string;
  lastErrorCode: string | null;
  attemptCount: number;
  resources: {
    organizationId: string | null;
    billingAccountId: string | null;
    tenantId: string | null;
    clientAppId: string | null;
    environmentId: string | null;
    serviceAccountId: string | null;
  };
  clientSecret?: string;
};

@Injectable()
export class ProvisioningService {
  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    @InjectRepository(ProvisioningOperation)
    private readonly operations: Repository<ProvisioningOperation>,
    private readonly secretCipher: ProvisioningSecretCipher,
    @Inject('PROVISIONING_CALLER_ID') private readonly callerId: string,
  ) {}

  async provision(dto: ProvisionSaaSRequestDto): Promise<ProvisioningResult> {
    const requestHash = this.hashRequest(dto);
    const operation = await this.findOrCreateOperation(dto, requestHash);
    if (operation.requestHash !== requestHash) {
      throw new ConflictException(
        'Idempotency key was already used for a different provisioning request',
      );
    }

    let currentStep = 'LOCK_OPERATION';
    let completed: ProvisioningOperation;
    try {
      completed = await this.dataSource.transaction(async (manager) => {
        const operations = manager.getRepository(ProvisioningOperation);
        const row = await operations.findOne({
          where: { callerId: this.callerId, idempotencyKey: dto.idempotencyKey },
          lock: { mode: 'pessimistic_write' },
        });
        if (!row) {
          throw new NotFoundException('Provisioning operation not found');
        }
        if (row.requestHash !== requestHash) {
          throw new ConflictException(
            'Idempotency key was already used for a different provisioning request',
          );
        }
        if (row.status === 'COMPLETED') {
          return row;
        }

        row.status = 'IN_PROGRESS';
        row.currentStep = currentStep = 'VALIDATE_OWNER';
        row.lastErrorCode = null;
        row.attemptCount += 1;

        const users = manager.getRepository(User);
        const owner = await users.findOneBy({ id: dto.ownerUserId });
        if (!owner || !owner.isActive) {
          throw new NotFoundException('Active owner user not found');
        }

        currentStep = row.currentStep = 'CREATE_ORGANIZATION';
        const organizations = manager.getRepository(Organization);
        const organization = await organizations.save(
          organizations.create({
            name: dto.organizationName,
            slug: dto.organizationSlug,
          }),
        );
        row.organizationId = organization.id;

        currentStep = row.currentStep = 'CREATE_BILLING_ACCOUNT';
        const accounts = manager.getRepository(BillingAccount);
        const account = await accounts.save(
          accounts.create({
            organizationId: organization.id,
            name: organization.name,
          }),
        );
        row.billingAccountId = account.id;

        currentStep = row.currentStep = 'CREATE_ORGANIZATION_OWNER';
        await manager.getRepository(OrganizationMembership).save(
          manager.getRepository(OrganizationMembership).create({
            organizationId: organization.id,
            userId: owner.id,
            role: 'OWNER',
            isActive: true,
          }),
        );

        currentStep = row.currentStep = 'CREATE_TENANT';
        const tenants = manager.getRepository(Tenant);
        const tenant = await tenants.save(
          tenants.create({
            name: dto.tenantName,
            slug: dto.tenantSlug,
            planCode: 'FREE',
            ztPoliciesEnabled: false,
            vaultsEnabled: false,
            maxVaults: 0,
            maxUsers: 3,
            monthlyNotaryRequests: 0,
            auditRetentionDays: 30,
            maxClientApps: 0,
            maxServiceAccounts: 0,
            apiAddons: [],
            billingBypass: false,
            isActive: true,
          }),
        );
        row.tenantId = tenant.id;

        currentStep = row.currentStep = 'CREATE_TENANT_OWNER';
        await manager.getRepository(TenantMembership).save(
          manager.getRepository(TenantMembership).create({
            userId: owner.id,
            tenantId: tenant.id,
            role: 'OWNER',
            isActive: true,
          }),
        );

        currentStep = row.currentStep = 'LINK_TENANT';
        await manager.getRepository(OrganizationTenant).save(
          manager.getRepository(OrganizationTenant).create({
            organizationId: organization.id,
            tenantId: tenant.id,
          }),
        );

        currentStep = row.currentStep = 'CREATE_APPLICATION';
        const apps = manager.getRepository(ClientApp);
        const app = await apps.save(
          apps.create({
            tenantId: tenant.id,
            name: dto.applicationName,
            slug: dto.applicationSlug,
            description: dto.applicationDescription?.trim() || null,
            createdByUserId: owner.id,
            isActive: true,
          }),
        );
        row.clientAppId = app.id;

        currentStep = row.currentStep = 'CREATE_PRODUCTION_ENVIRONMENT';
        const environments = manager.getRepository(Environment);
        const environment = await environments.save(
          environments.create({
            tenantId: tenant.id,
            clientAppId: app.id,
            name: 'production',
            slug: `${app.slug.slice(0, 108)}-production`,
            isActive: true,
          }),
        );
        row.environmentId = environment.id;

        currentStep = row.currentStep = 'CREATE_SERVICE_ACCOUNT';
        const clientSecret = `syt_${randomBytes(24).toString('hex')}`;
        const salt = randomBytes(16).toString('hex');
        const secretHash = (await scrypt(clientSecret, salt, 64)) as Buffer;
        const serviceAccounts = manager.getRepository(ServiceAccount);
        const serviceAccount = await serviceAccounts.save(
          serviceAccounts.create({
            tenantId: tenant.id,
            clientAppId: app.id,
            environmentId: environment.id,
            scopes: dto.serviceAccountScopes ?? [],
            name: dto.serviceAccountName,
            description: dto.serviceAccountDescription?.trim() || null,
            secretHash: `${salt}:${secretHash.toString('hex')}`,
            secretPreview: `••••${clientSecret.slice(-6)}`,
            createdByUserId: owner.id,
            isActive: true,
            lastUsedAt: null,
            failedAuthAttempts: 0,
            authBlockedUntil: null,
            rotationIntervalDays: null,
            nextRotationAt: null,
            previousSecretHash: null,
            previousSecretExpiresAt: null,
          }),
        );
        row.serviceAccountId = serviceAccount.id;
        row.encryptedClientSecret = this.secretCipher.encrypt(clientSecret);
        row.status = 'COMPLETED';
        row.currentStep = 'COMPLETED';
        await operations.save(row);
        return row;
      });

    } catch (error) {
      await this.persistFailure(dto.idempotencyKey, currentStep, error);
      if (error instanceof ConflictException || error instanceof NotFoundException) {
        throw error;
      }
      if (this.isUniqueViolation(error)) {
        throw new ConflictException(
          'A provisioning resource already exists with one of the requested identifiers',
        );
      }
      throw new InternalServerErrorException('SaaS provisioning failed');
    }
    return this.toResult(completed, true);
  }

  async getStatus(idempotencyKey: string): Promise<ProvisioningResult> {
    const operation = await this.operations.findOne({
      where: { callerId: this.callerId, idempotencyKey },
    });
    if (!operation) {
      throw new NotFoundException('Provisioning operation not found');
    }
    return this.toResult(operation, false);
  }

  private async findOrCreateOperation(
    dto: ProvisionSaaSRequestDto,
    requestHash: string,
  ): Promise<ProvisioningOperation> {
    const existing = await this.operations.findOne({
      where: { callerId: this.callerId, idempotencyKey: dto.idempotencyKey },
    });
    if (existing) {
      return existing;
    }

    try {
      await this.operations.insert({
        callerId: this.callerId,
        idempotencyKey: dto.idempotencyKey,
        requestHash,
        status: 'PENDING',
        currentStep: 'PENDING',
        lastErrorCode: null,
        attemptCount: 0,
        organizationId: null,
        billingAccountId: null,
        tenantId: null,
        clientAppId: null,
        environmentId: null,
        serviceAccountId: null,
        encryptedClientSecret: null,
      });
    } catch (error) {
      if (!this.isUniqueViolation(error)) {
        throw error;
      }
    }

    const operation = await this.operations.findOne({
      where: { callerId: this.callerId, idempotencyKey: dto.idempotencyKey },
    });
    if (!operation) {
      throw new InternalServerErrorException(
        'Could not persist provisioning operation',
      );
    }
    return operation;
  }

  private async persistFailure(
    idempotencyKey: string,
    currentStep: string,
    error: unknown,
  ): Promise<void> {
    try {
      await this.dataSource.transaction(async (manager) => {
        const operations = manager.getRepository(ProvisioningOperation);
        const operation = await operations.findOne({
          where: { callerId: this.callerId, idempotencyKey },
          lock: { mode: 'pessimistic_write' },
        });
        if (!operation || operation.status === 'COMPLETED') {
          return;
        }
        operation.status = 'FAILED';
        operation.currentStep = currentStep;
        operation.lastErrorCode = this.isUniqueViolation(error)
          ? 'RESOURCE_CONFLICT'
          : 'PROVISIONING_FAILED';
        operation.attemptCount += 1;
        await operations.save(operation);
      });
    } catch {
      // The durable PENDING row remains safe to retry if status persistence is
      // unavailable after the resource transaction rolled back.
    }
  }

  private hashRequest(dto: ProvisionSaaSRequestDto): string {
    const normalized = {
      ownerUserId: dto.ownerUserId,
      organizationName: dto.organizationName,
      organizationSlug: dto.organizationSlug,
      tenantName: dto.tenantName,
      tenantSlug: dto.tenantSlug,
      applicationName: dto.applicationName,
      applicationSlug: dto.applicationSlug,
      applicationDescription: dto.applicationDescription?.trim() ?? null,
      serviceAccountName: dto.serviceAccountName,
      serviceAccountDescription: dto.serviceAccountDescription?.trim() ?? null,
      serviceAccountScopes: [...(dto.serviceAccountScopes ?? [])].sort(),
    };
    return createHash('sha256').update(JSON.stringify(normalized)).digest('hex');
  }

  private toResult(
    operation: ProvisioningOperation,
    includeCredential: boolean,
  ): ProvisioningResult {
    const result: ProvisioningResult = {
      operationId: operation.id,
      status: operation.status,
      currentStep: operation.currentStep,
      lastErrorCode: operation.lastErrorCode,
      attemptCount: operation.attemptCount,
      resources: {
        organizationId: operation.organizationId,
        billingAccountId: operation.billingAccountId,
        tenantId: operation.tenantId,
        clientAppId: operation.clientAppId,
        environmentId: operation.environmentId,
        serviceAccountId: operation.serviceAccountId,
      },
    };
    if (includeCredential && operation.status === 'COMPLETED') {
      if (!operation.encryptedClientSecret) {
        throw new InternalServerErrorException(
          'Provisioned credential is unavailable for replay',
        );
      }
      result.clientSecret = this.secretCipher.decrypt(
        operation.encryptedClientSecret,
      );
    }
    return result;
  }

  private isUniqueViolation(error: unknown): boolean {
    return (
      typeof error === 'object' &&
      error !== null &&
      'driverError' in error &&
      typeof error.driverError === 'object' &&
      error.driverError !== null &&
      'code' in error.driverError &&
      error.driverError.code === '23505'
    );
  }
}
