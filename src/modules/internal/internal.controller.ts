import {
  Body,
  Controller,
  Get,
  NotFoundException,
  Param,
  Patch,
  Query,
  UseGuards,
} from '@nestjs/common';
import { InternalServiceGuard } from '../../common/guards/internal-service.guard';
import { EntitlementsService } from '../entitlements/entitlements.service';
import { MembershipsService } from '../memberships/memberships.service';
import { TenantsService } from '../tenants/tenants.service';
import { UpdateTenantDto } from '../tenants/dto/update-tenant.dto';
import { TenantPoliciesService } from '../tenant-policies/tenant-policies.service';

@Controller('internal')
@UseGuards(InternalServiceGuard)
export class InternalController {
  constructor(
    private readonly tenantsService: TenantsService,
    private readonly entitlementsService: EntitlementsService,
    private readonly membershipsService: MembershipsService,
    private readonly tenantPoliciesService: TenantPoliciesService,
  ) {}

  @Get('tenants/:id')
  async getTenantById(@Param('id') id: string) {
    const tenant = await this.tenantsService.findById(id);

    return this.entitlementsService.attachToTenant(tenant);
  }

  @Get('tenants/:id/entitlements')
  async getTenantEntitlements(@Param('id') id: string) {
    const tenant = await this.tenantsService.findById(id);
    return this.entitlementsService.resolveForTenant(tenant);
  }

  @Get('tenants/:id/policy')
  async getTenantPolicy(@Param('id') id: string) {
    const published = await this.tenantPoliciesService.getPublished(id);
    if (!published) {
      throw new NotFoundException('No published policy for this tenant');
    }
    return published;
  }

  @Patch('tenants/:id')
  async updateTenantInternally(
    @Param('id') id: string,
    @Body() dto: UpdateTenantDto,
  ) {
    const tenant = await this.tenantsService.update(id, dto);
    return this.entitlementsService.attachToTenant(tenant);
  }

  @Get('memberships/resolve')
  async resolveMembership(
    @Query('userId') userId?: string,
    @Query('tenantId') tenantId?: string,
  ) {
    if (!userId || !tenantId) {
      throw new NotFoundException('userId and tenantId are required');
    }

    const membership = await this.membershipsService.findActiveMembership(
      userId,
      tenantId,
    );

    if (!membership) {
      throw new NotFoundException('Membership not found');
    }

    return {
      userId: membership.userId,
      tenantId: membership.tenantId,
      role: membership.role,
      isActive: membership.isActive,
    };
  }

  @Get('users/:userId/tenants')
  async listUserTenants(@Param('userId') userId: string) {
    const rows = await this.membershipsService.listByUser(userId);

    return rows.map((membership) => ({
      ...this.entitlementsService.attachToTenant(membership.tenant),
      role: membership.role,
      membershipActive: membership.isActive,
    }));
  }
}
