import {
  Body,
  Controller,
  Get,
  Inject,
  Param,
  Patch,
  Post,
  UseGuards,
  forwardRef,
} from '@nestjs/common';
import { CreateTenantDto } from './dto/create-tenant.dto';
import { UpdateTenantDto } from './dto/update-tenant.dto';
import { TenantsService } from './tenants.service';
import { RolesGuard } from 'src/common/guards/roles.guard';
import { AccessJwtGuard } from 'src/common/guards/access-jwt.guard';
import { Roles } from 'src/common/decorators/roles.decorator';
import { TenantScopeGuard } from 'src/common/guards/tenant-scope.guard';
import { MembershipsService } from '../memberships/memberships.service';
import { CurrentAuth } from 'src/common/decorators/current-auth.decorator';
import { AccessTokenPayload } from '../auth/types/access-token-payload.type';
import { EntitlementsService } from '../entitlements/entitlements.service';

@Controller('tenants')
export class TenantsController {
  constructor(
    private readonly tenantsService: TenantsService,
    private readonly entitlementsService: EntitlementsService,
    @Inject(forwardRef(() => MembershipsService))
    private readonly membershipsService: MembershipsService,
  ) {}

  @Post()
  @UseGuards(AccessJwtGuard)
  async create(
    @Body() dto: CreateTenantDto,
    @CurrentAuth() currentAuth: AccessTokenPayload,
  ) {
    const tenant = await this.tenantsService.create(dto);
    await this.membershipsService.findOrCreate({
      userId: currentAuth.sub,
      tenantId: tenant.id,
      role: 'OWNER',
    });

    return this.entitlementsService.attachToTenant(tenant);
  }

  @Get(':id')
  @UseGuards(AccessJwtGuard, RolesGuard, TenantScopeGuard)
  @Roles('OWNER', 'ADMIN', 'MEMBER')
  async findOne(@Param('id') id: string) {
    const tenant = await this.tenantsService.findById(id);
    return this.entitlementsService.attachToTenant(tenant);
  }

  @Patch(':id')
  @UseGuards(AccessJwtGuard, RolesGuard, TenantScopeGuard)
  @Roles('OWNER')
  async update(@Param('id') id: string, @Body() dto: UpdateTenantDto) {
    const tenant = await this.tenantsService.update(id, dto);
    return this.entitlementsService.attachToTenant(tenant);
  }

  @Get(':id/memberships')
  @UseGuards(AccessJwtGuard, RolesGuard, TenantScopeGuard)
  @Roles('OWNER', 'ADMIN')
  getMemberships(@Param('id') id: string) {
    return this.membershipsService.listByTenant(id);
  }

  @Get(':id/entitlements')
  @UseGuards(AccessJwtGuard, RolesGuard, TenantScopeGuard)
  @Roles('OWNER', 'ADMIN', 'MEMBER')
  async getEntitlements(@Param('id') id: string) {
    const tenant = await this.tenantsService.findById(id);
    return this.entitlementsService.resolveForTenant(tenant);
  }
}
