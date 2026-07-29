import { registerAs } from '@nestjs/config';

function readSecret(envName: string, fallback: string) {
  const value = process.env[envName]?.trim();
  if (value) return value;

  const runtime = process.env.NODE_ENV ?? 'development';
  if (runtime === 'development' || runtime === 'test') {
    return fallback;
  }

  throw new Error(`${envName} must be configured outside development/test`);
}

export default registerAs('jwt', () => ({
  issuer: process.env.AUTH_JWT_ISSUER ?? 'auth',
  audience: process.env.AUTH_JWT_AUDIENCE ?? 'zerotrust-api',
  accessSecret: readSecret('AUTH_JWT_ACCESS_SECRET', 'change-me-access-secret'),
  refreshSecret: readSecret(
    'AUTH_JWT_REFRESH_SECRET',
    'change-me-refresh-secret',
  ),
  accessExpiresIn: process.env.AUTH_JWT_ACCESS_EXPIRES_IN ?? '15m',
  refreshExpiresIn: process.env.AUTH_JWT_REFRESH_EXPIRES_IN ?? '7d',
}));
