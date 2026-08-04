import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { ClientApp } from './client-app.entity';
import { Tenant } from '../../tenants/entities/tenant.entity';

@Entity('service_accounts')
export class ServiceAccount {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'tenant_id' })
  tenantId!: string;

  @ManyToOne(() => Tenant, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'tenant_id' })
  tenant!: Tenant;

  @Column({ name: 'client_app_id' })
  clientAppId!: string;

  @ManyToOne(() => ClientApp, (clientApp) => clientApp.serviceAccounts, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'client_app_id' })
  clientApp!: ClientApp;

  @Column()
  name!: string;

  @Column({ type: 'text', nullable: true })
  description!: string | null;

  @Column({ name: 'secret_hash' })
  secretHash!: string;

  @Column({ name: 'secret_preview' })
  secretPreview!: string;

  @Column({ name: 'created_by_user_id', type: 'uuid', nullable: true })
  createdByUserId!: string | null;

  @Column({ name: 'is_active', default: true })
  isActive!: boolean;

  @Column({ name: 'last_used_at', type: 'timestamp', nullable: true })
  lastUsedAt!: Date | null;

  @Column({ name: 'failed_auth_attempts', type: 'int', default: 0 })
  failedAuthAttempts!: number;

  @Column({ name: 'auth_blocked_until', type: 'timestamp', nullable: true })
  authBlockedUntil!: Date | null;

  // Automatic rotation policy. Null = no auto rotation (manual only).
  @Column({ name: 'rotation_interval_days', type: 'int', nullable: true })
  rotationIntervalDays!: number | null;

  // Scheduled next rotation. Recomputed on every rotate from now + interval.
  @Column({ name: 'next_rotation_at', type: 'timestamptz', nullable: true })
  nextRotationAt!: Date | null;

  // Previous secret hash, valid for the grace window right after a rotation
  // so callers that still hold the old secret can migrate without downtime.
  @Column({ name: 'previous_secret_hash', type: 'text', nullable: true })
  previousSecretHash!: string | null;

  @Column({
    name: 'previous_secret_expires_at',
    type: 'timestamptz',
    nullable: true,
  })
  previousSecretExpiresAt!: Date | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}
