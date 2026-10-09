import { ConflictException, ForbiddenException } from '@nestjs/common';
import { BillingAccount } from './entities/billing-account.entity';
import { OrganizationMembership } from './entities/organization-membership.entity';
import { OrganizationTenant } from './entities/organization-tenant.entity';
import { Organization } from './entities/organization.entity';
import { OrganizationsService } from './organizations.service';

describe('OrganizationsService', () => {
  const organization = { id: 'org-1', name: 'Acme', slug: 'acme' };

  function setup() {
    const memberships = {
      findOne: jest.fn(),
      find: jest.fn().mockResolvedValue([]),
      create: jest.fn((value) => value),
      save: jest.fn(async (value) => value),
    };
    const links = {
      findOne: jest.fn(),
      find: jest.fn().mockResolvedValue([]),
      create: jest.fn((value) => value),
      save: jest.fn(async (value) => value),
    };
    const organizations = {
      findOne: jest.fn().mockResolvedValue(organization),
      find: jest.fn().mockResolvedValue([]),
      create: jest.fn((value) => value),
      save: jest.fn(async (value) => ({ ...organization, ...value })),
    };
    const accounts = {
      create: jest.fn((value) => value),
      save: jest.fn(async (value) => value),
    };
    const repositoryByEntity = new Map<any, any>();
    repositoryByEntity.set(Organization, organizations);
    repositoryByEntity.set(BillingAccount, accounts);
    repositoryByEntity.set(OrganizationMembership, memberships);
    repositoryByEntity.set(OrganizationTenant, links);
    const dataSource = {
      transaction: jest.fn(async (callback) =>
        callback({
          getRepository: (entity: any) => repositoryByEntity.get(entity),
        }),
      ),
    };
    const tenant = { id: 'tenant-1', name: 'Customer', slug: 'customer' };
    const tenants = { findById: jest.fn().mockResolvedValue(tenant) };
    const users = { findById: jest.fn().mockResolvedValue({ id: 'user-1' }) };
    const tenantMemberships = {
      findActiveMembership: jest.fn().mockResolvedValue({ role: 'OWNER' }),
    };

    return {
      service: new OrganizationsService(
        dataSource as never,
        users as never,
        tenants as never,
        tenantMemberships as never,
        organizations as never,
        memberships as never,
        links as never,
      ),
      memberships,
      links,
      organizations,
      accounts,
      repositoryByEntity,
      tenant,
      tenantMemberships,
      tenants,
      users,
    };
  }

  it('creates an organization, billing account, and owner membership atomically', async () => {
    const { service, organizations, memberships, accounts } = setup();
    organizations.findOne.mockResolvedValue(null);

    const result = await service.create(
      { name: 'Acme', slug: 'acme' },
      'user-1',
    );

    expect(result).toMatchObject(organization);
    expect(accounts.save).toHaveBeenCalledWith(
      expect.objectContaining({ organizationId: 'org-1', name: 'Acme' }),
    );
    expect(memberships.save).toHaveBeenCalledWith(
      expect.objectContaining({
        organizationId: 'org-1',
        userId: 'user-1',
        role: 'OWNER',
        isActive: true,
      }),
    );
  });

  it('rejects a duplicate organization slug', async () => {
    const { service, organizations } = setup();
    organizations.findOne.mockResolvedValue(organization);

    await expect(
      service.create({ name: 'Acme', slug: 'acme' }, 'user-1'),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('requires an active organization owner or admin to link a tenant', async () => {
    const { service, memberships, links } = setup();
    memberships.findOne.mockResolvedValue({ role: 'MEMBER', isActive: true });

    await expect(
      service.linkTenant('org-1', 'tenant-1', 'user-1'),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(links.save).not.toHaveBeenCalled();
  });

  it('links an existing tenant without changing tenant memberships', async () => {
    const { service, memberships, links, tenants, tenantMemberships } = setup();
    memberships.findOne.mockResolvedValue({ role: 'ADMIN', isActive: true });
    links.findOne.mockResolvedValue(null);

    await service.linkTenant('org-1', 'tenant-1', 'user-1');

    expect(tenants.findById).toHaveBeenCalledWith('tenant-1');
    expect(tenantMemberships.findActiveMembership).toHaveBeenCalledWith(
      'user-1',
      'tenant-1',
    );
    expect(links.save).toHaveBeenCalledWith(
      expect.objectContaining({
        organizationId: 'org-1',
        tenantId: 'tenant-1',
      }),
    );
    expect(memberships.save).not.toHaveBeenCalled();
  });

  it('rejects an organization admin without tenant owner or admin authority', async () => {
    const { service, memberships, links, tenants, tenantMemberships } = setup();
    memberships.findOne.mockResolvedValue({ role: 'ADMIN', isActive: true });
    tenantMemberships.findActiveMembership.mockResolvedValue({
      role: 'MEMBER',
    });

    await expect(
      service.linkTenant('org-1', 'tenant-1', 'user-1'),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(tenants.findById).not.toHaveBeenCalled();
    expect(links.save).not.toHaveBeenCalled();
  });

  it('rejects a tenant already linked to an organization', async () => {
    const { service, memberships, links } = setup();
    memberships.findOne.mockResolvedValue({ role: 'OWNER', isActive: true });
    links.findOne.mockResolvedValue({ tenantId: 'tenant-1' });

    await expect(
      service.linkTenant('org-1', 'tenant-1', 'user-1'),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(links.save).not.toHaveBeenCalled();
  });

  it('rejects duplicate organization memberships', async () => {
    const { service, memberships } = setup();
    memberships.findOne
      .mockResolvedValueOnce({ role: 'OWNER', isActive: true })
      .mockResolvedValueOnce({ userId: 'user-2' });

    await expect(
      service.addMembership(
        'org-1',
        { userId: 'user-2', role: 'ADMIN' },
        'user-1',
      ),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(memberships.save).not.toHaveBeenCalled();
  });
});
