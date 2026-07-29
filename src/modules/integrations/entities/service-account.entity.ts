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

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}
