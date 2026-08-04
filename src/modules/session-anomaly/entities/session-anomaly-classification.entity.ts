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
import { SessionAnomalyEvent } from './session-anomaly-event.entity';

export type ClassificationStatus = 'pending' | 'classified' | 'failed';
export type ClassificationLabel = 'legitimate' | 'suspicious' | 'critical';
export type RecommendedAction = 'allow' | 'step_up_auth' | 'alert' | 'block';

@Index(['eventId'])
@Index(['status'])
@Entity('session_anomaly_classifications')
export class SessionAnomalyClassification {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid', name: 'event_id' })
  eventId!: string;

  @ManyToOne(() => SessionAnomalyEvent, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'event_id' })
  event!: SessionAnomalyEvent;

  @Column({ type: 'varchar', length: 16, default: 'pending' })
  status!: ClassificationStatus;

  @Column({ type: 'varchar', length: 16, nullable: true })
  label!: ClassificationLabel | null;

  @Column({ type: 'numeric', precision: 3, scale: 2, nullable: true })
  confidence!: number | null;

  @Column({ type: 'text', nullable: true })
  rationale!: string | null;

  @Column({
    type: 'varchar',
    length: 32,
    name: 'recommended_action',
    nullable: true,
  })
  recommendedAction!: RecommendedAction | null;

  @Column({ type: 'varchar', length: 64, nullable: true })
  model!: string | null;

  @Column({ type: 'int', name: 'input_tokens', nullable: true })
  inputTokens!: number | null;

  @Column({ type: 'int', name: 'output_tokens', nullable: true })
  outputTokens!: number | null;

  @Column({ type: 'int', name: 'latency_ms', nullable: true })
  latencyMs!: number | null;

  @Column({ type: 'text', nullable: true })
  error!: string | null;

  @CreateDateColumn({ type: 'timestamptz', name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamptz', name: 'updated_at' })
  updatedAt!: Date;
}
