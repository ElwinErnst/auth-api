import { Injectable, UnauthorizedException } from '@nestjs/common';
import { MembershipsService } from '../memberships/memberships.service';
import { SessionsService } from '../sessions/sessions.service';
import { TenantsService } from '../tenants/tenants.service';
import { UsersService } from '../users/users.service';
import { LoginDto } from './dto/login.dto';
import { RefreshDto } from './dto/refresh.dto';
import { LogoutDto } from './dto/logout.dto';
import { PasswordService } from './password.service';
import { TokenService } from './token.service';
import { TokenPair } from './types/token-pair.type';
import { AuthMeResponse } from './types/auth-me-response.type';

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly tenantsService: TenantsService,
    private readonly membershipsService: MembershipsService,
    private readonly sessionsService: SessionsService,
    private readonly passwordService: PasswordService,
    private readonly tokenService: TokenService,
  ) { }

  async login(
    dto: LoginDto,
    context?: { userAgent?: string | null; ip?: string | null },
  ): Promise<TokenPair> {
    const user = await this.usersService.findByEmailWithMemberships(dto.email);

    if (!user || !user.isActive) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const passwordOk = await this.passwordService.verify(
      dto.password,
      user.passwordHash,
    );

    if (!passwordOk) {
      throw new UnauthorizedException('Invalid credentials');
    }

    let tenantId = dto.tenantId ?? null;

    if (!tenantId && dto.tenantSlug) {
      const tenant = await this.tenantsService.findBySlug(dto.tenantSlug);

      if (!tenant || !tenant.isActive) {
        throw new UnauthorizedException('Tenant is required');
      }

      tenantId = tenant.id;
    }

    if (!tenantId) {
      throw new UnauthorizedException('Tenant is required');
    }

    const membership = await this.membershipsService.findActiveMembership(
      user.id,
      tenantId,
    );

    if (!membership) {
      throw new UnauthorizedException('User has no access to this tenant');
    }

    const tenant =
      membership.tenant ??
      (await this.tenantsService.findById(membership.tenantId));

    if (!tenant || !tenant.isActive) {
      throw new UnauthorizedException('User has no access to this tenant');
    }

    const refreshExpiresAt = this.tokenService.buildRefreshExpiryDate();

    const session = await this.sessionsService.createEmpty({
      userId: user.id,
      tenantId: membership.tenantId,
      expiresAt: refreshExpiresAt,
      userAgent: context?.userAgent ?? null,
      ip: context?.ip ?? null,
    });

    const tokenPair = await this.tokenService.generateTokenPair({
      userId: user.id,
      tenantId: membership.tenantId,
      roles: [membership.role],
      sessionId: session.id,
    });

    await this.sessionsService.updateRefreshToken(
      session.id,
      tokenPair.refreshToken,
    );

    return tokenPair;
  }

  async refresh(
    dto: RefreshDto,
    context?: { userAgent?: string | null; ip?: string | null },
  ): Promise<TokenPair> {
    const payload = await this.tokenService.verifyRefreshToken(dto.refreshToken);

    const currentSession = await this.sessionsService.findActiveById(payload.sid);

    if (!currentSession) {
      throw new UnauthorizedException('Session is not active');
    }

    if (this.sessionsService.isExpired(currentSession)) {
      await this.sessionsService.revokeById(currentSession.id, 'expired');
      throw new UnauthorizedException('Refresh token expired');
    }

    try {
      await this.sessionsService.assertRefreshTokenMatch(
        currentSession,
        dto.refreshToken,
      );
    } catch {
      await this.sessionsService.revokeFamily(
        currentSession.familyId,
        'refresh_token_reuse_detected',
      );
      throw new UnauthorizedException('Invalid refresh token');
    }

    const membership = await this.membershipsService.findActiveMembership(
      currentSession.userId,
      currentSession.tenantId,
    );

    if (!membership) {
      await this.sessionsService.revokeFamily(
        currentSession.familyId,
        'membership_revoked',
      );
      throw new UnauthorizedException('Membership is no longer active');
    }

    const refreshExpiresAt = this.tokenService.buildRefreshExpiryDate();

    const nextSession = await this.sessionsService.createEmpty({
      userId: currentSession.userId,
      tenantId: currentSession.tenantId,
      familyId: currentSession.familyId,
      expiresAt: refreshExpiresAt,
      userAgent: context?.userAgent ?? currentSession.userAgent,
      ip: context?.ip ?? currentSession.ip,
    });

    const tokenPair = await this.tokenService.generateTokenPair({
      userId: nextSession.userId,
      tenantId: nextSession.tenantId,
      roles: [membership.role],
      sessionId: nextSession.id,
    });

    await this.sessionsService.updateRefreshToken(
      nextSession.id,
      tokenPair.refreshToken,
    );

    await this.sessionsService.revokeWithReplacement(
      currentSession.id,
      nextSession.id,
      'rotated',
    );

    return tokenPair;
  }

  async logout(dto: LogoutDto): Promise<void> {
    if (dto.sessionId) {
      await this.sessionsService.revokeById(dto.sessionId, 'logout');
      return;
    }

    if (dto.refreshToken) {
      const payload = await this.tokenService.verifyRefreshToken(dto.refreshToken);
      await this.sessionsService.revokeById(payload.sid, 'logout');
      return;
    }

    throw new UnauthorizedException('Refresh token or sessionId is required');
  }

  async logoutAll(userId: string): Promise<void> {
    await this.sessionsService.revokeAllForUser(userId, 'logout_all');
  }

  async me(
  userId: string,
  tenantId: string,
  sessionId?: string | null,
): Promise<AuthMeResponse> {
  const user = await this.usersService.findById(userId);
  const tenant = await this.tenantsService.findById(tenantId);
  const membership = await this.membershipsService.findActiveMembership(
    userId,
    tenantId,
  );

  if (!user || !tenant || !membership) {
    throw new UnauthorizedException('Profile not found');
  }

  return {
    user: {
      id: user.id,
      email: user.email,
      firstName: user.firstName ?? null,
      lastName: user.lastName ?? null,
    },
    tenant: {
      id: tenant.id,
      name: tenant.name,
      slug: tenant.slug,
      planCode: tenant.planCode ?? null,
    },
    roles: [membership.role],
    sessionId: sessionId ?? null,
  };
}
}