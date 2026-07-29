import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Tenant } from '../../tenants/entities/tenant.entity';
import { User } from '../../users/entities/user.entity';

@Entity('sessions')
export class Session {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index()
  @Column('uuid', { name: 'user_id' })
  userId!: string;

  @Index()
  @Column('uuid', { name: 'tenant_id' })
  tenantId!: string;

  @Index()
  @Column('uuid', { name: 'family_id' })
  familyId!: string;

  @Column('text', { name: 'refresh_token_hash' })
  refreshTokenHash!: string;

  @Column('text', { name: 'user_agent', nullable: true })
  userAgent!: string | null;

  @Column('text', { nullable: true })
  ip!: string | null;

  @Column('timestamptz', { name: 'expires_at' })
  expiresAt!: Date;

  @Column('timestamptz', { name: 'revoked_at', nullable: true })
  revokedAt!: Date | null;

  @Column('uuid', { name: 'replaced_by_session_id', nullable: true })
  replacedBySessionId!: string | null;

  @Column('text', { name: 'revoked_reason', nullable: true })
  revokedReason!: string | null;

  @ManyToOne(() => User, (user) => user.sessions, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user!: User;

  @ManyToOne(() => Tenant, (tenant) => tenant.sessions, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'tenant_id' })
  tenant!: Tenant;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
