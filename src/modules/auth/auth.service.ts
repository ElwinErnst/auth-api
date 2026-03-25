import {
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { MembershipsService } from '../memberships/memberships.service';
import { SessionsService } from '../sessions/sessions.service';
import { TenantsService } from '../tenants/tenants.service';
import { UsersService } from '../users/users.service';
import { LoginDto } from './dto/login.dto';
import { LogoutDto } from './dto/logout.dto';
import { RefreshDto } from './dto/refresh.dto';
import { PasswordService } from './password.service';
import { TokenService } from './token.service';
import { AuthMeResponse } from './types/auth-me-response.type';
import { AccessTokenPayload } from './types/access-token-payload.type';
import { TokenPair } from './types/token-pair.type';

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly tenantsService: TenantsService,
    private readonly membershipsService: MembershipsService,
    private readonly sessionsService: SessionsService,
    private readonly passwordService: PasswordService,
    private readonly tokenService: TokenService,
  ) {}

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

    let tenantId = dto.tenantId;

    if (!tenantId && dto.tenantSlug) {
      const tenant = await this.tenantsService.findBySlug(dto.tenantSlug);
      tenantId = tenant?.id;
    }

    if (!tenantId) {
      throw new UnauthorizedException('Tenant is required');
    }

    const membership = await this.membershipsService.findActiveMembership(
      user.id,
      tenantId,
    );

    if (!membership || !membership.tenant.isActive) {
      throw new UnauthorizedException('User has no access to this tenant');
    }

    const provisionalRefreshToken = await this.tokenService.signRefreshToken({
      userId: user.id,
      tenantId: membership.tenantId,
      sessionId: 'provisional-session-id',
    });

    const session = await this.sessionsService.create({
      userId: user.id,
      tenantId: membership.tenantId,
      refreshToken: provisionalRefreshToken,
      expiresAt: this.tokenService.buildRefreshExpiryDate(),
      userAgent: context?.userAgent,
      ip: context?.ip,
    });

    const finalTokenPair = await this.tokenService.generateTokenPair({
      userId: user.id,
      tenantId: membership.tenantId,
      roles: [membership.role],
      sessionId: session.id,
    });

    // Replace provisional hash with the real token tied to the persisted session id
    await this.sessionsService.revokeById(session.id, 'replaced_provisional');
    const finalSession = await this.sessionsService.create({
      userId: user.id,
      tenantId: membership.tenantId,
      refreshToken: finalTokenPair.refreshToken,
      expiresAt: this.tokenService.buildRefreshExpiryDate(),
      familyId: session.familyId,
      userAgent: context?.userAgent,
      ip: context?.ip,
    });

    return this.tokenService.generateTokenPair({
      userId: user.id,
      tenantId: membership.tenantId,
      roles: [membership.role],
      sessionId: finalSession.id,
    });
  }

  async refresh(
    dto: RefreshDto,
    context?: { userAgent?: string | null; ip?: string | null },
  ): Promise<TokenPair> {
    const payload = await this.tokenService.verifyRefreshToken(dto.refreshToken);

    const session = await this.sessionsService.findActiveById(payload.sid);
    if (!session) {
      throw new UnauthorizedException('Session not found');
    }

    if (session.tenantId !== payload.tid || session.userId !== payload.sub) {
      throw new UnauthorizedException('Session/token mismatch');
    }

    if (this.sessionsService.isExpired(session)) {
      await this.sessionsService.revokeById(session.id, 'expired');
      throw new UnauthorizedException('Session expired');
    }

    await this.sessionsService.assertRefreshTokenMatch(session, dto.refreshToken);

    const membership = await this.membershipsService.findActiveMembership(
      session.userId,
      session.tenantId,
    );

    if (!membership) {
      throw new UnauthorizedException('Membership not found');
    }

    const provisionalRefreshToken = await this.tokenService.signRefreshToken({
      userId: session.userId,
      tenantId: session.tenantId,
      sessionId: 'provisional-session-id',
    });

    const newSession = await this.sessionsService.rotate({
      currentSession: session,
      newRefreshToken: provisionalRefreshToken,
      newExpiresAt: this.tokenService.buildRefreshExpiryDate(),
      userAgent: context?.userAgent,
      ip: context?.ip,
    });

    const tokenPair = await this.tokenService.generateTokenPair({
      userId: session.userId,
      tenantId: session.tenantId,
      roles: [membership.role],
      sessionId: newSession.id,
    });

    await this.sessionsService.revokeById(newSession.id, 'replaced_provisional');
    const finalSession = await this.sessionsService.create({
      userId: session.userId,
      tenantId: session.tenantId,
      refreshToken: tokenPair.refreshToken,
      expiresAt: this.tokenService.buildRefreshExpiryDate(),
      familyId: newSession.familyId,
      userAgent: context?.userAgent,
      ip: context?.ip,
    });

    await this.sessionsService.revokeById(session.id, 'rotated');

    return this.tokenService.generateTokenPair({
      userId: session.userId,
      tenantId: session.tenantId,
      roles: [membership.role],
      sessionId: finalSession.id,
    });
  }

  async logout(dto: LogoutDto): Promise<{ ok: boolean }> {
    if (!dto.refreshToken && !dto.sessionId) {
      throw new UnauthorizedException('refreshToken or sessionId is required');
    }

    if (dto.sessionId) {
      await this.sessionsService.revokeById(dto.sessionId, 'logout');
      return { ok: true };
    }

    const payload = await this.tokenService.verifyRefreshToken(dto.refreshToken!);
    await this.sessionsService.revokeById(payload.sid, 'logout');
    return { ok: true };
  }

  async logoutAll(currentAuth: AccessTokenPayload): Promise<{ ok: boolean }> {
    await this.sessionsService.revokeAllForUser(currentAuth.sub, 'logout_all');
    return { ok: true };
  }

  async me(currentAuth: AccessTokenPayload): Promise<AuthMeResponse> {
    const user = await this.usersService.findById(currentAuth.sub);
    const membership = await this.membershipsService.findActiveMembership(
      currentAuth.sub,
      currentAuth.tenantId,
    );

    if (!membership) {
      throw new UnauthorizedException('Membership not found');
    }

    return {
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
      },
      tenant: {
        id: membership.tenant.id,
        name: membership.tenant.name,
        slug: membership.tenant.slug,
        planCode: membership.tenant.planCode,
      },
      roles: currentAuth.roles,
      sessionId: currentAuth.sessionId,
    };
  }
}
