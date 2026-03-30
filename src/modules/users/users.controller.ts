import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  Inject,
  Param,
  Patch,
  UseGuards,
  forwardRef,
} from '@nestjs/common';
import { UpdateUserDto } from './dto/update-user.dto';
import { UsersService } from './users.service';
import { Roles } from 'src/common/decorators/roles.decorator';
import { CurrentAuth } from 'src/common/decorators/current-auth.decorator';
import { AccessTokenPayload } from '../auth/types/access-token-payload.type';
import { MembershipsService } from '../memberships/memberships.service';
import { AccessJwtGuard } from 'src/common/guards/access-jwt.guard';

@Controller('users')
export class UsersController {
  constructor(
    private readonly usersService: UsersService,
    @Inject(forwardRef(() => MembershipsService))
    private readonly membershipsService: MembershipsService,
  ) {}

  @Get(':id')
  @UseGuards(AccessJwtGuard)
  @Roles('OWNER', 'ADMIN', 'MEMBER')
  async findOne(
    @Param('id') id: string,
    @CurrentAuth() currentAuth: AccessTokenPayload,
  ) {
    const isPrivileged =
      currentAuth.roles.includes('OWNER') || currentAuth.roles.includes('ADMIN');

    if (!isPrivileged && currentAuth.sub !== id) {
      throw new ForbiddenException('You can only access your own user');
    }

    return this.usersService.findById(id);
  }

  @Patch(':id')
  @UseGuards(AccessJwtGuard)
  @Roles('OWNER', 'ADMIN', 'MEMBER')
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateUserDto,
    @CurrentAuth() currentAuth: AccessTokenPayload,
  ) {
    const isPrivileged =
      currentAuth.roles.includes('OWNER') || currentAuth.roles.includes('ADMIN');

    if (!isPrivileged && currentAuth.sub !== id) {
      throw new ForbiddenException('You can only update your own user');
    }

    return this.usersService.update(id, dto);
  }

  @Get(':id/memberships')
  @UseGuards(AccessJwtGuard)
  @Roles('OWNER', 'ADMIN', 'MEMBER')
  async getMemberships(
    @Param('id') id: string,
    @CurrentAuth() currentAuth: AccessTokenPayload,
  ) {
    const isPrivileged =
      currentAuth.roles.includes('OWNER') ||
      currentAuth.roles.includes('ADMIN');

    if (!isPrivileged && currentAuth.sub !== id) {
      throw new ForbiddenException('You can only access your own memberships');
    }

    return this.membershipsService.listByUser(id);
  }
}
