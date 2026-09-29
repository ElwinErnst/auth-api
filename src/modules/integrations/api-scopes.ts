/**
 * The scopes a service-account API key can hold. A scope grants permission to a
 * category of API action; the resource server (e.g. billing-api, or a research
 * client) is responsible for enforcing them against the token's `scopes` claim.
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
  // Research / growth scopes (consumed by Sytadel Growth OS, a separate client).
  'research:read',
  'research:fetch',
  'leads:read',
] as const;

export type ApiScope = (typeof API_SCOPES)[number];

/**
 * The "legacy" scope set granted to keys that predate scoping, so existing
 * callers keep working once enforcement lands. New keys are created
 * least-privilege (empty unless scopes are requested explicitly).
 *
 * This is pinned to the ORIGINAL billing-oriented scopes on purpose — it must
 * NOT track `API_SCOPES`. Newer, non-billing scopes (e.g. `research:*`,
 * `leads:*`) are deliberately excluded so they are never auto-granted to
 * pre-scoping keys.
 */
export const LEGACY_SCOPE_SET: ApiScope[] = [
  'payments:create',
  'payments:read',
  'subscriptions:create',
  'subscriptions:read',
  'refunds:create',
  'usage:write',
  'usage:read',
  'webhooks:manage',
  'billing:read',
];

export function isApiScope(value: string): value is ApiScope {
  return (API_SCOPES as readonly string[]).includes(value);
}
