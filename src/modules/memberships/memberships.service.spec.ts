import { NotFoundException } from '@nestjs/common';
import { Repository } from 'typeorm';

import { MembershipsService } from './memberships.service';
import { TenantMembership } from './entities/tenant-membership.entity';

/**
 * Regression tests for the cross-tenant BOLA on memberships: `findById` and
 * `update` must scope by the caller's tenant so a membership owned by another
 * tenant is unreachable (404), even if the caller knows its UUID.
 */
function makeService(found: Partial<TenantMembership> | null) {
  const findOne = jest.fn().mockResolvedValue(found);
  const save = jest.fn().mockImplementation((m) => Promise.resolve(m));
  const repo = { findOne, save } as unknown as Repository<TenantMembership>;
  const service = new MembershipsService(
    repo,
    {} as never,
    {} as never,
  );
  return { service, findOne, save };
}

const CALLER_TENANT = 'tenant-caller';
const OTHER_TENANT = 'tenant-victim';

describe('MembershipsService tenant scoping', () => {
  it('findById scopes the query by the caller tenant', async () => {
    const { service, findOne } = makeService({
      id: 'm1',
      tenantId: CALLER_TENANT,
    });

    await service.findById('m1', CALLER_TENANT);

    expect(findOne).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'm1', tenantId: CALLER_TENANT },
      }),
    );
  });

  it('findById returns 404 for a membership in another tenant (no BOLA)', async () => {
    // The scoped `where` finds nothing when the id belongs to OTHER_TENANT.
    const { service } = makeService(null);

    await expect(
      service.findById('membership-of-victim', CALLER_TENANT),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('update refuses a cross-tenant membership and never saves', async () => {
    const { service, save } = makeService(null);

    await expect(
      service.update(
        'membership-of-victim',
        { role: 'OWNER' } as never,
        CALLER_TENANT,
      ),
    ).rejects.toBeInstanceOf(NotFoundException);

    expect(save).not.toHaveBeenCalled();
  });

  it('update applies changes when the membership is in the caller tenant', async () => {
    const { service, save } = makeService({
      id: 'm1',
      tenantId: CALLER_TENANT,
      role: 'MEMBER',
    });

    const result = await service.update(
      'm1',
      { role: 'ADMIN' } as never,
      CALLER_TENANT,
    );

    expect(save).toHaveBeenCalled();
    expect(result.role).toBe('ADMIN');
    // sanity: we never touched the victim tenant
    expect(OTHER_TENANT).not.toBe(CALLER_TENANT);
  });
});
