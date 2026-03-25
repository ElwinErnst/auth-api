import 'reflect-metadata';
import { DataSource } from 'typeorm';
import { User } from '../modules/users/entities/user.entity';
import { Tenant } from '../modules/tenants/entities/tenant.entity';
import { TenantMembership } from '../modules/memberships/entities/tenant-membership.entity';
import { Session } from '../modules/sessions/entities/session.entity';

export default new DataSource({
  type: 'postgres',
  host: process.env.DB_HOST ?? 'localhost',
  port: Number(process.env.DB_PORT ?? 5434),
  username: process.env.DB_USER ?? 'postgres',
  password: process.env.DB_PASS ?? 'postgres',
  database: process.env.DB_NAME ?? 'auth',
  entities: [User, Tenant, TenantMembership, Session],
  migrations: ['src/database/migrations/*.ts'],
});
