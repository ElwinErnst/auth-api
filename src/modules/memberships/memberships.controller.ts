import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { CreateMembershipDto } from './dto/create-membership.dto';
import { UpdateMembershipDto } from './dto/update-membership.dto';
import { MembershipsService } from './memberships.service';
import { RolesGuard } from 'src/common/guards/roles.guard';
import { AccessJwtGuard } from 'src/common/guards/access-jwt.guard';
import { Roles } from 'src/common/decorators/roles.decorator';
import { TenantScopeGuard } from 'src/common/guards/tenant-scope.guard';
import { CurrentAuth } from 'src/common/decorators/current-auth.decorator';
import { AccessTokenPayload } from '../auth/types/access-token-payload.type';

@Controller('memberships')
@UseGuards(AccessJwtGuard, RolesGuard, TenantScopeGuard)
export class MembershipsController {
  constructor(private readonly membershipsService: MembershipsService) {}

  @Post()
  @Roles('OWNER', 'ADMIN')
  create(@Body() dto: CreateMembershipDto) {
    return this.membershipsService.create(dto);
  }

  @Get(':id')
  @Roles('OWNER', 'ADMIN')
  findById(
    @Param('id') id: string,
    @CurrentAuth() currentAuth: AccessTokenPayload,
  ) {
    return this.membershipsService.findById(id, currentAuth.tenantId);
  }

  @Patch(':id')
  @Roles('OWNER', 'ADMIN')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateMembershipDto,
    @CurrentAuth() currentAuth: AccessTokenPayload,
  ) {
    return this.membershipsService.update(id, dto, currentAuth.tenantId);
  }
}
