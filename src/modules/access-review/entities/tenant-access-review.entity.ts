import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';

export type AccessReviewStatus = 'pending' | 'succeeded' | 'failed';

export type AccessReviewRecommendation = {
  subject: string; // e.g. "user:925df4a7", "service_account:abc123", "passkey:def456"
  action:
    | 'revoke_membership'
    | 'downgrade_role'
    | 'disable_service_account'
    | 'rotate_service_account_secret'
    | 'delete_passkey'
    | 'require_password_reset'
    | 'review_manually';
  severity: 'info' | 'warning' | 'critical';
  reason: string;
};

@Index(['tenantId', 'createdAt'])
@Entity('tenant_access_reviews')
export class TenantAccessReview {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid', name: 'tenant_id' })
  tenantId!: string;

  @Column({ type: 'varchar', length: 32, name: 'trigger' })
  trigger!: 'manual' | 'scheduled';

  @Column({ type: 'varchar', length: 16 })
  status!: AccessReviewStatus;

  @Column({ type: 'text', name: 'report_md', nullable: true })
  reportMd!: string | null;

  @Column({ type: 'jsonb', name: 'recommendations', default: () => "'[]'" })
  recommendations!: AccessReviewRecommendation[];

  @Column({ type: 'jsonb', nullable: true })
  snapshot!: Record<string, unknown> | null;

  @Column({ type: 'varchar', length: 64, nullable: true })
  model!: string | null;

  @Column({ type: 'int', name: 'input_tokens', nullable: true })
  inputTokens!: number | null;

  @Column({ type: 'int', name: 'output_tokens', nullable: true })
  outputTokens!: number | null;

  @Column({ type: 'int', name: 'latency_ms', nullable: true })
  latencyMs!: number | null;

  @Column({ type: 'numeric', precision: 10, scale: 5, name: 'cost_usd', nullable: true })
  costUsd!: string | null;

  @Column({ type: 'text', nullable: true })
  error!: string | null;

  @CreateDateColumn({ type: 'timestamptz', name: 'created_at' })
  createdAt!: Date;
}
