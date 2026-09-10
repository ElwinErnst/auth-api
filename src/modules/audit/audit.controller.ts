import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { AccessJwtGuard } from 'src/common/guards/access-jwt.guard';
import { RolesGuard } from 'src/common/guards/roles.guard';
import { TenantScopeGuard } from 'src/common/guards/tenant-scope.guard';
import { Roles } from 'src/common/decorators/roles.decorator';
import { AuditService } from './audit.service';

/**
 * Tenant-scoped read API for this service's audit events. Mirrors the tenant
 * policy admin authz: the param is `:tenantId` on purpose (TenantScopeGuard
 * no-ops on `:id`), so cross-tenant reads are blocked. This is the per-service
 * `/audit-events` endpoint the console aggregates into the unified timeline.
 */
@Controller('tenants/:tenantId/audit-events')
@UseGuards(AccessJwtGuard, RolesGuard, TenantScopeGuard)
@Roles('OWNER', 'ADMIN')
export class AuditController {
  constructor(private readonly audit: AuditService) {}

  @Get()
  list(
    @Param('tenantId') tenantId: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.audit.list(tenantId, {
      page: page ? Number(page) : undefined,
      limit: limit ? Number(limit) : undefined,
    });
  }
}
