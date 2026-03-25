import {
  Column,
  CreateDateColumn,
  Entity,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { TenantMembership } from '../../memberships/entities/tenant-membership.entity';
import { Session } from '../../sessions/entities/session.entity';

@Entity('tenants')
export class Tenant {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column()
  name!: string;

  @Column({ unique: true })
  slug!: string;

  @Column({ name: 'plan_code', default: 'FREE' })
  planCode!: string;

  @Column({ name: 'zt_policies_enabled', default: false })
  ztPoliciesEnabled!: boolean;

  @Column({ name: 'vaults_enabled', default: false })
  vaultsEnabled!: boolean;

  @Column({ name: 'max_vaults', type: 'int', default: 0 })
  maxVaults!: number;

  @Column({ name: 'is_active', default: true })
  isActive!: boolean;

  @OneToMany(() => TenantMembership, (membership) => membership.tenant)
  memberships!: TenantMembership[];

  @OneToMany(() => Session, (session) => session.tenant)
  sessions!: Session[];

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}
