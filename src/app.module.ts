import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import authConfig from './config/auth.config';
import dbConfig from './config/db.config';
import internalConfig from './config/internal.config';
import jwtConfig from './config/jwt.config';
import { buildTypeOrmConfig } from './database/typeorm.config';
import { AuthModule } from './modules/auth/auth.module';
import { UsersModule } from './modules/users/users.module';
import { TenantsModule } from './modules/tenants/tenants.module';
import { MembershipsModule } from './modules/memberships/memberships.module';
import { SessionsModule } from './modules/sessions/sessions.module';
import { DemoSeedService } from './database/demo-seed.service';
import { Type } from 'class-transformer';
import { Tenant } from './modules/tenants/entities/tenant.entity';
import { User } from './modules/users/entities/user.entity';
import { TenantMembership } from './modules/memberships/entities/tenant-membership.entity';
import { Session } from './modules/sessions/entities/session.entity';
import { RolesGuard } from './common/guards/roles.guard';
import { TenantScopeGuard } from './common/guards/tenant-scope.guard';
import { InternalServiceGuard } from './common/guards/internal-service.guard';
import { EntitlementsModule } from './modules/entitlements/entitlements.module';
import { InternalController } from './modules/internal/internal.controller';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [authConfig, dbConfig, jwtConfig, internalConfig],
    }),
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        const db = configService.get<{
          host: string;
          port: number;
          username: string;
          password: string;
          database: string;
          synchronize: boolean;
        }>('db')!;

        console.log('DB CONFIG =>', db);

        return {
          type: 'postgres' as const,
          host: db.host,
          port: db.port,
          username: db.username,
          password: db.password,
          database: db.database,
          autoLoadEntities: true,
          synchronize: db.synchronize,
        };
      },
    }),
    TypeOrmModule.forFeature([
      User,
      Tenant,
      TenantMembership,
      Session,
    ]),
    UsersModule,
    TenantsModule,
    EntitlementsModule,
    MembershipsModule,
    SessionsModule,
    AuthModule,
  ],
  controllers: [InternalController],
  providers: [
    DemoSeedService, 
    InternalServiceGuard,
    RolesGuard,
    TenantScopeGuard
  ],
})
export class AppModule { }
