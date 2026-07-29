export type AccessTokenPayload = {
  sub: string;
  tenantId: string;
  roles: string[];
  sessionId: string;
  actorType?: 'user' | 'service_account';
  clientAppId?: string;
  serviceAccountId?: string;
  type: 'access';
};
