export type AccessTokenPayload = {
  sub: string;
  tenantId: string;
  roles: string[];
  sessionId: string;
  type: 'access';
};