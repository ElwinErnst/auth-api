export type AccessTokenPayload = {
  sub: string;
  iss: string;
  aud: string;
  tenantId: string;
  roles: string[];
  sessionId: string;
  type: 'access';
};
