import {
  Body,
  Controller,
  Get,
  NotFoundException,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { InternalServiceGuard } from '../../common/guards/internal-service.guard';
import { EntitlementsService } from '../entitlements/entitlements.service';
import { MembershipsService } from '../memberships/memberships.service';
import { TenantsService } from '../tenants/tenants.service';
import { UpdateTenantDto } from '../tenants/dto/update-tenant.dto';
import { TenantPoliciesService } from '../tenant-policies/tenant-policies.service';
import { OrganizationsService } from '../organizations/organizations.service';
import { AuthorizePlatformSubscriptionDto } from './dto/authorize-platform-subscription.dto';
import { ProvisionSaaSRequestDto } from '../provisioning/provisioning.dto';
import { ProvisioningService } from '../provisioning/provisioning.service';

@Controller('internal')
@UseGuards(InternalServiceGuard)
export class InternalController {
  constructor(
    private readonly tenantsService: TenantsService,
    private readonly entitlementsService: EntitlementsService,
    private readonly membershipsService: MembershipsService,
    private readonly tenantPoliciesService: TenantPoliciesService,
    private readonly organizationsService: OrganizationsService,
    private readonly provisioningService: ProvisioningService,
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

  @Post('organizations/:organizationId/platform-subscription-authorization')
  authorizePlatformSubscription(
    @Param('organizationId') organizationId: string,
    @Body() dto: AuthorizePlatformSubscriptionDto,
  ) {
    return this.organizationsService.authorizePlatformSubscriptionCoverage({
      organizationId,
      billingAccountId: dto.billingAccountId,
      actorUserId: dto.actorUserId,
      coveredTenantIds: dto.coveredTenantIds,
    });
  }

  @Post('provisioning')
  provisionSaaS(@Body() dto: ProvisionSaaSRequestDto) {
    return this.provisioningService.provision(dto);
  }

  @Get('provisioning/:idempotencyKey')
  getProvisioningStatus(
    @Param('idempotencyKey', new ParseUUIDPipe()) idempotencyKey: string,
  ) {
    return this.provisioningService.getStatus(idempotencyKey);
  }
}
