import { TypeOrmModuleOptions } from '@nestjs/typeorm';
import { User } from '../modules/users/entities/user.entity';
import { Tenant } from '../modules/tenants/entities/tenant.entity';
import { TenantMembership } from '../modules/memberships/entities/tenant-membership.entity';
import { Session } from '../modules/sessions/entities/session.entity';

export function buildTypeOrmConfig(db: {
  host: string;
  port: number;
  username: string;
  password: string;
  database: string;
  synchronize: boolean;
}): TypeOrmModuleOptions {
  return {
    type: 'postgres',
    host: db.host,
    port: db.port,
    username: db.username,
    password: db.password,
    database: db.database,
    entities: [User, Tenant, TenantMembership, Session],
    synchronize: db.synchronize,
    autoLoadEntities: true,
  };
}
