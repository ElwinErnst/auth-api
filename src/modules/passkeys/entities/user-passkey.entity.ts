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
import { User } from '../../users/entities/user.entity';

export type PasskeyDeviceType = 'singleDevice' | 'multiDevice';

@Index(['userId'])
@Entity('user_passkeys')
export class UserPasskey {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid', name: 'user_id' })
  userId!: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user!: User;

  @Index({ unique: true })
  @Column({ type: 'bytea', name: 'credential_id' })
  credentialId!: Buffer;

  @Column({ type: 'bytea', name: 'public_key' })
  publicKey!: Buffer;

  @Column({ type: 'bigint', default: 0 })
  counter!: string;

  @Column({ type: 'text', array: true, default: () => "'{}'" })
  transports!: string[];

  @Column({ type: 'varchar', length: 20, name: 'device_type' })
  deviceType!: PasskeyDeviceType;

  @Column({ type: 'boolean', name: 'backed_up', default: false })
  backedUp!: boolean;

  @Column({ type: 'varchar', length: 80, name: 'friendly_name' })
  friendlyName!: string;

  @Column({ type: 'timestamptz', name: 'last_used_at', nullable: true })
  lastUsedAt!: Date | null;

  @CreateDateColumn({ type: 'timestamptz', name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamptz', name: 'updated_at' })
  updatedAt!: Date;
}
