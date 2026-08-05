import { registerAs } from '@nestjs/config';

export type AccessReviewConfig = {
  enabled: boolean;
  apiKey: string | null;
  model: string;
  maxTokens: number;
  timeoutMs: number;
  maxRetries: number;
  // Cron expression for the auto-run. Default: 03:15 UTC daily.
  cronExpression: string;
};

export default registerAs<AccessReviewConfig>('accessReview', () => ({
  enabled: (process.env.ACCESS_REVIEW_ENABLED ?? 'false') === 'true',
  apiKey: process.env.ANTHROPIC_API_KEY ?? null,
  model: process.env.ACCESS_REVIEW_MODEL ?? 'claude-sonnet-5',
  maxTokens: Number(process.env.ACCESS_REVIEW_MAX_TOKENS ?? 4096),
  timeoutMs: Number(process.env.ACCESS_REVIEW_TIMEOUT_MS ?? 45000),
  maxRetries: Number(process.env.ACCESS_REVIEW_MAX_RETRIES ?? 1),
  cronExpression: process.env.ACCESS_REVIEW_CRON ?? '15 3 * * *',
}));
