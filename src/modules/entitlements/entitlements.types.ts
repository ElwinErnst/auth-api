import { Tenant } from '../tenants/entities/tenant.entity';

export type EntitlementFeatureKey =
  | 'vaults'
  | 'ztPolicies'
  | 'digitalNotary'
  | 'auditExport'
  | 'customBranding'
  | 'sso'
  | 'apiAuth'
  | 'apiVault'
  | 'apiZeroTrust';

export type EntitlementApiAddonCode =
  | 'AUTH_API'
  | 'VAULT_API'
  | 'ZERO_TRUST_API';

export type EntitlementLimitKey =
  | 'maxVaults'
  | 'maxUsers'
  | 'auditRetentionDays'
  | 'monthlyNotaryRequests'
  | 'maxClientApps'
  | 'maxServiceAccounts';

export type EntitlementCatalog = {
  features: Record<EntitlementFeatureKey, boolean>;
  limits: Record<EntitlementLimitKey, number | null>;
  addonsAllowed: string[];
};

export type TenantEntitlements = {
  planCode: string;
  features: Record<EntitlementFeatureKey, boolean>;
  limits: Record<EntitlementLimitKey, number | null>;
  addonsAllowed: string[];
  apiAddons: EntitlementApiAddonCode[];
  source:
    | 'catalog'
    | 'catalog_with_legacy_overrides'
    | 'legacy_defaults'
    | 'billing_bypass';
};

export type TenantWithEntitlements = {
  id: string;
  name: string;
  slug: string;
  planCode: string | null;
  billingBypass?: boolean;
  isActive?: boolean;
  createdAt?: string;
  updatedAt?: string;
  entitlements: TenantEntitlements;
};

export const PLAN_ENTITLEMENTS: Record<string, EntitlementCatalog> = {
  FREE: {
    features: {
      vaults: true,
      ztPolicies: false,
      digitalNotary: false,
      auditExport: false,
      customBranding: false,
      sso: false,
      apiAuth: false,
      apiVault: false,
      apiZeroTrust: false,
    },
    limits: {
      maxVaults: 1,
      maxUsers: 3,
      auditRetentionDays: 30,
      monthlyNotaryRequests: 0,
      maxClientApps: 0,
      maxServiceAccounts: 0,
    },
    addonsAllowed: [],
  },
  BASE: {
    features: {
      vaults: true,
      ztPolicies: true,
      digitalNotary: true,
      auditExport: true,
      customBranding: false,
      sso: false,
      apiAuth: false,
      apiVault: false,
      apiZeroTrust: false,
    },
    limits: {
      maxVaults: 3,
      maxUsers: 10,
      auditRetentionDays: 90,
      monthlyNotaryRequests: 100,
      maxClientApps: 0,
      maxServiceAccounts: 0,
    },
    addonsAllowed: ['extra_vaults', 'extra_users'],
  },
  GROWTH: {
    features: {
      vaults: true,
      ztPolicies: true,
      digitalNotary: false,
      auditExport: true,
      customBranding: false,
      sso: false,
      apiAuth: false,
      apiVault: false,
      apiZeroTrust: false,
    },
    limits: {
      maxVaults: 5,
      maxUsers: 15,
      auditRetentionDays: 90,
      monthlyNotaryRequests: 100,
      maxClientApps: 0,
      maxServiceAccounts: 0,
    },
    addonsAllowed: ['extra_vaults', 'extra_users'],
  },
  BUSINESS: {
    features: {
      vaults: true,
      ztPolicies: true,
      digitalNotary: true,
      auditExport: true,
      customBranding: true,
      sso: false,
      apiAuth: false,
      apiVault: false,
      apiZeroTrust: false,
    },
    limits: {
      maxVaults: 10,
      maxUsers: 50,
      auditRetentionDays: 365,
      monthlyNotaryRequests: 1000,
      maxClientApps: 0,
      maxServiceAccounts: 0,
    },
    addonsAllowed: [
      'extra_vaults',
      'extra_users',
      'extra_notary_volume',
      'AUTH_API',
      'VAULT_API',
      'ZERO_TRUST_API',
    ],
  },
  CUSTOM: {
    features: {
      vaults: true,
      ztPolicies: true,
      digitalNotary: true,
      auditExport: true,
      customBranding: true,
      sso: true,
      apiAuth: false,
      apiVault: false,
      apiZeroTrust: false,
    },
    limits: {
      maxVaults: null,
      maxUsers: null,
      auditRetentionDays: null,
      monthlyNotaryRequests: null,
      maxClientApps: null,
      maxServiceAccounts: null,
    },
    addonsAllowed: [
      'extra_vaults',
      'extra_users',
      'extra_notary_volume',
      'dedicated_support',
      'AUTH_API',
      'VAULT_API',
      'ZERO_TRUST_API',
    ],
  },
  ENTERPRISE: {
    features: {
      vaults: true,
      ztPolicies: true,
      digitalNotary: true,
      auditExport: true,
      customBranding: true,
      sso: true,
      apiAuth: false,
      apiVault: false,
      apiZeroTrust: false,
    },
    limits: {
      maxVaults: null,
      maxUsers: null,
      auditRetentionDays: null,
      monthlyNotaryRequests: null,
      maxClientApps: null,
      maxServiceAccounts: null,
    },
    addonsAllowed: [
      'extra_vaults',
      'extra_users',
      'extra_notary_volume',
      'dedicated_support',
      'AUTH_API',
      'VAULT_API',
      'ZERO_TRUST_API',
    ],
  },
};

export const LEGACY_FALLBACK_PLAN: EntitlementCatalog = {
  features: {
    vaults: false,
    ztPolicies: false,
    digitalNotary: false,
    auditExport: false,
    customBranding: false,
    sso: false,
    apiAuth: false,
    apiVault: false,
    apiZeroTrust: false,
  },
  limits: {
    maxVaults: 0,
    maxUsers: null,
    auditRetentionDays: 30,
    monthlyNotaryRequests: 0,
    maxClientApps: 0,
    maxServiceAccounts: 0,
  },
  addonsAllowed: [],
};

export type TenantRecordLike = Pick<
  Tenant,
  | 'id'
  | 'name'
  | 'slug'
  | 'planCode'
  | 'ztPoliciesEnabled'
  | 'vaultsEnabled'
  | 'maxVaults'
  | 'maxUsers'
  | 'monthlyNotaryRequests'
  | 'maxClientApps'
  | 'maxServiceAccounts'
  | 'auditRetentionDays'
  | 'apiAddons'
  | 'billingBypass'
> & {
  isActive?: boolean;
  createdAt?: Date;
  updatedAt?: Date;
};
