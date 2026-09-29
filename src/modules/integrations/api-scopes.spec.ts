import { API_SCOPES, isApiScope, LEGACY_SCOPE_SET } from './api-scopes';

describe('api-scopes allowlist', () => {
  const researchScopes = ['research:read', 'research:fetch', 'leads:read'];

  it('includes the research/growth scopes', () => {
    for (const scope of researchScopes) {
      expect(API_SCOPES as readonly string[]).toContain(scope);
    }
  });

  it('recognizes known scopes and rejects unknown ones', () => {
    expect(isApiScope('research:read')).toBe(true);
    expect(isApiScope('research:fetch')).toBe(true);
    expect(isApiScope('leads:read')).toBe(true);
    expect(isApiScope('billing:read')).toBe(true);
    expect(isApiScope('totally:madeup')).toBe(false);
    expect(isApiScope('research:write')).toBe(false);
  });

  it('has no duplicate scopes', () => {
    expect(new Set(API_SCOPES).size).toBe(API_SCOPES.length);
  });

  it('never auto-grants research/growth scopes to legacy keys', () => {
    for (const scope of researchScopes) {
      expect(LEGACY_SCOPE_SET).not.toContain(scope);
    }
    // Legacy set stays billing-only.
    expect(LEGACY_SCOPE_SET).toContain('billing:read');
    expect(LEGACY_SCOPE_SET.every((s) => isApiScope(s))).toBe(true);
  });
});
