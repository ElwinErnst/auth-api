import type { TenantAccessSnapshot } from '../access-review-snapshot.service';
import type { AccessReviewRecommendation } from '../entities/tenant-access-review.entity';

type Expectation = {
  description: string;
  check: (recs: AccessReviewRecommendation[]) => boolean;
};

export type AccessReviewFixture = {
  name: string;
  snapshot: TenantAccessSnapshot;
  expectations: Expectation[];
  // Optional soft ceiling: fixture fails if the classifier emits more than
  // this many recommendations. Keeps the model from being verbose in
  // uninteresting cases.
  maxRecommendations?: number;
};

function containsAction(
  recs: AccessReviewRecommendation[],
  action: AccessReviewRecommendation['action'],
  subjectPrefix?: string,
): boolean {
  return recs.some(
    (r) => r.action === action && (!subjectPrefix || r.subject.startsWith(subjectPrefix)),
  );
}

function hasSeverity(
  recs: AccessReviewRecommendation[],
  severity: AccessReviewRecommendation['severity'],
): boolean {
  return recs.some((r) => r.severity === severity);
}

// ── Helpers to keep fixture bodies short ────────────────────────────────

const now = () => new Date().toISOString();
const daysAgo = (n: number) => new Date(Date.now() - n * 86400_000).toISOString();

const cleanTenant: TenantAccessSnapshot = {
  tenantId: 'clean-tenant',
  generatedAt: now(),
  windowDays: 90,
  users: [
    {
      userId: 'u1',
      email: 'owner@corp.dev',
      role: 'OWNER',
      isActive: true,
      passkeys: 2,
      lastLoginAt: daysAgo(1),
    },
    {
      userId: 'u2',
      email: 'admin@corp.dev',
      role: 'ADMIN',
      isActive: true,
      passkeys: 1,
      lastLoginAt: daysAgo(3),
    },
  ],
  serviceAccounts: [
    {
      serviceAccountId: 'sa1',
      clientAppSlug: 'main-integration',
      name: 'prod-writer',
      isActive: true,
      lastUsedAt: daysAgo(2),
      daysSinceLastUse: 2,
      hasAutoRotation: true,
      failedAuthAttempts: 0,
    },
  ],
  recentAnomalies: [],
  aggregates: {
    totalUsers: 2,
    activeUsers: 2,
    inactiveUsers: 0,
    usersWithoutPasskey: 0,
    dormantServiceAccounts: 0,
    criticalAnomaliesLastWindow: 0,
  },
};

const dormantSaTenant: TenantAccessSnapshot = {
  ...cleanTenant,
  tenantId: 'dormant-sa',
  serviceAccounts: [
    ...cleanTenant.serviceAccounts,
    {
      serviceAccountId: 'sa-old',
      clientAppSlug: 'legacy',
      name: 'unused-since-Q1',
      isActive: true,
      lastUsedAt: daysAgo(180),
      daysSinceLastUse: 180,
      hasAutoRotation: false,
      failedAuthAttempts: 0,
    },
  ],
  aggregates: { ...cleanTenant.aggregates, dormantServiceAccounts: 1 },
};

const noPasskeyPrivilegedTenant: TenantAccessSnapshot = {
  ...cleanTenant,
  tenantId: 'no-passkey',
  users: cleanTenant.users.map((u) => ({ ...u, passkeys: 0 })),
  aggregates: { ...cleanTenant.aggregates, usersWithoutPasskey: 2 },
};

const criticalAnomalyTenant: TenantAccessSnapshot = {
  ...noPasskeyPrivilegedTenant,
  tenantId: 'critical-anomaly',
  recentAnomalies: [
    {
      severity: 'critical',
      flags: ['new_ip', 'new_country'],
      country: 'RU',
      createdAt: daysAgo(2),
      loginKind: 'password',
    },
    {
      severity: 'warning',
      flags: ['new_ip', 'new_user_agent'],
      country: null,
      createdAt: daysAgo(2),
      loginKind: 'password',
    },
  ],
  aggregates: { ...noPasskeyPrivilegedTenant.aggregates, criticalAnomaliesLastWindow: 1 },
};

const failingSaTenant: TenantAccessSnapshot = {
  ...cleanTenant,
  tenantId: 'failing-sa',
  serviceAccounts: [
    {
      serviceAccountId: 'sa-bad',
      clientAppSlug: 'main-integration',
      name: 'prod-writer',
      isActive: true,
      lastUsedAt: daysAgo(1),
      daysSinceLastUse: 1,
      hasAutoRotation: false,
      failedAuthAttempts: 4,
    },
  ],
};

// ── Fixture set ─────────────────────────────────────────────────────────

export const ACCESS_REVIEW_FIXTURES: AccessReviewFixture[] = [
  {
    name: 'clean tenant, no findings',
    snapshot: cleanTenant,
    expectations: [
      {
        description: 'emits few or no recommendations (mostly info if any)',
        check: (recs) => recs.filter((r) => r.severity !== 'info').length === 0,
      },
    ],
    maxRecommendations: 3,
  },
  {
    name: 'dormant + active service account',
    snapshot: dormantSaTenant,
    expectations: [
      {
        description: 'recommends disabling the dormant SA',
        check: (recs) => containsAction(recs, 'disable_service_account', 'service_account:sa-old'),
      },
      {
        description: 'flags dormant SA with warning or critical severity',
        check: (recs) =>
          recs.some(
            (r) =>
              r.subject.startsWith('service_account:sa-old') &&
              r.severity !== 'info',
          ),
      },
    ],
  },
  {
    name: 'privileged users with no passkeys',
    snapshot: noPasskeyPrivilegedTenant,
    expectations: [
      {
        description: 'recommends action on OWNER (require_password_reset or review)',
        check: (recs) =>
          recs.some(
            (r) =>
              r.subject.startsWith('user:u1') &&
              (r.action === 'require_password_reset' ||
                r.action === 'review_manually'),
          ),
      },
      {
        description: 'flags OWNER as warning or critical',
        check: (recs) =>
          recs.some(
            (r) => r.subject.startsWith('user:u1') && r.severity !== 'info',
          ),
      },
    ],
  },
  {
    name: 'critical anomaly + no passkey OWNER',
    snapshot: criticalAnomalyTenant,
    expectations: [
      {
        description: 'emits at least one critical recommendation',
        check: (recs) => hasSeverity(recs, 'critical'),
      },
      {
        description: 'targets the OWNER user specifically',
        check: (recs) => recs.some((r) => r.subject.startsWith('user:u1')),
      },
    ],
  },
  {
    name: 'SA with failed auth attempts',
    snapshot: failingSaTenant,
    expectations: [
      {
        description: 'recommends rotating the SA secret',
        check: (recs) =>
          containsAction(recs, 'rotate_service_account_secret', 'service_account:sa-bad'),
      },
    ],
  },
];
