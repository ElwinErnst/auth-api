/**
 * Normalized audit event shape shared across the suite (reference definition
 * lives here in auth-api and is mirrored by the other services' audit stores).
 * Each service owns its own audit_events table and exposes them through a
 * `GET tenants/:tenantId/audit-events` endpoint with this shape, so the console
 * can merge every system into one timeline.
 *
 * Integrity chaining (seq/prevHash/hash, as vault's audit log already does) is a
 * deliberate follow-up: the shared, tamper-evident module is extracted from
 * vault's proven mechanism once this reference shape is validated. Keeping this
 * first cut to the event data avoids designing the chain in the abstract.
 */
export type AuditSystem = 'auth' | 'billing' | 'zerotrust' | 'vault';
export type AuditCategory = 'access' | 'config' | 'decision' | 'billing';
export type AuditOutcome = 'success' | 'failure' | 'allow' | 'deny';
export type AuditActorType = 'user' | 'service_account' | 'system';

export type AuditEventInput = {
  tenantId: string;
  system: AuditSystem;
  category: AuditCategory;
  action: string;
  actorType?: AuditActorType | null;
  actorId?: string | null;
  resourceType?: string | null;
  resourceId?: string | null;
  outcome: AuditOutcome;
  detail?: Record<string, unknown> | null;
};
