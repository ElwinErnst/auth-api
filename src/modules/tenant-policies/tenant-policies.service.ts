import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TenantPolicyVersion } from './entities/tenant-policy-version.entity';

@Injectable()
export class TenantPoliciesService {
  constructor(
    @InjectRepository(TenantPolicyVersion)
    private readonly repo: Repository<TenantPolicyVersion>,
  ) {}

  /** The currently published policy set for a tenant, or null if none. */
  getPublished(tenantId: string): Promise<TenantPolicyVersion | null> {
    return this.repo.findOne({ where: { tenantId, status: 'published' } });
  }

  /**
   * Publish a new policy set: archive the current published row (if any) and
   * insert a new one with the next version number. Exactly one published row
   * per tenant is preserved.
   *
   * NOTE: transactional isolation / optimistic concurrency is added in a later
   * slice (2B.3); this slice establishes the versioned model.
   */
  async publish(
    tenantId: string,
    policySet: unknown,
    createdBy: string | null,
  ): Promise<TenantPolicyVersion> {
    const current = await this.getPublished(tenantId);

    const nextVersion = current ? current.version + 1 : 1;

    if (current) {
      current.status = 'archived';
      await this.repo.save(current);
    }

    const created = this.repo.create({
      tenantId,
      version: nextVersion,
      policySet,
      status: 'published',
      createdBy,
    });

    return this.repo.save(created);
  }
}
