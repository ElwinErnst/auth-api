/**
 * The scopes a service-account API key can hold. A scope grants permission to a
 * category of billing/API action; the resource server (e.g. billing-api) is
 * responsible for enforcing them against the token's `scopes` claim.
 *
 * Kept as a closed allowlist on purpose: unknown scopes are rejected at key
 * creation so a typo can never silently widen access.
 */
export const API_SCOPES = [
  'payments:create',
  'payments:read',
  'subscriptions:create',
  'subscriptions:read',
  'refunds:create',
  'usage:write',
  'usage:read',
  'webhooks:manage',
  'billing:read',
] as const;

export type ApiScope = (typeof API_SCOPES)[number];

/**
 * The broad "legacy" scope set granted to keys that predate scoping, so
 * existing callers keep working once enforcement lands. New keys are created
 * least-privilege (empty unless scopes are requested explicitly).
 */
export const LEGACY_SCOPE_SET: ApiScope[] = [...API_SCOPES];

export function isApiScope(value: string): value is ApiScope {
  return (API_SCOPES as readonly string[]).includes(value);
}
