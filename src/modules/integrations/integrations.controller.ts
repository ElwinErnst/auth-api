import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { AccessJwtGuard } from '../../common/guards/access-jwt.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { TenantScopeGuard } from '../../common/guards/tenant-scope.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentAuth } from '../../common/decorators/current-auth.decorator';
import { AccessTokenPayload } from '../auth/types/access-token-payload.type';
import { IntegrationsService } from './integrations.service';
import { CreateClientAppDto } from './dto/create-client-app.dto';
import { UpdateClientAppDto } from './dto/update-client-app.dto';
import { CreateServiceAccountDto } from './dto/create-service-account.dto';
import { UpdateServiceAccountDto } from './dto/update-service-account.dto';
import { IssueServiceAccountTokenDto } from './dto/issue-service-account-token.dto';
import { SetRotationPolicyDto } from './dto/set-rotation-policy.dto';

@Controller()
export class IntegrationsController {
  constructor(private readonly integrationsService: IntegrationsService) {}

  @Get('tenants/:tenantId/client-apps')
  @UseGuards(AccessJwtGuard, RolesGuard, TenantScopeGuard)
  @Roles('OWNER', 'ADMIN')
  listClientApps(@Param('tenantId') tenantId: string) {
    return this.integrationsService.listClientApps(tenantId);
  }

  @Post('tenants/:tenantId/client-apps')
  @UseGuards(AccessJwtGuard, RolesGuard, TenantScopeGuard)
  @Roles('OWNER', 'ADMIN')
  createClientApp(
    @Param('tenantId') tenantId: string,
    @Body() dto: CreateClientAppDto,
    @CurrentAuth() currentAuth: AccessTokenPayload,
  ) {
    return this.integrationsService.createClientApp(
      tenantId,
      dto,
      currentAuth.sub,
    );
  }

  @Patch('tenants/:tenantId/client-apps/:clientAppId')
  @UseGuards(AccessJwtGuard, RolesGuard, TenantScopeGuard)
  @Roles('OWNER', 'ADMIN')
  updateClientApp(
    @Param('tenantId') tenantId: string,
    @Param('clientAppId') clientAppId: string,
    @Body() dto: UpdateClientAppDto,
  ) {
    return this.integrationsService.updateClientApp(tenantId, clientAppId, dto);
  }

  @Get('tenants/:tenantId/client-apps/:clientAppId/service-accounts')
  @UseGuards(AccessJwtGuard, RolesGuard, TenantScopeGuard)
  @Roles('OWNER', 'ADMIN')
  listServiceAccounts(
    @Param('tenantId') tenantId: string,
    @Param('clientAppId') clientAppId: string,
  ) {
    return this.integrationsService.listServiceAccounts(tenantId, clientAppId);
  }

  @Post('tenants/:tenantId/client-apps/:clientAppId/service-accounts')
  @UseGuards(AccessJwtGuard, RolesGuard, TenantScopeGuard)
  @Roles('OWNER', 'ADMIN')
  createServiceAccount(
    @Param('tenantId') tenantId: string,
    @Param('clientAppId') clientAppId: string,
    @Body() dto: CreateServiceAccountDto,
    @CurrentAuth() currentAuth: AccessTokenPayload,
  ) {
    return this.integrationsService.createServiceAccount(
      tenantId,
      clientAppId,
      dto,
      currentAuth.sub,
    );
  }

  @Patch('tenants/:tenantId/service-accounts/:serviceAccountId')
  @UseGuards(AccessJwtGuard, RolesGuard, TenantScopeGuard)
  @Roles('OWNER', 'ADMIN')
  updateServiceAccount(
    @Param('tenantId') tenantId: string,
    @Param('serviceAccountId') serviceAccountId: string,
    @Body() dto: UpdateServiceAccountDto,
  ) {
    return this.integrationsService.updateServiceAccount(
      tenantId,
      serviceAccountId,
      dto,
    );
  }

  @Post('tenants/:tenantId/service-accounts/:serviceAccountId/rotate-secret')
  @UseGuards(AccessJwtGuard, RolesGuard, TenantScopeGuard)
  @Roles('OWNER', 'ADMIN')
  rotateServiceAccountSecret(
    @Param('tenantId') tenantId: string,
    @Param('serviceAccountId') serviceAccountId: string,
  ) {
    return this.integrationsService.rotateServiceAccountSecret(
      tenantId,
      serviceAccountId,
    );
  }

  @Patch('tenants/:tenantId/service-accounts/:serviceAccountId/rotation-policy')
  @UseGuards(AccessJwtGuard, RolesGuard, TenantScopeGuard)
  @Roles('OWNER', 'ADMIN')
  setRotationPolicy(
    @Param('tenantId') tenantId: string,
    @Param('serviceAccountId') serviceAccountId: string,
    @Body() dto: SetRotationPolicyDto,
  ) {
    return this.integrationsService.setRotationPolicy(
      tenantId,
      serviceAccountId,
      dto.rotationIntervalDays ?? null,
    );
  }

  @Post('integrations/service-account-token')
  issueServiceAccountToken(@Body() dto: IssueServiceAccountTokenDto) {
    return this.integrationsService.issueServiceAccountToken(dto);
  }
}
