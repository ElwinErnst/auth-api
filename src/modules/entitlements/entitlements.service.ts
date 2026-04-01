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
    const source =
      PLAN_ENTITLEMENTS[normalizedPlanCode] == null
        ? 'legacy_defaults'
        : tenant.vaultsEnabled !== planCatalog.features.vaults ||
            tenant.ztPoliciesEnabled !== planCatalog.features.ztPolicies ||
            tenant.maxVaults !== planCatalog.limits.maxVaults ||
            (tenant.maxUsers ?? null) !== planCatalog.limits.maxUsers ||
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
      },
      limits: {
        ...planCatalog.limits,
        maxVaults: tenant.maxVaults,
        maxUsers: tenant.maxUsers ?? planCatalog.limits.maxUsers,
        monthlyNotaryRequests:
          tenant.monthlyNotaryRequests ?? planCatalog.limits.monthlyNotaryRequests,
        auditRetentionDays:
          tenant.auditRetentionDays ?? planCatalog.limits.auditRetentionDays,
      },
      addonsAllowed: [...planCatalog.addonsAllowed],
      source,
    };
  }

  attachToTenant(tenant: TenantRecordLike): TenantWithEntitlements {
    return {
      id: tenant.id,
      name: tenant.name,
      slug: tenant.slug,
      planCode: tenant.planCode ?? null,
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
}
