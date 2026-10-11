import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { AccessJwtGuard } from '../../common/guards/access-jwt.guard';
import { CurrentAuth } from '../../common/decorators/current-auth.decorator';
import { AccessTokenPayload } from '../auth/types/access-token-payload.type';
import { CreateOrganizationDto } from './dto/create-organization.dto';
import { CreateOrganizationMembershipDto } from './dto/create-organization-membership.dto';
import { LinkTenantDto } from './dto/link-tenant.dto';
import { OrganizationsService } from './organizations.service';

@Controller('organizations')
@UseGuards(AccessJwtGuard)
export class OrganizationsController {
  constructor(private readonly organizationsService: OrganizationsService) {}

  @Post()
  create(
    @Body() dto: CreateOrganizationDto,
    @CurrentAuth() auth: AccessTokenPayload,
  ) {
    return this.organizationsService.create(dto, auth.sub);
  }

  @Get()
  list(@CurrentAuth() auth: AccessTokenPayload) {
    return this.organizationsService.listByUser(auth.sub);
  }

  @Post(':organizationId/tenants')
  linkTenant(
    @Param('organizationId') organizationId: string,
    @Body() dto: LinkTenantDto,
    @CurrentAuth() auth: AccessTokenPayload,
  ) {
    return this.organizationsService.linkTenant(
      organizationId,
      dto.tenantId,
      auth.sub,
    );
  }

  @Get(':organizationId/tenants')
  listTenants(
    @Param('organizationId') organizationId: string,
    @CurrentAuth() auth: AccessTokenPayload,
  ) {
    return this.organizationsService.listTenants(organizationId, auth.sub);
  }

  @Get(':organizationId/memberships')
  listMemberships(
    @Param('organizationId') organizationId: string,
    @CurrentAuth() auth: AccessTokenPayload,
  ) {
    return this.organizationsService.listMemberships(organizationId, auth.sub);
  }

  @Post(':organizationId/memberships')
  addMembership(
    @Param('organizationId') organizationId: string,
    @Body() dto: CreateOrganizationMembershipDto,
    @CurrentAuth() auth: AccessTokenPayload,
  ) {
    return this.organizationsService.addMembership(
      organizationId,
      dto,
      auth.sub,
    );
  }
}
