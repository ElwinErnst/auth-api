import {
  Controller,
  Get,
  HttpCode,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { AccessJwtGuard } from 'src/common/guards/access-jwt.guard';
import { RolesGuard } from 'src/common/guards/roles.guard';
import { TenantScopeGuard } from 'src/common/guards/tenant-scope.guard';
import { Roles } from 'src/common/decorators/roles.decorator';
import { AuditService } from './audit.service';
import { AuditCheckpointService } from './audit-checkpoint.service';

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
  constructor(
    private readonly audit: AuditService,
    private readonly checkpoints: AuditCheckpointService,
  ) {}

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

  /**
   * Verify the tamper-evident hash chain AND its position against the latest
   * anchored checkpoint (so suffix truncation is caught, not just interior
   * edits). Returns the chain result plus the anchor status.
   */
  @Get('verify')
  verify(@Param('tenantId') tenantId: string) {
    return this.checkpoints.verifyScopeAnchored(tenantId);
  }

  /** Anchor the current chain head for this tenant (SIMULATED until a TSA is set). */
  @Post('checkpoint')
  @HttpCode(200)
  async checkpoint(@Param('tenantId') tenantId: string) {
    const outcome = await this.checkpoints.createCheckpoint(tenantId);
    return { outcome };
  }
}
