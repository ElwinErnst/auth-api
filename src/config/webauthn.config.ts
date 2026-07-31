import { registerAs } from '@nestjs/config';

export type WebauthnConfig = {
  rpID: string;
  rpName: string;
  origins: string[];
  challengeTtlMs: number;
};

export default registerAs<WebauthnConfig>('webauthn', () => {
  const originsRaw =
    process.env.WEBAUTHN_ORIGINS ?? 'http://localhost:3003,http://localhost:4321';
  const origins = originsRaw
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean);

  return {
    rpID: process.env.WEBAUTHN_RP_ID ?? 'localhost',
    rpName: process.env.WEBAUTHN_RP_NAME ?? 'Sytadel',
    origins,
    challengeTtlMs: Number(process.env.WEBAUTHN_CHALLENGE_TTL_MS ?? 300000),
  };
});
