import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TenantPolicyVersion } from './entities/tenant-policy-version.entity';
import { TenantPoliciesService } from './tenant-policies.service';
import { TenantPoliciesController } from './tenant-policies.controller';

@Module({
  imports: [TypeOrmModule.forFeature([TenantPolicyVersion])],
  controllers: [TenantPoliciesController],
  providers: [TenantPoliciesService],
  exports: [TenantPoliciesService],
})
export class TenantPoliciesModule {}
