import { TenantEntitlements } from '../../entitlements/entitlements.types';

export type AuthMeResponse = {
  user: {
    id: string;
    email: string;
    firstName: string | null;
    lastName: string | null;
  };
  tenant: {
    id: string;
    name: string;
    slug: string;
    planCode: string | null;
    billingBypass?: boolean;
    entitlements: TenantEntitlements;
  };
  roles: string[];
  sessionId: string | null;
};
