import { Body, Controller, Get, Param, Patch, Post } from '@nestjs/common';
import { CreateMembershipDto } from './dto/create-membership.dto';
import { UpdateMembershipDto } from './dto/update-membership.dto';
import { MembershipsService } from './memberships.service';

@Controller()
export class MembershipsController {
  constructor(private readonly membershipsService: MembershipsService) {}

  @Post('memberships')
  create(@Body() dto: CreateMembershipDto) {
    return this.membershipsService.create(dto);
  }

  @Get('memberships/:id')
  findById(@Param('id') id: string) {
    return this.membershipsService.findById(id);
  }

  @Patch('memberships/:id')
  update(@Param('id') id: string, @Body() dto: UpdateMembershipDto) {
    return this.membershipsService.update(id, dto);
  }

  @Get('users/:userId/memberships')
  listByUser(@Param('userId') userId: string) {
    return this.membershipsService.listByUser(userId);
  }

  @Get('tenants/:tenantId/memberships')
  listByTenant(@Param('tenantId') tenantId: string) {
    return this.membershipsService.listByTenant(tenantId);
  }
}
