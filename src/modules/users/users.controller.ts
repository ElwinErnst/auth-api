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

  /**
   * Users are global entities, but a privileged caller's role only applies to
   * their own tenant (the token is tenant-scoped). Without binding access to a
   * shared tenant, any OWNER/ADMIN of any tenant could read or deactivate any
   * user in the whole system. Self-access is always allowed.
   */
  private async assertCanAccessUser(
    currentAuth: AccessTokenPayload,
    targetUserId: string,
  ): Promise<void> {
    if (currentAuth.sub === targetUserId) {
      return;
    }

    const isPrivileged =
      currentAuth.roles.includes('OWNER') ||
      currentAuth.roles.includes('ADMIN');

    if (!isPrivileged) {
      throw new ForbiddenException('You can only access your own user');
    }

    const sharedMembership =
      await this.membershipsService.findActiveMembership(
        targetUserId,
        currentAuth.tenantId,
      );

    if (!sharedMembership) {
      throw new ForbiddenException('User is not a member of your tenant');
    }
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
    await this.assertCanAccessUser(currentAuth, id);

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
    await this.assertCanAccessUser(currentAuth, id);

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
    await this.assertCanAccessUser(currentAuth, id);

    const memberships = await this.membershipsService.listByUser(id);

    // A privileged caller viewing another user must not learn which OTHER
    // tenants that user belongs to — only the membership shared with the
    // caller's tenant. Self-access still returns the full list.
    if (currentAuth.sub === id) {
      return memberships;
    }

    return memberships.filter((m) => m.tenantId === currentAuth.tenantId);
  }
}
