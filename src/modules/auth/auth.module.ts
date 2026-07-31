import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { EntitlementsModule } from '../entitlements/entitlements.module';
import { MembershipsModule } from '../memberships/memberships.module';
import { SessionAnomalyModule } from '../session-anomaly/session-anomaly.module';
import { SessionsModule } from '../sessions/sessions.module';
import { TenantsModule } from '../tenants/tenants.module';
import { UsersModule } from '../users/users.module';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtAccessStrategy } from './jwt-access.strategy';
import { PasswordService } from './password.service';
import { TokenService } from './token.service';

@Module({
  imports: [
    JwtModule.register({}),
    EntitlementsModule,
    UsersModule,
    TenantsModule,
    MembershipsModule,
    SessionsModule,
    SessionAnomalyModule,
  ],
  controllers: [AuthController],
  providers: [AuthService, TokenService, PasswordService, JwtAccessStrategy],
  exports: [AuthService, TokenService, PasswordService],
})
export class AuthModule {}
