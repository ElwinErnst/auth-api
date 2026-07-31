import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UsersModule } from '../users/users.module';
import { AuthModule } from '../auth/auth.module';
import { SessionsModule } from '../sessions/sessions.module';
import { MembershipsModule } from '../memberships/memberships.module';
import { SessionAnomalyModule } from '../session-anomaly/session-anomaly.module';
import { TenantsModule } from '../tenants/tenants.module';
import { PasskeysController } from './passkeys.controller';
import { PasskeysService } from './passkeys.service';
import { UserPasskey } from './entities/user-passkey.entity';
import { WebauthnChallenge } from './entities/webauthn-challenge.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([UserPasskey, WebauthnChallenge]),
    UsersModule,
    AuthModule,
    SessionsModule,
    MembershipsModule,
    SessionAnomalyModule,
    TenantsModule,
  ],
  controllers: [PasskeysController],
  providers: [PasskeysService],
  exports: [PasskeysService],
})
export class PasskeysModule {}
