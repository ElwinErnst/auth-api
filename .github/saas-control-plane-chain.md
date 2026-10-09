# Auth SaaS Control-Plane PR Chain

Issue #21 tracks the Auth API foundations and internal provisioning needed by the SaaS control plane. This document is the no-merge tracker for the Auth feature-branch chain; it records order, dependencies, approved size exceptions, and verification boundaries.

## Merge policy

**Keep this tracker draft and do not merge it until all child PRs are reviewed and integrated.** Every child targets its immediate predecessor. Only this tracker ultimately targets `main`.

## Dependency order

```text
main
  └─ 📍 tracker: feat/saas-control-plane-auth
       └─ child 1: feat/saas-control-plane-auth-foundation
            └─ child 2: fix/saas-control-plane-auth-tenant-authority
                 └─ child 3: feat/saas-control-plane-auth-platform-coverage
                      └─ child 4: feat/saas-control-plane-auth-provisioning
```

| Order | Branch | Scope | Original work-unit commit | Authored changed lines | Depends on |
|------:|--------|-------|---------------------------|-----------------------:|------------|
| Tracker | `feat/saas-control-plane-auth` | Chain coordination and merge warning | New tracker-doc commit |  — | Current `main` |
| 1 | `feat/saas-control-plane-auth-foundation` | Organization and billing-account foundation | `7c4a639` | 752 | Tracker |
| 2 | `fix/saas-control-plane-auth-tenant-authority` | Enforce tenant authority before organization linking | `f320461` | 42 | Child 1 |
| 3 | `feat/saas-control-plane-auth-platform-coverage` | Authorize platform-subscription tenant coverage | `950eeb0` | 196 | Child 2 |
| 4 | `feat/saas-control-plane-auth-provisioning` | Internal idempotent, recoverable SaaS provisioning | `45679ce` | 1,031 | Child 3 |

## Size exceptions

The user explicitly approved `size:exception` for the cohesive 752-line foundation and 1,031-line provisioning units. Their tests and supporting migrations/contracts remain with the behavior they verify; do not omit tests or split coupled behavior merely to meet the 400-line guideline. The 42-line authorization fix and 196-line coverage unit remain focused children.

## Verification

For each code child, run from the Auth API repository/worktree:

```sh
npm test
npm run build
git diff --check
```

The tracker itself requires Markdown/template structural review and `git diff --check`; it changes no application behavior. Each child PR must show only its own work unit against the immediate base, include issue #21, exactly one matching `type:*` label, its exact verification results, and Chain Context with rollback boundary.

## Scope boundary

This chain covers the Auth API's organization/membership/tenant-authority, platform-coverage authorization, and internal provisioning contracts. Billing and root integration are dependent work tracked in their own repository issues. The tracker has no application code and must not be merged independently.
