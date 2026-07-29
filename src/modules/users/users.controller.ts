import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  Inject,
  Param,
  Patch,
  Post,
  UseGuards,
  forwardRef,
} from '@nestjs/common';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { UsersService } from './users.service';
import { Roles } from 'src/common/decorators/roles.decorator';
import { CurrentAuth } from 'src/common/decorators/current-auth.decorator';
import { AccessTokenPayload } from '../auth/types/access-token-payload.type';
import { MembershipsService } from '../memberships/memberships.service';
import { AccessJwtGuard } from 'src/common/guards/access-jwt.guard';
import { RolesGuard } from 'src/common/guards/roles.guard';

@Controller('users')
export class UsersController {
  constructor(
    private readonly usersService: UsersService,
    @Inject(forwardRef(() => MembershipsService))
    private readonly membershipsService: MembershipsService,
  ) {}

  private toSafeUser(user: {
    id: string;
    email: string;
    firstName: string | null;
    lastName: string | null;
    isActive: boolean;
  }) {
    return {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      isActive: user.isActive,
    };
  }

  @Post()
  @UseGuards(AccessJwtGuard, RolesGuard)
  @Roles('OWNER', 'ADMIN')
  async create(@Body() dto: CreateUserDto) {
    const user = await this.usersService.create(dto);
    return this.toSafeUser(user);
  }

  @Get(':id')
  @UseGuards(AccessJwtGuard, RolesGuard)
  @Roles('OWNER', 'ADMIN', 'MEMBER')
  async findOne(
    @Param('id') id: string,
    @CurrentAuth() currentAuth: AccessTokenPayload,
  ) {
    const isPrivileged =
      currentAuth.roles.includes('OWNER') ||
      currentAuth.roles.includes('ADMIN');

    if (!isPrivileged && currentAuth.sub !== id) {
      throw new ForbiddenException('You can only access your own user');
    }

    const user = await this.usersService.findById(id);
    return this.toSafeUser(user);
  }

  @Patch(':id')
  @UseGuards(AccessJwtGuard, RolesGuard)
  @Roles('OWNER', 'ADMIN', 'MEMBER')
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateUserDto,
    @CurrentAuth() currentAuth: AccessTokenPayload,
  ) {
    const isPrivileged =
      currentAuth.roles.includes('OWNER') ||
      currentAuth.roles.includes('ADMIN');

    if (!isPrivileged && currentAuth.sub !== id) {
      throw new ForbiddenException('You can only update your own user');
    }

    const user = await this.usersService.update(id, dto);
    return this.toSafeUser(user);
  }

  @Get(':id/memberships')
  @UseGuards(AccessJwtGuard, RolesGuard)
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
