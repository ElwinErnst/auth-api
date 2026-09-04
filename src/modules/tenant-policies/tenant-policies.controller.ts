import {
  Body,
  Controller,
  Get,
  HttpCode,
  NotFoundException,
  Param,
  Put,
  UseGuards,
} from '@nestjs/common';
import { AccessJwtGuard } from 'src/common/guards/access-jwt.guard';
import { RolesGuard } from 'src/common/guards/roles.guard';
import { TenantScopeGuard } from 'src/common/guards/tenant-scope.guard';
import { Roles } from 'src/common/decorators/roles.decorator';
import { CurrentAuth } from 'src/common/decorators/current-auth.decorator';
import { AccessTokenPayload } from '../auth/types/access-token-payload.type';
import { TenantPoliciesService } from './tenant-policies.service';
import { assertValidPolicySet } from './policy-set.validation';

/**
 * Tenant-scoped admin API for Zero Trust policies. The param is named
 * `:tenantId` on purpose: TenantScopeGuard only enforces scope when the tenant
 * id is under that key (it no-ops on `:id`), so this route must use `:tenantId`
 * or cross-tenant access would not be blocked.
 */
@Controller('tenants/:tenantId/policy')
@UseGuards(AccessJwtGuard, RolesGuard, TenantScopeGuard)
@Roles('OWNER', 'ADMIN')
export class TenantPoliciesController {
  constructor(private readonly service: TenantPoliciesService) {}

  @Get()
  async getPublished(@Param('tenantId') tenantId: string) {
    const row = await this.service.getPublished(tenantId);
    if (!row) {
      throw new NotFoundException('No published policy for this tenant');
    }
    return row;
  }

  @Put()
  @HttpCode(200)
  async publish(
    @Param('tenantId') tenantId: string,
    @Body() body: unknown,
    @CurrentAuth() auth: AccessTokenPayload,
  ) {
    const policySet = assertValidPolicySet(body);
    return this.service.publish(tenantId, policySet, auth.sub);
  }
}
