import { registerAs } from '@nestjs/config';

export default registerAs('internal', () => ({
  serviceSecret:
    process.env.AUTH_INTERNAL_SERVICE_SECRET ?? 'change-me-internal-secret',
}));
