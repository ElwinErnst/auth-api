import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TenantPolicyVersion } from './entities/tenant-policy-version.entity';
import { TenantPoliciesService } from './tenant-policies.service';

@Module({
  imports: [TypeOrmModule.forFeature([TenantPolicyVersion])],
  providers: [TenantPoliciesService],
  exports: [TenantPoliciesService],
})
export class TenantPoliciesModule {}
