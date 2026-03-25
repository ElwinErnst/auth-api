import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { UsersService } from '../modules/users/users.service';
import { TenantsService } from '../modules/tenants/tenants.service';
import { MembershipsService } from '../modules/memberships/memberships.service';

@Injectable()
export class DemoSeedService implements OnApplicationBootstrap {
  private readonly logger = new Logger(DemoSeedService.name);

  constructor(
    private readonly configService: ConfigService,
    private readonly usersService: UsersService,
    private readonly tenantsService: TenantsService,
    private readonly membershipsService: MembershipsService,
  ) {}

  async onApplicationBootstrap(): Promise<void> {
    const enabled =
      this.configService.get<boolean>('auth.bootstrapDemoData') ?? false;

    if (!enabled) {
      return;
    }

    const tenant = await this.tenantsService.findOrCreateBySlug({
      name: 'Sentinel Labs',
      slug: 'sentinel-labs',
      planCode: 'PRO',
      ztPoliciesEnabled: true,
      vaultsEnabled: true,
      maxVaults: 3,
    });

    const user = await this.usersService.findOrCreateDemoUser({
      email: 'admin@test.com',
      password: '123456',
      firstName: 'Admin',
      lastName: 'Demo',
    });

    await this.membershipsService.findOrCreate({
      userId: user.id,
      tenantId: tenant.id,
      role: 'OWNER',
    });

    this.logger.log(
      'Demo seed ready: admin@test.com / 123456 / tenant sentinel-labs',
    );
  }
}
