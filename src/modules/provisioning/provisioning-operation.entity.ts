import {
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  Column,
  UpdateDateColumn,
} from 'typeorm';

export type ProvisioningStatus = 'PENDING' | 'IN_PROGRESS' | 'FAILED' | 'COMPLETED';

@Entity('provisioning_operations')
@Index('uq_provisioning_operations_caller_key', ['callerId', 'idempotencyKey'], {
  unique: true,
})
export class ProvisioningOperation {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'caller_id', type: 'varchar', length: 80 })
  callerId!: string;

  @Column({ name: 'idempotency_key', type: 'varchar', length: 120 })
  idempotencyKey!: string;

  @Column({ name: 'request_hash', type: 'varchar', length: 64 })
  requestHash!: string;

  @Column({ type: 'varchar', length: 20, default: 'PENDING' })
  status!: ProvisioningStatus;

  @Column({ name: 'current_step', type: 'varchar', length: 64, default: 'PENDING' })
  currentStep!: string;

  @Column({ name: 'last_error_code', type: 'varchar', length: 64, nullable: true })
  lastErrorCode!: string | null;

  @Column({ name: 'attempt_count', type: 'int', default: 0 })
  attemptCount!: number;

  @Column({ name: 'organization_id', type: 'uuid', nullable: true })
  organizationId!: string | null;

  @Column({ name: 'billing_account_id', type: 'uuid', nullable: true })
  billingAccountId!: string | null;

  @Column({ name: 'tenant_id', type: 'uuid', nullable: true })
  tenantId!: string | null;

  @Column({ name: 'client_app_id', type: 'uuid', nullable: true })
  clientAppId!: string | null;

  @Column({ name: 'environment_id', type: 'uuid', nullable: true })
  environmentId!: string | null;

  @Column({ name: 'service_account_id', type: 'uuid', nullable: true })
  serviceAccountId!: string | null;

  @Column({ name: 'encrypted_client_secret', type: 'text', nullable: true })
  encryptedClientSecret!: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}
