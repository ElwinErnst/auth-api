import {
  BadRequestException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { LessThan, Repository } from 'typeorm';
import {
  generateAuthenticationOptions,
  generateRegistrationOptions,
  verifyAuthenticationResponse,
  verifyRegistrationResponse,
} from '@simplewebauthn/server';
import type {
  AuthenticationResponseJSON,
  AuthenticatorTransportFuture,
  RegistrationResponseJSON,
} from '@simplewebauthn/server';
import { MembershipsService } from '../memberships/memberships.service';
import { SessionAnomalyService } from '../session-anomaly/session-anomaly.service';
import { SessionsService } from '../sessions/sessions.service';
import { TenantsService } from '../tenants/tenants.service';
import { TokenService } from '../auth/token.service';
import { UsersService } from '../users/users.service';
import { TokenPair } from '../auth/types/token-pair.type';
import type { WebauthnConfig } from '../../config/webauthn.config';
import { UserPasskey } from './entities/user-passkey.entity';
import { WebauthnChallenge } from './entities/webauthn-challenge.entity';

export type PasskeySummary = {
  id: string;
  friendlyName: string;
  deviceType: string;
  backedUp: boolean;
  transports: string[];
  createdAt: Date;
  lastUsedAt: Date | null;
};

@Injectable()
export class PasskeysService {
  private readonly webauthn: WebauthnConfig;

  constructor(
    @InjectRepository(UserPasskey)
    private readonly passkeys: Repository<UserPasskey>,
    @InjectRepository(WebauthnChallenge)
    private readonly challenges: Repository<WebauthnChallenge>,
    private readonly usersService: UsersService,
    private readonly tenantsService: TenantsService,
    private readonly membershipsService: MembershipsService,
    private readonly sessionsService: SessionsService,
    private readonly tokenService: TokenService,
    private readonly configService: ConfigService,
    private readonly anomalyService: SessionAnomalyService,
  ) {
    this.webauthn = this.configService.get<WebauthnConfig>('webauthn')!;
  }

  // ── Registration ───────────────────────────────────────────────

  async registrationBegin(userId: string) {
    const user = await this.usersService.findById(userId);
    if (!user) throw new UnauthorizedException('User not found');

    const existing = await this.passkeys.find({ where: { userId } });

    const options = await generateRegistrationOptions({
      rpName: this.webauthn.rpName,
      rpID: this.webauthn.rpID,
      userName: user.email,
      userDisplayName:
        [user.firstName, user.lastName].filter(Boolean).join(' ') || user.email,
      userID: Buffer.from(user.id),
      attestationType: 'none',
      excludeCredentials: existing.map((c) => ({
        id: c.credentialId.toString('base64url'),
        transports: c.transports as AuthenticatorTransportFuture[],
      })),
      authenticatorSelection: {
        residentKey: 'preferred',
        userVerification: 'preferred',
      },
    });

    await this.saveChallenge('registration', userId, options.challenge);
    return options;
  }

  async registrationFinish(
    userId: string,
    response: RegistrationResponseJSON,
    friendlyName: string,
  ): Promise<PasskeySummary> {
    if (!friendlyName || friendlyName.trim().length === 0) {
      throw new BadRequestException('friendlyName is required');
    }

    const stored = await this.consumeChallenge('registration', userId);

    const verification = await verifyRegistrationResponse({
      response,
      expectedChallenge: stored.challenge,
      expectedOrigin: this.webauthn.origins,
      expectedRPID: this.webauthn.rpID,
      requireUserVerification: false,
    });

    if (!verification.verified || !verification.registrationInfo) {
      throw new UnauthorizedException('Passkey registration failed');
    }

    const info = verification.registrationInfo;
    const credentialIdBuf = Buffer.from(info.credential.id, 'base64url');

    const duplicate = await this.passkeys.findOne({
      where: { credentialId: credentialIdBuf },
    });
    if (duplicate) {
      throw new BadRequestException('This passkey is already registered');
    }

    const row = this.passkeys.create({
      userId,
      credentialId: credentialIdBuf,
      publicKey: Buffer.from(info.credential.publicKey),
      counter: String(info.credential.counter ?? 0),
      transports: (info.credential.transports ?? []) as string[],
      deviceType: info.credentialDeviceType,
      backedUp: info.credentialBackedUp,
      friendlyName: friendlyName.trim().slice(0, 80),
      lastUsedAt: null,
    });

    const saved = await this.passkeys.save(row);
    return this.toSummary(saved);
  }

  // ── Authentication ─────────────────────────────────────────────

  async authenticationBegin(email: string, tenantSlug: string) {
    const user = await this.usersService.findByEmailWithMemberships(email);

    // Enumeration resistance: return the SAME options shape whether or not the
    // account exists. We deliberately do NOT list the user's registered
    // passkeys in `allowCredentials` — a populated list discloses that this
    // email has an account (and which authenticators it uses), which is exactly
    // the enumeration oracle we want to avoid. Registration uses
    // residentKey:'preferred', so the browser offers the user's discoverable
    // passkeys from the platform; a non-existent email simply has none to offer.
    //
    // Tradeoff: a non-discoverable credential (a rare FIDO2 key registered
    // without a resident key) will not be auto-targeted here. That is the
    // accepted cost of not leaking account existence. `tenantSlug` is validated
    // at finish, not here.
    const options = await generateAuthenticationOptions({
      rpID: this.webauthn.rpID,
      allowCredentials: [],
      userVerification: 'preferred',
    });

    await this.saveChallenge(
      'authentication',
      user?.id ?? null,
      options.challenge,
    );

    return options;
  }

  async authenticationFinish(
    response: AuthenticationResponseJSON,
    tenantSlug: string,
    context?: { userAgent?: string | null; ip?: string | null },
  ): Promise<TokenPair> {
    const credentialIdBuf = Buffer.from(response.id, 'base64url');

    const passkey = await this.passkeys.findOne({
      where: { credentialId: credentialIdBuf },
    });
    if (!passkey) throw new UnauthorizedException('Unknown passkey');

    const stored = await this.consumeChallenge('authentication', passkey.userId);

    const verification = await verifyAuthenticationResponse({
      response,
      expectedChallenge: stored.challenge,
      expectedOrigin: this.webauthn.origins,
      expectedRPID: this.webauthn.rpID,
      credential: {
        id: response.id,
        publicKey: new Uint8Array(passkey.publicKey),
        counter: Number(passkey.counter),
        transports: passkey.transports as AuthenticatorTransportFuture[],
      },
      requireUserVerification: false,
    });

    if (!verification.verified) {
      throw new UnauthorizedException('Passkey authentication failed');
    }

    const newCounter = verification.authenticationInfo.newCounter;
    if (newCounter <= Number(passkey.counter) && newCounter !== 0) {
      // Cloned authenticator or replay — burn all passkeys of this user.
      throw new UnauthorizedException(
        'Authenticator counter did not advance (possible cloned key)',
      );
    }

    passkey.counter = String(newCounter);
    passkey.lastUsedAt = new Date();
    await this.passkeys.save(passkey);

    // From here mirror the tail of auth.service.login: resolve tenant,
    // membership, create session, sign token pair.
    const tenant = await this.tenantsService.findBySlug(tenantSlug);
    if (!tenant) throw new UnauthorizedException('Tenant is required');

    const membership = await this.membershipsService.findActiveMembership(
      passkey.userId,
      tenant.id,
    );
    if (!membership) {
      throw new UnauthorizedException('User has no access to this tenant');
    }

    if (!tenant.isActive && membership.role !== 'OWNER') {
      throw new UnauthorizedException('Tenant is inactive');
    }

    const refreshExpiresAt = this.tokenService.buildRefreshExpiryDate();

    const session = await this.sessionsService.createEmpty({
      userId: passkey.userId,
      tenantId: tenant.id,
      expiresAt: refreshExpiresAt,
      userAgent: context?.userAgent ?? null,
      ip: context?.ip ?? null,
    });

    await this.anomalyService.analyze({
      userId: passkey.userId,
      tenantId: tenant.id,
      sessionId: session.id,
      ip: context?.ip ?? null,
      userAgent: context?.userAgent ?? null,
      loginKind: 'passkey',
    });

    const tokenPair = await this.tokenService.generateTokenPair({
      userId: passkey.userId,
      tenantId: tenant.id,
      roles: [membership.role],
      sessionId: session.id,
    });

    await this.sessionsService.updateRefreshToken(
      session.id,
      tokenPair.refreshToken,
    );

    return tokenPair;
  }

  // ── Management ─────────────────────────────────────────────────

  async list(userId: string): Promise<PasskeySummary[]> {
    const rows = await this.passkeys.find({
      where: { userId },
      order: { createdAt: 'DESC' },
    });
    return rows.map((r) => this.toSummary(r));
  }

  async rename(
    userId: string,
    id: string,
    friendlyName: string,
  ): Promise<PasskeySummary> {
    if (!friendlyName || friendlyName.trim().length === 0) {
      throw new BadRequestException('friendlyName is required');
    }
    const row = await this.passkeys.findOne({ where: { id, userId } });
    if (!row) throw new NotFoundException('Passkey not found');

    row.friendlyName = friendlyName.trim().slice(0, 80);
    const saved = await this.passkeys.save(row);
    return this.toSummary(saved);
  }

  async remove(userId: string, id: string): Promise<void> {
    const row = await this.passkeys.findOne({ where: { id, userId } });
    if (!row) throw new NotFoundException('Passkey not found');
    await this.passkeys.remove(row);
  }

  // ── Internal ───────────────────────────────────────────────────

  private async saveChallenge(
    kind: 'registration' | 'authentication',
    userId: string | null,
    challenge: string,
  ): Promise<void> {
    // Best-effort cleanup of stale rows so the table doesn't grow forever.
    await this.challenges.delete({ expiresAt: LessThan(new Date()) });

    const row = this.challenges.create({
      kind,
      userId,
      challenge,
      expiresAt: new Date(Date.now() + this.webauthn.challengeTtlMs),
    });
    await this.challenges.save(row);
  }

  private async consumeChallenge(
    kind: 'registration' | 'authentication',
    userId: string | null,
  ): Promise<WebauthnChallenge> {
    const row = await this.challenges.findOne({
      where: { kind, userId: userId ?? undefined },
      order: { createdAt: 'DESC' },
    });
    if (!row) throw new UnauthorizedException('No challenge in progress');
    if (row.expiresAt.getTime() < Date.now()) {
      await this.challenges.remove(row);
      throw new UnauthorizedException('Challenge expired');
    }
    // Single-use.
    await this.challenges.remove(row);
    return row;
  }

  private toSummary(row: UserPasskey): PasskeySummary {
    return {
      id: row.id,
      friendlyName: row.friendlyName,
      deviceType: row.deviceType,
      backedUp: row.backedUp,
      transports: row.transports,
      createdAt: row.createdAt,
      lastUsedAt: row.lastUsedAt,
    };
  }
}
