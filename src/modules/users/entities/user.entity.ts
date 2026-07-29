import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { TenantMembership } from '../../memberships/entities/tenant-membership.entity';
import { Session } from '../../sessions/entities/session.entity';

@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index({ unique: true })
  @Column('text')
  email!: string;

  @Column('text', { name: 'password_hash' })
  passwordHash!: string;

  @Column('text', { name: 'first_name', nullable: true })
  firstName!: string | null;

  @Column('text', { name: 'last_name', nullable: true })
  lastName!: string | null;

  @Column('boolean', { name: 'is_active', default: true })
  isActive!: boolean;

  @OneToMany(() => TenantMembership, (membership) => membership.user)
  memberships!: TenantMembership[];

  @OneToMany(() => Session, (session) => session.user)
  sessions!: Session[];

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
