import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';

export type PolicyStatus = 'published' | 'archived';

/**
 * A versioned Zero Trust policy set owned by auth-api (the source of truth for
 * tenant data). Each publish inserts a new row with an incremented version and
 * archives the previous published one, so exactly one row per tenant is
 * `published` at a time. zerotrust-api reads the published set (cached) and
 * evaluates it; it no longer holds policy state in memory.
 */
@Entity('tenant_policy_versions')
@Index('IDX_tenant_policy_versions_tenant_status', ['tenantId', 'status'])
export class TenantPolicyVersion {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'tenant_id', type: 'uuid' })
  tenantId!: string;

  @Column({ type: 'int' })
  version!: number;

  // The compiled policy set (schema owned/validated by zerotrust-api). Stored
  // opaquely here; auth-api serves it, ZT re-validates before evaluating.
  @Column({ name: 'policy_set', type: 'jsonb' })
  policySet!: unknown;

  @Column({ type: 'varchar', length: 16, default: 'published' })
  status!: PolicyStatus;

  @Column({ name: 'created_by', type: 'uuid', nullable: true })
  createdBy!: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;
}
