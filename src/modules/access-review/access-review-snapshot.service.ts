import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { MoreThan, Repository } from 'typeorm';
import { TenantMembership } from '../memberships/entities/tenant-membership.entity';
import { Session } from '../sessions/entities/session.entity';
import { UserPasskey } from '../passkeys/entities/user-passkey.entity';
import { ServiceAccount } from '../integrations/entities/service-account.entity';
import { ClientApp } from '../integrations/entities/client-app.entity';
import { SessionAnomalyEvent } from '../session-anomaly/entities/session-anomaly-event.entity';

/**
 * Shape handed to the LLM. Only fields the model needs to reason about
 * access risk — no secrets, no hashes, no raw tokens.
 */
export type TenantAccessSnapshot = {
  tenantId: string;
  generatedAt: string;
  windowDays: number;
  users: Array<{
    userId: string;
    email: string;
    role: 'OWNER' | 'ADMIN' | 'MEMBER';
    isActive: boolean;
    passkeys: number;
    lastLoginAt: string | null;
  }>;
  serviceAccounts: Array<{
    serviceAccountId: string;
    clientAppSlug: string;
    name: string;
    isActive: boolean;
    lastUsedAt: string | null;
    daysSinceLastUse: number | null;
    hasAutoRotation: boolean;
    failedAuthAttempts: number;
  }>;
  recentAnomalies: Array<{
    severity: 'info' | 'warning' | 'critical';
    flags: string[];
    country: string | null;
    createdAt: string;
    loginKind: 'password' | 'passkey';
  }>;
  aggregates: {
    totalUsers: number;
    activeUsers: number;
    inactiveUsers: number;
    usersWithoutPasskey: number;
    dormantServiceAccounts: number; // no use in last 60 days
    criticalAnomaliesLastWindow: number;
  };
};

const HISTORY_WINDOW_DAYS = 90;
const DORMANT_SA_DAYS = 60;

@Injectable()
export class AccessReviewSnapshotService {
  constructor(
    @InjectRepository(TenantMembership)
    private readonly memberships: Repository<TenantMembership>,
    @InjectRepository(Session)
    private readonly sessions: Repository<Session>,
    @InjectRepository(UserPasskey)
    private readonly passkeys: Repository<UserPasskey>,
    @InjectRepository(ServiceAccount)
    private readonly serviceAccounts: Repository<ServiceAccount>,
    @InjectRepository(ClientApp)
    private readonly clientApps: Repository<ClientApp>,
    @InjectRepository(SessionAnomalyEvent)
    private readonly anomalies: Repository<SessionAnomalyEvent>,
  ) {}

  async collect(tenantId: string): Promise<TenantAccessSnapshot> {
    const memberships = await this.memberships.find({
      where: { tenantId },
      relations: ['user'],
    });

    const activeUserIds = memberships.map((m) => m.userId);

    const [
      lastLoginByUser,
      passkeysByUser,
      serviceAccounts,
      clientApps,
      recentAnomalies,
    ] = await Promise.all([
      this.buildLastLoginByUser(activeUserIds),
      this.buildPasskeysByUser(activeUserIds),
      this.serviceAccounts.find({ where: { tenantId } }),
      this.clientApps.find({ where: { tenantId } }),
      this.anomalies.find({
        where: {
          tenantId,
          createdAt: MoreThan(
            new Date(Date.now() - HISTORY_WINDOW_DAYS * 86400 * 1000),
          ),
        },
        order: { createdAt: 'DESC' },
        take: 100,
      }),
    ]);

    const clientAppSlugById = new Map(clientApps.map((a) => [a.id, a.slug]));

    const users = memberships.map((m) => ({
      userId: m.userId,
      email: m.user?.email ?? '(unknown)',
      role: m.role as 'OWNER' | 'ADMIN' | 'MEMBER',
      isActive: m.isActive,
      passkeys: passkeysByUser.get(m.userId) ?? 0,
      lastLoginAt: lastLoginByUser.get(m.userId)?.toISOString() ?? null,
    }));

    const serviceAccountsSummary = serviceAccounts.map((sa) => {
      const daysSince = sa.lastUsedAt
        ? Math.floor(
            (Date.now() - new Date(sa.lastUsedAt).getTime()) / 86400_000,
          )
        : null;
      return {
        serviceAccountId: sa.id,
        clientAppSlug: clientAppSlugById.get(sa.clientAppId) ?? '(unknown)',
        name: sa.name,
        isActive: sa.isActive,
        lastUsedAt: sa.lastUsedAt ? new Date(sa.lastUsedAt).toISOString() : null,
        daysSinceLastUse: daysSince,
        hasAutoRotation: sa.rotationIntervalDays != null,
        failedAuthAttempts: sa.failedAuthAttempts ?? 0,
      };
    });

    const anomaliesSummary = recentAnomalies.slice(0, 20).map((a) => ({
      severity: a.severity,
      flags: a.flags,
      country: a.country,
      createdAt: a.createdAt.toISOString(),
      loginKind: a.loginKind,
    }));

    const aggregates = {
      totalUsers: users.length,
      activeUsers: users.filter((u) => u.isActive).length,
      inactiveUsers: users.filter((u) => !u.isActive).length,
      usersWithoutPasskey: users.filter((u) => u.passkeys === 0).length,
      dormantServiceAccounts: serviceAccountsSummary.filter(
        (sa) => sa.daysSinceLastUse == null || sa.daysSinceLastUse > DORMANT_SA_DAYS,
      ).length,
      criticalAnomaliesLastWindow: recentAnomalies.filter(
        (a) => a.severity === 'critical',
      ).length,
    };

    return {
      tenantId,
      generatedAt: new Date().toISOString(),
      windowDays: HISTORY_WINDOW_DAYS,
      users,
      serviceAccounts: serviceAccountsSummary,
      recentAnomalies: anomaliesSummary,
      aggregates,
    };
  }

  private async buildLastLoginByUser(
    userIds: string[],
  ): Promise<Map<string, Date>> {
    if (userIds.length === 0) return new Map();
    // Latest session createdAt per user is a good proxy for "last login".
    const rows = await this.sessions
      .createQueryBuilder('s')
      .select('s.user_id', 'userId')
      .addSelect('MAX(s.created_at)', 'lastLogin')
      .where('s.user_id IN (:...userIds)', { userIds })
      .groupBy('s.user_id')
      .getRawMany<{ userId: string; lastLogin: Date }>();
    return new Map(rows.map((r) => [r.userId, new Date(r.lastLogin)]));
  }

  private async buildPasskeysByUser(
    userIds: string[],
  ): Promise<Map<string, number>> {
    if (userIds.length === 0) return new Map();
    const rows = await this.passkeys
      .createQueryBuilder('p')
      .select('p.user_id', 'userId')
      .addSelect('COUNT(*)', 'count')
      .where('p.user_id IN (:...userIds)', { userIds })
      .groupBy('p.user_id')
      .getRawMany<{ userId: string; count: string }>();
    return new Map(rows.map((r) => [r.userId, Number(r.count)]));
  }
}
