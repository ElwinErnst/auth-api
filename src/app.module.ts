import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { ScheduleModule } from '@nestjs/schedule';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { TypeOrmModule } from '@nestjs/typeorm';
import authConfig from './config/auth.config';
import billingMeteringConfig from './config/billing-metering.config';
import dbConfig from './config/db.config';
import internalConfig from './config/internal.config';
import jwtConfig from './config/jwt.config';
import webauthnConfig from './config/webauthn.config';
import anomalyClassifierConfig from './config/anomaly-classifier.config';
import accessReviewConfig from './config/access-review.config';
import accessRequestConfig from './config/access-request.config';
import { AuthModule } from './modules/auth/auth.module';
import { UsersModule } from './modules/users/users.module';
import { TenantsModule } from './modules/tenants/tenants.module';
import { MembershipsModule } from './modules/memberships/memberships.module';
import { SessionsModule } from './modules/sessions/sessions.module';
import { DemoSeedService } from './database/demo-seed.service';
import { Tenant } from './modules/tenants/entities/tenant.entity';
import { User } from './modules/users/entities/user.entity';
import { TenantMembership } from './modules/memberships/entities/tenant-membership.entity';
import { Session } from './modules/sessions/entities/session.entity';
import { RolesGuard } from './common/guards/roles.guard';
import { TenantScopeGuard } from './common/guards/tenant-scope.guard';
import { InternalServiceGuard } from './common/guards/internal-service.guard';
import { EntitlementsModule } from './modules/entitlements/entitlements.module';
import { InternalController } from './modules/internal/internal.controller';
import { IntegrationsModule } from './modules/integrations/integrations.module';
import { ClientApp } from './modules/integrations/entities/client-app.entity';
import { ServiceAccount } from './modules/integrations/entities/service-account.entity';
import { PasskeysModule } from './modules/passkeys/passkeys.module';
import { UserPasskey } from './modules/passkeys/entities/user-passkey.entity';
import { WebauthnChallenge } from './modules/passkeys/entities/webauthn-challenge.entity';
import { SessionAnomalyModule } from './modules/session-anomaly/session-anomaly.module';
import { SessionAnomalyEvent } from './modules/session-anomaly/entities/session-anomaly-event.entity';
import { SessionAnomalyClassification } from './modules/session-anomaly/entities/session-anomaly-classification.entity';
import { AccessReviewModule } from './modules/access-review/access-review.module';
import { AccessRequestModule } from './modules/access-request/access-request.module';
import { TenantAccessReview } from './modules/access-review/entities/tenant-access-review.entity';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [
        authConfig,
        billingMeteringConfig,
        dbConfig,
        jwtConfig,
        internalConfig,
        webauthnConfig,
        anomalyClassifierConfig,
        accessReviewConfig,
        accessRequestConfig,
      ],
    }),
    ScheduleModule.forRoot(),
    EventEmitterModule.forRoot(),
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
      ClientApp,
      ServiceAccount,
      UserPasskey,
      WebauthnChallenge,
      SessionAnomalyEvent,
      SessionAnomalyClassification,
      TenantAccessReview,
    ]),
    UsersModule,
    TenantsModule,
    EntitlementsModule,
    MembershipsModule,
    SessionsModule,
    SessionAnomalyModule,
    IntegrationsModule,
    AuthModule,
    PasskeysModule,
    AccessReviewModule,
    AccessRequestModule,

    // Per-IP rate limiting (300 req/min default, tunable via env). Uses the
    // real client IP thanks to `trust proxy` set in main.ts.
    ThrottlerModule.forRoot([
      {
        ttl: Number(process.env.THROTTLE_TTL_MS ?? 60_000),
        limit: Number(process.env.THROTTLE_LIMIT ?? 300),
      },
    ]),
  ],
  controllers: [InternalController],
  providers: [
    DemoSeedService,
    InternalServiceGuard,
    RolesGuard,
    TenantScopeGuard,
    { provide: APP_GUARD, useClass: ThrottlerGuard },
  ],
})
export class AppModule {}
