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
import { ClientApp } from './client-app.entity';
import { Tenant } from '../../tenants/entities/tenant.entity';

/**
 * The deployment tier of a client application (dev / staging / prod).
 *
 * Environments are the isolation boundary below the application: API keys,
 * provider connections, webhook endpoints and payments will all hang off an
 * environment, so a development credential can never act on production data.
 * Kept as a fixed enum on purpose — arbitrary environments add surface without
 * a real caller asking for them, and a fixed set is trivial to enforce.
 */
export type EnvironmentName = 'development' | 'staging' | 'production';

@Entity('environments')
// One environment of each name per application (a client app cannot have two
// "production" tiers).
@Index('UQ_environments_client_app_name', ['clientAppId', 'name'], {
  unique: true,
})
export class Environment {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'tenant_id', type: 'uuid' })
  tenantId!: string;

  @ManyToOne(() => Tenant, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'tenant_id' })
  tenant!: Tenant;

  @Column({ name: 'client_app_id', type: 'uuid' })
  clientAppId!: string;

  @ManyToOne(() => ClientApp, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'client_app_id' })
  clientApp!: ClientApp;

  @Column({ name: 'name', type: 'varchar', length: 20 })
  name!: EnvironmentName;

  @Column({ name: 'slug', type: 'varchar', length: 120 })
  slug!: string;

  @Column({ name: 'is_active', default: true })
  isActive!: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}
