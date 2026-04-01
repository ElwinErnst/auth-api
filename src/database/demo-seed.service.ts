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
    const tenantSlug = 'sentinel-labs';
    const demoTenantDefaults = {
      name: 'Sentinel Labs',
      slug: tenantSlug,
      planCode: 'BUSINESS',
      ztPoliciesEnabled: true,
      vaultsEnabled: true,
      maxVaults: 10,
      isActive: true,
    } as const;

    let tenant = await this.tenantsRepository.findOne({
      where: { slug: tenantSlug },
    });

    if (!tenant) {
      tenant = this.tenantsRepository.create({
        id: this.demoTenantId,
        ...demoTenantDefaults,
      });
      tenant = await this.tenantsRepository.save(tenant);
      this.logger.log(`Tenant created: ${tenant.slug}`);
    } else {
      const needsTenantUpdate =
        tenant.name !== demoTenantDefaults.name ||
        tenant.planCode !== demoTenantDefaults.planCode ||
        tenant.ztPoliciesEnabled !== demoTenantDefaults.ztPoliciesEnabled ||
        tenant.vaultsEnabled !== demoTenantDefaults.vaultsEnabled ||
        tenant.maxVaults !== demoTenantDefaults.maxVaults ||
        tenant.isActive !== demoTenantDefaults.isActive;

      if (needsTenantUpdate) {
        Object.assign(tenant, demoTenantDefaults);
        tenant = await this.tenantsRepository.save(tenant);
        this.logger.log(`Tenant updated: ${tenant.slug}`);
      }
    }

    const demoUsers = [
      {
        id: this.demoUserId,
        email: 'admin@test.com',
        firstName: 'Admin',
        lastName: 'Demo',
        role: 'OWNER' as const,
      },
      {
        id: 'f30f6213-4a8f-422a-87d9-34f0ee220001',
        email: 'manager@test.com',
        firstName: 'Manager',
        lastName: 'Demo',
        role: 'ADMIN' as const,
      },
      {
        id: 'f30f6213-4a8f-422a-87d9-34f0ee220002',
        email: 'member@test.com',
        firstName: 'Member',
        lastName: 'Demo',
        role: 'MEMBER' as const,
      },
    ];

    for (const demoUser of demoUsers) {
      let user = await this.usersRepository.findOne({
        where: { email: demoUser.email },
      });

      if (!user) {
        const passwordHash = await bcrypt.hash('123456', 12);

        user = this.usersRepository.create({
          id: demoUser.id,
          email: demoUser.email,
          passwordHash,
          firstName: demoUser.firstName,
          lastName: demoUser.lastName,
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
          role: demoUser.role,
          isActive: true,
        });

        await this.membershipsRepository.save(newMembership);
        this.logger.log(
          `Membership created: ${user.email} -> ${tenant.slug} (${demoUser.role})`,
        );
      } else if (membership.role !== demoUser.role || !membership.isActive) {
        membership.role = demoUser.role;
        membership.isActive = true;
        await this.membershipsRepository.save(membership);
        this.logger.log(
          `Membership updated: ${user.email} -> ${tenant.slug} (${demoUser.role})`,
        );
      }
    }

    this.logger.log('Demo seed completed');
  }
}
