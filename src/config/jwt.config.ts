import { registerAs } from '@nestjs/config';

export default registerAs('jwt', () => ({
  issuer: process.env.AUTH_JWT_ISSUER ?? 'auth',
  audience: process.env.AUTH_JWT_AUDIENCE ?? 'zerotrust-api',
  accessSecret: process.env.AUTH_JWT_ACCESS_SECRET ?? 'change-me-access-secret',
  refreshSecret: process.env.AUTH_JWT_REFRESH_SECRET ?? 'change-me-refresh-secret',
  accessExpiresIn: process.env.AUTH_JWT_ACCESS_EXPIRES_IN ?? '15m',
  refreshExpiresIn: process.env.AUTH_JWT_REFRESH_EXPIRES_IN ?? '7d',
}));
