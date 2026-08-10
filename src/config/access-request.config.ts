import { registerAs } from '@nestjs/config';

export type AccessRequestConfig = {
  enabled: boolean;
  apiKey: string | null;
  model: string;
  maxTokens: number;
  timeoutMs: number;
};

export default registerAs<AccessRequestConfig>('accessRequest', () => ({
  enabled: (process.env.ACCESS_REQUEST_ENABLED ?? 'false') === 'true',
  apiKey: process.env.ANTHROPIC_API_KEY ?? null,
  model: process.env.ACCESS_REQUEST_MODEL ?? 'claude-sonnet-5',
  maxTokens: Number(process.env.ACCESS_REQUEST_MAX_TOKENS ?? 1024),
  timeoutMs: Number(process.env.ACCESS_REQUEST_TIMEOUT_MS ?? 20000),
}));
