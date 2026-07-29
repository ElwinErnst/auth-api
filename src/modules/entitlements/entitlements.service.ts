import { Injectable } from '@nestjs/common';
import {
  LEGACY_FALLBACK_PLAN,
  PLAN_ENTITLEMENTS,
  TenantEntitlements,
  TenantRecordLike,
  TenantWithEntitlements,
} from './entitlements.types';

@Injectable()
export class EntitlementsService {
  resolveForTenant(tenant: TenantRecordLike): TenantEntitlements {
    const normalizedPlanCode = (tenant.planCode ?? 'FREE').toUpperCase();
    const planCatalog =
      PLAN_ENTITLEMENTS[normalizedPlanCode] ?? LEGACY_FALLBACK_PLAN;
    const apiAddons = this.normalizeApiAddons(tenant.apiAddons);

    if (tenant.billingBypass) {
      return {
        planCode: normalizedPlanCode,
        features: {
          ...planCatalog.features,
          vaults: true,
          ztPolicies: true,
          apiAuth: true,
          apiVault: true,
          apiZeroTrust: true,
        },
        limits: {
          ...planCatalog.limits,
          maxClientApps: null,
          maxServiceAccounts: null,
        },
        addonsAllowed: [
          ...new Set([
            ...planCatalog.addonsAllowed,
            'AUTH_API',
            'VAULT_API',
            'ZERO_TRUST_API',
          ]),
        ],
        apiAddons: ['AUTH_API', 'VAULT_API', 'ZERO_TRUST_API'],
        source: 'billing_bypass',
      };
    }

    const source =
      PLAN_ENTITLEMENTS[normalizedPlanCode] == null
        ? 'legacy_defaults'
        : tenant.vaultsEnabled !== planCatalog.features.vaults ||
            tenant.ztPoliciesEnabled !== planCatalog.features.ztPolicies ||
            tenant.maxVaults !== planCatalog.limits.maxVaults ||
            (tenant.maxUsers ?? null) !== planCatalog.limits.maxUsers ||
            (tenant.maxClientApps ?? 0) !==
              (planCatalog.limits.maxClientApps ?? 0) ||
            (tenant.maxServiceAccounts ?? 0) !==
              (planCatalog.limits.maxServiceAccounts ?? 0) ||
            (tenant.monthlyNotaryRequests ?? 0) !==
              (planCatalog.limits.monthlyNotaryRequests ?? 0) ||
            (tenant.auditRetentionDays ?? 30) !==
              (planCatalog.limits.auditRetentionDays ?? 30)
          ? 'catalog_with_legacy_overrides'
          : 'catalog';

    return {
      planCode: normalizedPlanCode,
      features: {
        ...planCatalog.features,
        vaults: tenant.vaultsEnabled,
        ztPolicies: tenant.ztPoliciesEnabled,
        apiAuth: apiAddons.includes('AUTH_API'),
        apiVault: apiAddons.includes('VAULT_API'),
        apiZeroTrust: apiAddons.includes('ZERO_TRUST_API'),
      },
      limits: {
        ...planCatalog.limits,
        maxVaults: tenant.maxVaults,
        maxUsers: tenant.maxUsers ?? planCatalog.limits.maxUsers,
        maxClientApps: tenant.maxClientApps ?? planCatalog.limits.maxClientApps,
        maxServiceAccounts:
          tenant.maxServiceAccounts ?? planCatalog.limits.maxServiceAccounts,
        monthlyNotaryRequests:
          tenant.monthlyNotaryRequests ??
          planCatalog.limits.monthlyNotaryRequests,
        auditRetentionDays:
          tenant.auditRetentionDays ?? planCatalog.limits.auditRetentionDays,
      },
      addonsAllowed: [...planCatalog.addonsAllowed],
      apiAddons,
      source,
    };
  }

  attachToTenant(tenant: TenantRecordLike): TenantWithEntitlements {
    return {
      id: tenant.id,
      name: tenant.name,
      slug: tenant.slug,
      planCode: tenant.planCode ?? null,
      ...(tenant.billingBypass == null
        ? {}
        : { billingBypass: tenant.billingBypass }),
      ...(tenant.isActive == null ? {} : { isActive: tenant.isActive }),
      ...(tenant.createdAt == null
        ? {}
        : { createdAt: tenant.createdAt.toISOString() }),
      ...(tenant.updatedAt == null
        ? {}
        : { updatedAt: tenant.updatedAt.toISOString() }),
      entitlements: this.resolveForTenant(tenant),
    };
  }

  private normalizeApiAddons(apiAddons?: string[] | null) {
    const valid = new Set(['AUTH_API', 'VAULT_API', 'ZERO_TRUST_API']);
    return [
      ...new Set((apiAddons ?? []).filter((item) => valid.has(item))),
    ] as Array<'AUTH_API' | 'VAULT_API' | 'ZERO_TRUST_API'>;
  }
}
