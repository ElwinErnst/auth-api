export type RefreshTokenPayload = {
  sub: string;
  sid: string;
  tid: string;
  iss: string;
  aud: string;
  type: 'refresh';
  iat?: number;
  exp?: number;
};
