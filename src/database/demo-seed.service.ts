import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';

import { User } from '../modules/users/entities/user.entity';
import { Tenant } from '../modules/tenants/entities/tenant.entity';
import { TenantMembership } from '../modules/memberships/entities/tenant-membership.entity';

@Injectable()
export class DemoSeedService implements OnModuleInit {
  private readonly logger = new Logger(DemoSeedService.name);
  private readonly demoUserId = '925df4a7-ab30-4619-b2d5-7de62af7af6c';
  private readonly demoTenantId = 'f4acaa72-d090-4cfb-9430-4f8585f58d86';

  constructor(
    @InjectRepository(User)
    private readonly usersRepository: Repository<User>,
    @InjectRepository(Tenant)
    private readonly tenantsRepository: Repository<Tenant>,
    @InjectRepository(TenantMembership)
    private readonly membershipsRepository: Repository<TenantMembership>,
  ) {}

  async onModuleInit(): Promise<void> {
    await this.seed();
  }

  private async seed(): Promise<void> {
    const email = 'admin@test.com';
    const tenantSlug = 'sentinel-labs';

    let tenant = await this.tenantsRepository.findOne({
      where: { slug: tenantSlug },
    });

    if (!tenant) {
      tenant = this.tenantsRepository.create({
        id: this.demoTenantId,
        name: 'Sentinel Labs',
        slug: tenantSlug,
        isActive: true,
      });
      tenant = await this.tenantsRepository.save(tenant);
      this.logger.log(`Tenant created: ${tenant.slug}`);
    }

    let user = await this.usersRepository.findOne({
      where: { email },
    });

    if (!user) {
      const passwordHash = await bcrypt.hash('123456', 12);

      user = this.usersRepository.create({
        id: this.demoUserId,
        email,
        passwordHash,
        firstName: 'Admin',
        lastName: 'Demo',
        isActive: true,
      });
      user = await this.usersRepository.save(user);
      this.logger.log(`User created: ${user.email}`);
    }

    const membership = await this.membershipsRepository.findOne({
      where: {
        userId: user.id,
        tenantId: tenant.id,
      },
    });

    if (!membership) {
      const newMembership = this.membershipsRepository.create({
        userId: user.id,
        tenantId: tenant.id,
        role: 'OWNER',
        isActive: true,
      });

      await this.membershipsRepository.save(newMembership);
      this.logger.log(`Membership created: ${user.email} -> ${tenant.slug}`);
    }

    this.logger.log('Demo seed completed');
  }
}
