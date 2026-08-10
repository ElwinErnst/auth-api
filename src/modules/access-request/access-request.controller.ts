import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
  UseGuards,
  ValidationPipe,
} from '@nestjs/common';

import { AccessJwtGuard } from '../../common/guards/access-jwt.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { TenantScopeGuard } from '../../common/guards/tenant-scope.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentAuth } from '../../common/decorators/current-auth.decorator';
import type { AccessTokenPayload } from '../auth/types/access-token-payload.type';
import { AccessRequestService } from './access-request.service';
import { CreateAccessRequestDto } from './dto/create-access-request.dto';

@Controller('tenants/:tenantId/access-requests')
export class AccessRequestController {
  constructor(private readonly service: AccessRequestService) {}

  /**
   * Any authenticated user may request access to a tenant — they are not
   * necessarily a member yet, so this route is not tenant-scoped or role-gated.
   */
  @Post()
  @UseGuards(AccessJwtGuard)
  create(
    @Param('tenantId', new ParseUUIDPipe()) tenantId: string,
    @CurrentAuth() auth: AccessTokenPayload,
    @Body(new ValidationPipe({ whitelist: true })) dto: CreateAccessRequestDto,
  ) {
    return this.service.create({
      tenantId,
      requesterUserId: auth.sub,
      requestedRole: dto.requestedRole,
      justification: dto.justification ?? null,
    });
  }

  @Get()
  @UseGuards(AccessJwtGuard, RolesGuard, TenantScopeGuard)
  @Roles('OWNER', 'ADMIN')
  list(@Param('tenantId', new ParseUUIDPipe()) tenantId: string) {
    return this.service.listPending(tenantId);
  }

  @Post(':id/approve')
  @HttpCode(200)
  @UseGuards(AccessJwtGuard, RolesGuard, TenantScopeGuard)
  @Roles('OWNER', 'ADMIN')
  approve(
    @Param('tenantId', new ParseUUIDPipe()) tenantId: string,
    @Param('id', new ParseUUIDPipe()) id: string,
    @CurrentAuth() auth: AccessTokenPayload,
  ) {
    return this.service.approve(tenantId, id, auth.sub);
  }

  @Post(':id/reject')
  @HttpCode(200)
  @UseGuards(AccessJwtGuard, RolesGuard, TenantScopeGuard)
  @Roles('OWNER', 'ADMIN')
  reject(
    @Param('tenantId', new ParseUUIDPipe()) tenantId: string,
    @Param('id', new ParseUUIDPipe()) id: string,
    @CurrentAuth() auth: AccessTokenPayload,
  ) {
    return this.service.reject(tenantId, id, auth.sub);
  }
}
