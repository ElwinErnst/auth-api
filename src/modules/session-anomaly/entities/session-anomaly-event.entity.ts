import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';

export type AnomalySeverity = 'info' | 'warning' | 'critical';

@Index(['userId', 'createdAt'])
@Entity('session_anomaly_events')
export class SessionAnomalyEvent {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid', name: 'user_id' })
  userId!: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user!: User;

  @Column({ type: 'uuid', name: 'tenant_id', nullable: true })
  tenantId!: string | null;

  @Column({ type: 'uuid', name: 'session_id', nullable: true })
  sessionId!: string | null;

  @Column({ type: 'text', nullable: true })
  ip!: string | null;

  @Column({ type: 'varchar', length: 3, nullable: true })
  country!: string | null;

  @Column({ type: 'varchar', length: 120, nullable: true })
  city!: string | null;

  @Column({ type: 'text', name: 'user_agent', nullable: true })
  userAgent!: string | null;

  @Column({ type: 'int' })
  score!: number;

  @Column({ type: 'jsonb', default: () => "'[]'" })
  flags!: string[];

  @Column({ type: 'varchar', length: 16 })
  severity!: AnomalySeverity;

  @Column({ type: 'varchar', length: 40, name: 'login_kind' })
  loginKind!: 'password' | 'passkey';

  @CreateDateColumn({ type: 'timestamptz', name: 'created_at' })
  createdAt!: Date;
}
