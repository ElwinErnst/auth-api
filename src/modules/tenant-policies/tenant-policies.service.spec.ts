import { Repository } from 'typeorm';
import { TenantPolicyVersion } from './entities/tenant-policy-version.entity';
import { TenantPoliciesService } from './tenant-policies.service';

const TENANT = '11111111-1111-1111-1111-111111111111';
const ACTOR = '99999999-9999-9999-9999-999999999999';

// Plain-object mock (not typed as Repository) so asserting on repo.findOne does
// not trip @typescript-eslint/unbound-method; cast only when constructing.
type RepoMock = { findOne: jest.Mock; create: jest.Mock; save: jest.Mock };

function makeRepoMock(): RepoMock {
  return {
    findOne: jest.fn(),
    create: jest.fn((x: unknown) => x),
    save: jest.fn((x: unknown) => Promise.resolve(x)),
  };
}

function serviceFor(repo: RepoMock): TenantPoliciesService {
  return new TenantPoliciesService(
    repo as unknown as Repository<TenantPolicyVersion>,
  );
}

const policySet = { version: 1, rules: [], default: 'deny' as const };

describe('TenantPoliciesService', () => {
  it('getPublished returns the tenant published row (or null)', async () => {
    const repo = makeRepoMock();
    const row = {
      id: 'r1',
      tenantId: TENANT,
      version: 2,
    } as TenantPolicyVersion;
    repo.findOne.mockResolvedValueOnce(row);
    const svc = serviceFor(repo);

    await expect(svc.getPublished(TENANT)).resolves.toBe(row);
    expect(repo.findOne).toHaveBeenCalledWith({
      where: { tenantId: TENANT, status: 'published' },
    });

    repo.findOne.mockResolvedValueOnce(null);
    await expect(svc.getPublished(TENANT)).resolves.toBeNull();
  });

  it('publish creates version 1 when none exists', async () => {
    const repo = makeRepoMock();
    repo.findOne.mockResolvedValueOnce(null); // no current published
    const svc = serviceFor(repo);

    const result = await svc.publish(TENANT, policySet, ACTOR);

    expect(result.version).toBe(1);
    expect(result.status).toBe('published');
    expect(result.tenantId).toBe(TENANT);
    expect(result.createdBy).toBe(ACTOR);
    expect(result.policySet).toEqual(policySet);
  });

  it('publish increments version and archives the previous published row', async () => {
    const repo = makeRepoMock();
    const current = {
      id: 'r2',
      tenantId: TENANT,
      version: 2,
      status: 'published',
    } as TenantPolicyVersion;
    repo.findOne.mockResolvedValueOnce(current);
    const svc = serviceFor(repo);

    const result = await svc.publish(TENANT, policySet, ACTOR);

    // previous row archived
    expect(repo.save).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'r2', status: 'archived' }),
    );
    // new published version = previous + 1
    expect(result.version).toBe(3);
    expect(result.status).toBe('published');
  });
});
