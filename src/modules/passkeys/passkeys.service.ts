import {
  BadRequestException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, IsNull, LessThan, Repository } from 'typeorm';
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
        residentKey: 'required',
        userVerification: 'required',
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

    const saved = await this.withChallenge(
      'registration',
      userId,
      async (stored, manager) => {
        const verification = await verifyRegistrationResponse({
          response,
          expectedChallenge: stored.challenge,
          expectedOrigin: this.webauthn.origins,
          expectedRPID: this.webauthn.rpID,
          requireUserVerification: true,
        });

        if (!verification.verified || !verification.registrationInfo) {
          throw new UnauthorizedException('Passkey registration failed');
        }

        const info = verification.registrationInfo;
        const credentialIdBuf = Buffer.from(info.credential.id, 'base64url');
        const passkeys = manager.getRepository(UserPasskey);
        const duplicate = await passkeys.findOne({
          where: { credentialId: credentialIdBuf },
        });
        if (duplicate) {
          throw new BadRequestException('This passkey is already registered');
        }

        const row = passkeys.create({
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
        return passkeys.save(row);
      },
    );
    return this.toSummary(saved);
  }

  // ── Authentication ─────────────────────────────────────────────

  async authenticationBegin(email: string, tenantSlug: string) {
    const startedAt = performance.now();
    const user = await this.usersService.findByEmailWithMemberships(email);

    // Enumeration resistance: return the SAME options shape whether or not the
    // account exists. We deliberately do NOT list the user's registered
    // passkeys in `allowCredentials` — a populated list discloses that this
    // email has an account (and which authenticators it uses), which is exactly
    // the enumeration oracle we want to avoid. Registration uses
    // residentKey:'required', so the browser offers the user's discoverable
    // passkeys from the platform; a non-existent email simply has none to offer.
    //
    // Registration requires discoverable credentials, so every credential
    // created by this application can be selected without disclosing IDs here.
    // `tenantSlug` is validated at finish, not here.
    const options = await generateAuthenticationOptions({
      rpID: this.webauthn.rpID,
      allowCredentials: [],
      userVerification: 'required',
    });

    await this.saveChallenge(
      'authentication',
      user?.id ?? null,
      options.challenge,
    );

    await this.waitForAuthenticationBeginFloor(startedAt);

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
    const verifiedPasskey = await this.withChallenge(
      'authentication',
      passkey.userId,
      async (stored, manager) => {
        const passkeys = manager.getRepository(UserPasskey);
        const lockedPasskey = await passkeys.findOne({
          where: { id: passkey.id },
          lock: { mode: 'pessimistic_write' },
        });
        if (!lockedPasskey) throw new UnauthorizedException('Unknown passkey');

        const storedCounter = this.parseAuthenticatorCounter(
          lockedPasskey.counter,
        );
        const verification = await verifyAuthenticationResponse({
          response,
          expectedChallenge: stored.challenge,
          expectedOrigin: this.webauthn.origins,
          expectedRPID: this.webauthn.rpID,
          credential: {
            id: response.id,
            publicKey: new Uint8Array(lockedPasskey.publicKey),
            counter: storedCounter,
            transports:
              lockedPasskey.transports as AuthenticatorTransportFuture[],
          },
          requireUserVerification: true,
        });

        if (!verification.verified) {
          throw new UnauthorizedException('Passkey authentication failed');
        }

        const newCounter = verification.authenticationInfo.newCounter;
        if (!Number.isSafeInteger(newCounter) || newCounter < 0) {
          throw new UnauthorizedException(
            'Authenticator counter is outside the supported range',
          );
        }
        if (newCounter <= storedCounter && newCounter !== 0) {
          throw new UnauthorizedException(
            'Authenticator counter did not advance (possible cloned key)',
          );
        }

        lockedPasskey.counter = String(newCounter);
        lockedPasskey.lastUsedAt = new Date();
        return passkeys.save(lockedPasskey);
      },
    );

    // From here mirror the tail of auth.service.login: resolve tenant,
    // membership, create session, sign token pair.
    const tenant = await this.tenantsService.findBySlug(tenantSlug);
    if (!tenant) throw new UnauthorizedException('Tenant is required');

    const membership = await this.membershipsService.findActiveMembership(
      verifiedPasskey.userId,
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
      userId: verifiedPasskey.userId,
      tenantId: tenant.id,
      expiresAt: refreshExpiresAt,
      userAgent: context?.userAgent ?? null,
      ip: context?.ip ?? null,
    });

    await this.anomalyService.analyze({
      userId: verifiedPasskey.userId,
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

  private async withChallenge<T>(
    kind: 'registration' | 'authentication',
    userId: string | null,
    verify: (
      challenge: WebauthnChallenge,
      manager: EntityManager,
    ) => Promise<T>,
  ): Promise<T> {
    return this.challenges.manager.transaction(async (manager) => {
      // Serialize the whole read/verify/delete sequence before PostgreSQL takes
      // the SELECT statement snapshot. FOR UPDATE alone can let a waiter retain
      // a snapshot of a row deleted by the transaction it waited for.
      await manager.query('SELECT pg_advisory_xact_lock(hashtextextended($1, 0))', [
        `${kind}:${userId ?? 'anonymous'}`,
      ]);
      const challenges = manager.getRepository(WebauthnChallenge);
      const row = await challenges.findOne({
        where: { kind, userId: userId === null ? IsNull() : userId },
        order: { createdAt: 'DESC' },
        lock: { mode: 'pessimistic_write' },
      });
      if (!row) throw new UnauthorizedException('No challenge in progress');
      if (row.expiresAt.getTime() < Date.now()) {
        await challenges.remove(row);
        throw new UnauthorizedException('Challenge expired');
      }

      // The row lock serializes concurrent finishes. A failed verification
      // rolls the transaction back and leaves the challenge available; a
      // successful verification deletes it in the same commit as state updates.
      const result = await verify(row, manager);
      await challenges.remove(row);
      return result;
    });
  }

  private parseAuthenticatorCounter(value: string): number {
    if (!/^\d+$/.test(value)) {
      throw new UnauthorizedException('Invalid authenticator counter');
    }
    const counter = Number(value);
    if (!Number.isSafeInteger(counter)) {
      throw new UnauthorizedException(
        'Authenticator counter is outside the supported range',
      );
    }
    return counter;
  }

  private async waitForAuthenticationBeginFloor(startedAt: number): Promise<void> {
    const minimum = this.webauthn.authenticationBeginMinDurationMs;
    if (!Number.isFinite(minimum) || minimum <= 0) return;

    const remaining = minimum - (performance.now() - startedAt);
    if (remaining > 0) {
      await new Promise((resolve) => setTimeout(resolve, remaining));
    }
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
