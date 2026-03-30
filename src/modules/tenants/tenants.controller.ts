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

@Controller('tenants')
export class TenantsController {
  constructor(
    private readonly tenantsService: TenantsService,
    @Inject(forwardRef(() => MembershipsService))
    private readonly membershipsService: MembershipsService,
  ) {}

  @Post()
  create(@Body() dto: CreateTenantDto) {
    return this.tenantsService.create(dto);
  }

  @Get(':id')
  @UseGuards(AccessJwtGuard, RolesGuard)
  @Roles('OWNER', 'ADMIN')
  findOne(@Param('id') id: string) {
    return this.tenantsService.findById(id);
  }

  @Patch(':id')
  @UseGuards(AccessJwtGuard, RolesGuard, TenantScopeGuard)
  @Roles('OWNER')
  update(@Param('id') id: string, @Body() dto: UpdateTenantDto) {
    return this.tenantsService.update(id, dto);
  }

  @Get(':id/memberships')
  @UseGuards(TenantScopeGuard)
  @Roles('OWNER', 'ADMIN')
  getMemberships(@Param('tenantId') id: string) {
    return this.membershipsService.listByTenant(id);
  }
}
