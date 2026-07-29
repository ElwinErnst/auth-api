import { registerAs } from '@nestjs/config';

export default registerAs('auth', () => ({
  bcryptRounds: Number(process.env.AUTH_BCRYPT_ROUNDS ?? 12),
  bootstrapDemoData:
    String(process.env.AUTH_BOOTSTRAP_DEMO_DATA ?? 'false') === 'true',
}));
