import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import authConfig from './config/auth.config';
import dbConfig from './config/db.config';
import jwtConfig from './config/jwt.config';
import { buildTypeOrmConfig } from './database/typeorm.config';
import { AuthModule } from './modules/auth/auth.module';
import { UsersModule } from './modules/users/users.module';
import { TenantsModule } from './modules/tenants/tenants.module';
import { MembershipsModule } from './modules/memberships/memberships.module';
import { SessionsModule } from './modules/sessions/sessions.module';
import { DemoSeedService } from './database/demo-seed.service';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [authConfig, dbConfig, jwtConfig],
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
    UsersModule,
    TenantsModule,
    MembershipsModule,
    SessionsModule,
    AuthModule,
  ],
  providers: [DemoSeedService],
})
export class AppModule { }
