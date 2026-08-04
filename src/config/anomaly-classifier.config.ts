import { registerAs } from '@nestjs/config';

export type AnomalyClassifierConfig = {
  enabled: boolean;
  apiKey: string | null;
  model: string;
  maxTokens: number;
  timeoutMs: number;
  maxRetries: number;
};

export default registerAs<AnomalyClassifierConfig>('anomalyClassifier', () => ({
  enabled: (process.env.ANOMALY_CLASSIFIER_ENABLED ?? 'false') === 'true',
  apiKey: process.env.ANTHROPIC_API_KEY ?? null,
  // ROADMAP originally said "Sonnet 4.5"; claude-sonnet-5 is the current Sonnet.
  model: process.env.ANOMALY_CLASSIFIER_MODEL ?? 'claude-sonnet-5',
  maxTokens: Number(process.env.ANOMALY_CLASSIFIER_MAX_TOKENS ?? 512),
  timeoutMs: Number(process.env.ANOMALY_CLASSIFIER_TIMEOUT_MS ?? 15000),
  maxRetries: Number(process.env.ANOMALY_CLASSIFIER_MAX_RETRIES ?? 2),
}));
