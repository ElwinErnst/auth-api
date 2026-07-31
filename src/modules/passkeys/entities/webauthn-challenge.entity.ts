import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';

export type ChallengeKind = 'registration' | 'authentication';

@Index(['challenge'])
@Entity('webauthn_challenges')
export class WebauthnChallenge {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar', length: 16 })
  kind!: ChallengeKind;

  // For registration: userId of the caller.
  // For authentication: the userId resolved from email+tenant.
  @Column({ type: 'uuid', name: 'user_id', nullable: true })
  userId!: string | null;

  // Base64url-encoded challenge as returned to the client.
  @Column({ type: 'text' })
  challenge!: string;

  @Column({ type: 'timestamptz', name: 'expires_at' })
  expiresAt!: Date;

  @CreateDateColumn({ type: 'timestamptz', name: 'created_at' })
  createdAt!: Date;
}
