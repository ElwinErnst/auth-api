import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

export type AccessRequestStatus = 'pending' | 'approved' | 'rejected';

/**
 * What the LLM agent proposed for a request, surfaced to the human approver.
 * The agent proposes; a human decides — the recommendation is never auto-applied.
 */
export type AccessRequestProposal = {
  recommendation: 'allow' | 'deny';
  reasoning: string;
  confidence: number; // 0..1
};

/**
 * A request by a user to gain (or raise) a tenant membership role. An LLM agent
 * proposes allow/deny with reasoning; a human approves or rejects with one
 * click. Only on approval is the membership actually applied.
 */
@Index(['tenantId', 'status', 'createdAt'])
@Entity('access_requests')
export class AccessRequest {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid', name: 'tenant_id' })
  tenantId!: string;

  @Column({ type: 'uuid', name: 'requester_user_id' })
  requesterUserId!: string;

  // Requested tenant role (OWNER | ADMIN | MEMBER) — validated at the controller.
  @Column({ type: 'varchar', length: 20, name: 'requested_role' })
  requestedRole!: string;

  @Column({ type: 'text', name: 'justification', nullable: true })
  justification!: string | null;

  @Column({ type: 'varchar', length: 16, default: 'pending' })
  status!: AccessRequestStatus;

  // The agent's proposal; null until the agent has run.
  @Column({ type: 'jsonb', name: 'agent_proposal', nullable: true })
  agentProposal!: AccessRequestProposal | null;

  @Column({ type: 'varchar', length: 64, name: 'agent_model', nullable: true })
  agentModel!: string | null;

  // The human approver and when they decided; null while pending.
  @Column({ type: 'uuid', name: 'decided_by_user_id', nullable: true })
  decidedByUserId!: string | null;

  @Column({ type: 'timestamptz', name: 'decided_at', nullable: true })
  decidedAt!: Date | null;

  @CreateDateColumn({ type: 'timestamptz', name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamptz', name: 'updated_at' })
  updatedAt!: Date;
}
