import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { UsersService } from '../users/users.service';
import { TenantsService } from '../tenants/tenants.service';
import { MembershipsService } from '../memberships/memberships.service';
import { CreateOrganizationDto } from './dto/create-organization.dto';
import { Organization } from './entities/organization.entity';
import { BillingAccount } from './entities/billing-account.entity';
import {
  OrganizationMembership,
  OrganizationRole,
} from './entities/organization-membership.entity';
import { OrganizationTenant } from './entities/organization-tenant.entity';

@Injectable()
export class OrganizationsService {
  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly usersService: UsersService,
    private readonly tenantsService: TenantsService,
    private readonly tenantMembershipsService: MembershipsService,
    @InjectRepository(Organization)
    private readonly organizationsRepository: Repository<Organization>,
    @InjectRepository(OrganizationMembership)
    private readonly membershipsRepository: Repository<OrganizationMembership>,
    @InjectRepository(OrganizationTenant)
    private readonly linksRepository: Repository<OrganizationTenant>,
  ) {}

  async create(
    dto: CreateOrganizationDto,
    ownerUserId: string,
  ): Promise<Organization> {
    await this.usersService.findById(ownerUserId);
    if (
      await this.organizationsRepository.findOne({ where: { slug: dto.slug } })
    ) {
      throw new ConflictException('Organization slug already exists');
    }

    try {
      return await this.dataSource.transaction(async (manager) => {
        const organizations = manager.getRepository(Organization);
        const accounts = manager.getRepository(BillingAccount);
        const memberships = manager.getRepository(OrganizationMembership);
        const organization = await organizations.save(
          organizations.create({ name: dto.name, slug: dto.slug }),
        );
        await accounts.save(
          accounts.create({
            organizationId: organization.id,
            name: organization.name,
          }),
        );
        await memberships.save(
          memberships.create({
            organizationId: organization.id,
            userId: ownerUserId,
            role: 'OWNER',
            isActive: true,
          }),
        );
        return organization;
      });
    } catch (error) {
      if (this.isUniqueViolation(error)) {
        throw new ConflictException('Organization slug already exists');
      }
      throw error;
    }
  }

  async listByUser(userId: string): Promise<OrganizationMembership[]> {
    return this.membershipsRepository.find({
      where: { userId, isActive: true },
      relations: { organization: { billingAccount: true } },
      order: { createdAt: 'ASC' },
    });
  }

  async linkTenant(
    organizationId: string,
    tenantId: string,
    userId: string,
  ): Promise<OrganizationTenant> {
    await this.requireOrganizationRole(organizationId, userId, [
      'OWNER',
      'ADMIN',
    ]);
    const tenantMembership =
      await this.tenantMembershipsService.findActiveMembership(
        userId,
        tenantId,
      );
    if (
      !tenantMembership ||
      !['OWNER', 'ADMIN'].includes(tenantMembership.role)
    ) {
      throw new ForbiddenException(
        'Active tenant owner or admin membership required',
      );
    }
    await this.organizationsServiceFind(organizationId);
    await this.tenantsService.findById(tenantId);

    const existing = await this.linksRepository.findOne({
      where: { tenantId },
    });
    if (existing) {
      throw new ConflictException('Tenant already belongs to an organization');
    }

    try {
      return await this.linksRepository.save(
        this.linksRepository.create({ organizationId, tenantId }),
      );
    } catch (error) {
      if (this.isUniqueViolation(error)) {
        throw new ConflictException(
          'Tenant already belongs to an organization',
        );
      }
      throw error;
    }
  }

  async listTenants(
    organizationId: string,
    userId: string,
  ): Promise<OrganizationTenant[]> {
    await this.requireOrganizationRole(organizationId, userId);
    return this.linksRepository.find({
      where: { organizationId },
      relations: { tenant: true },
      order: { createdAt: 'ASC' },
    });
  }

  async listMemberships(
    organizationId: string,
    userId: string,
  ): Promise<OrganizationMembership[]> {
    await this.requireOrganizationRole(organizationId, userId, [
      'OWNER',
      'ADMIN',
    ]);
    return this.membershipsRepository.find({
      where: { organizationId, isActive: true },
      relations: { user: true },
      order: { createdAt: 'ASC' },
    });
  }

  async addMembership(
    organizationId: string,
    dto: { userId: string; role: OrganizationRole },
    actorUserId: string,
  ): Promise<OrganizationMembership> {
    const actor = await this.requireOrganizationRole(
      organizationId,
      actorUserId,
      ['OWNER', 'ADMIN'],
    );
    if (dto.role === 'OWNER' && actor.role !== 'OWNER') {
      throw new ForbiddenException(
        'Only an organization owner can assign owners',
      );
    }
    await this.organizationsServiceFind(organizationId);
    await this.usersService.findById(dto.userId);

    const existing = await this.membershipsRepository.findOne({
      where: { organizationId, userId: dto.userId },
    });
    if (existing) {
      throw new ConflictException('Organization membership already exists');
    }

    try {
      return await this.membershipsRepository.save(
        this.membershipsRepository.create({
          organizationId,
          userId: dto.userId,
          role: dto.role,
          isActive: true,
        }),
      );
    } catch (error) {
      if (this.isUniqueViolation(error)) {
        throw new ConflictException('Organization membership already exists');
      }
      throw error;
    }
  }

  async authorizePlatformSubscriptionCoverage(input: {
    organizationId: string;
    billingAccountId: string;
    actorUserId: string;
    coveredTenantIds: string[];
  }) {
    await this.requireOrganizationRole(input.organizationId, input.actorUserId, [
      'OWNER',
      'ADMIN',
    ]);

    const organization = await this.organizationsRepository.findOne({
      where: { id: input.organizationId },
      relations: { billingAccount: true },
    });
    if (!organization) {
      throw new NotFoundException('Organization not found');
    }
    if (organization.billingAccount?.id !== input.billingAccountId) {
      throw new ForbiddenException(
        'Billing account does not belong to this organization',
      );
    }

    const tenantIds = input.coveredTenantIds;
    if (!Array.isArray(tenantIds) || tenantIds.length === 0) {
      throw new BadRequestException('At least one covered tenant is required');
    }
    if (new Set(tenantIds).size !== tenantIds.length) {
      throw new BadRequestException('Covered tenant IDs must be unique');
    }

    for (const tenantId of tenantIds) {
      const link = await this.linksRepository.findOne({
        where: { organizationId: input.organizationId, tenantId },
      });
      if (!link) {
        throw new ForbiddenException(
          'Every covered tenant must be linked to the billing organization',
        );
      }

      const tenantMembership =
        await this.tenantMembershipsService.findActiveMembership(
          input.actorUserId,
          tenantId,
        );
      if (
        !tenantMembership ||
        !['OWNER', 'ADMIN'].includes(tenantMembership.role)
      ) {
        throw new ForbiddenException(
          'Active tenant owner or admin membership required for every covered tenant',
        );
      }
    }

    return {
      organizationId: input.organizationId,
      billingAccountId: input.billingAccountId,
      coveredTenantIds: [...tenantIds].sort(),
    };
  }

  private async requireOrganizationRole(
    organizationId: string,
    userId: string,
    allowedRoles?: OrganizationRole[],
  ): Promise<OrganizationMembership> {
    const membership = await this.membershipsRepository.findOne({
      where: { organizationId, userId, isActive: true },
    });
    if (!membership) {
      throw new ForbiddenException('Active organization membership required');
    }
    if (allowedRoles && !allowedRoles.includes(membership.role)) {
      throw new ForbiddenException('Organization owner or admin role required');
    }
    return membership;
  }

  private async organizationsServiceFind(id: string): Promise<Organization> {
    const organization = await this.organizationsRepository.findOne({
      where: { id },
    });
    if (!organization) {
      throw new NotFoundException('Organization not found');
    }
    return organization;
  }

  private isUniqueViolation(error: unknown): boolean {
    return (
      typeof error === 'object' &&
      error !== null &&
      'driverError' in error &&
      typeof error.driverError === 'object' &&
      error.driverError !== null &&
      'code' in error.driverError &&
      error.driverError.code === '23505'
    );
  }
}
