import {
  Controller,
  Get,
  NotFoundException,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { InternalServiceGuard } from '../../common/guards/internal-service.guard';
import { MembershipsService } from '../memberships/memberships.service';
import { TenantsService } from '../tenants/tenants.service';

@Controller('internal')
@UseGuards(InternalServiceGuard)
export class InternalController {
  constructor(
    private readonly tenantsService: TenantsService,
    private readonly membershipsService: MembershipsService,
  ) {}

  @Get('tenants/:id')
  async getTenantById(@Param('id') id: string) {
    const tenant = await this.tenantsService.findById(id);

    return {
      id: tenant.id,
      name: tenant.name,
      slug: tenant.slug,
      planCode: tenant.planCode ?? null,
      isActive: tenant.isActive,
    };
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
      id: membership.tenant.id,
      name: membership.tenant.name,
      slug: membership.tenant.slug,
      planCode: membership.tenant.planCode ?? null,
      isActive: membership.tenant.isActive,
      role: membership.role,
      membershipActive: membership.isActive,
      createdAt: membership.tenant.createdAt.toISOString(),
      updatedAt: membership.tenant.updatedAt.toISOString(),
    }));
  }
}
