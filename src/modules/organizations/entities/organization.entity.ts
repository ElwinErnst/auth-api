import {
  CreateDateColumn,
  Entity,
  OneToMany,
  OneToOne,
  PrimaryGeneratedColumn,
  Column,
  UpdateDateColumn,
} from 'typeorm';
import { BillingAccount } from './billing-account.entity';
import { OrganizationMembership } from './organization-membership.entity';
import { OrganizationTenant } from './organization-tenant.entity';

@Entity('organizations')
export class Organization {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar', length: 160 })
  name!: string;

  @Column({ type: 'varchar', length: 120, unique: true })
  slug!: string;

  @OneToOne(() => BillingAccount, (account) => account.organization)
  billingAccount!: BillingAccount;

  @OneToMany(
    () => OrganizationMembership,
    (membership) => membership.organization,
  )
  memberships!: OrganizationMembership[];

  @OneToMany(() => OrganizationTenant, (link) => link.organization)
  tenantLinks!: OrganizationTenant[];

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}
