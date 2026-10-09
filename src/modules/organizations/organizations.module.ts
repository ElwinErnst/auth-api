import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TenantsModule } from '../tenants/tenants.module';
import { UsersModule } from '../users/users.module';
import { BillingAccount } from './entities/billing-account.entity';
import { OrganizationMembership } from './entities/organization-membership.entity';
import { OrganizationTenant } from './entities/organization-tenant.entity';
import { Organization } from './entities/organization.entity';
import { OrganizationsController } from './organizations.controller';
import { OrganizationsService } from './organizations.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Organization,
      BillingAccount,
      OrganizationMembership,
      OrganizationTenant,
    ]),
    UsersModule,
    TenantsModule,
  ],
  controllers: [OrganizationsController],
  providers: [OrganizationsService],
  exports: [OrganizationsService],
})
export class OrganizationsModule {}
