import Anthropic from '@anthropic-ai/sdk';
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AnomalyClassifierConfig } from '../../config/anomaly-classifier.config';
import { SessionAnomalyClassification } from './entities/session-anomaly-classification.entity';
import { SessionAnomalyEvent } from './entities/session-anomaly-event.entity';
import {
  AnomalyHistorySummary,
  AnomalyPersistedEvent,
} from './types/anomaly-persisted.event';

/**
 * Signals the classifier reasons over — a subset of the persisted anomaly event
 * plus the compact history summary. Kept as a Pick so the eval harness can pass
 * plain fixtures without constructing a full entity.
 */
export type AnomalySignals = Pick<
  SessionAnomalyEvent,
  | 'flags'
  | 'score'
  | 'severity'
  | 'country'
  | 'city'
  | 'loginKind'
  | 'userAgent'
>;

export type ClassificationOutput = {
  label: 'legitimate' | 'suspicious' | 'critical';
  confidence: number;
  rationale: string;
  recommended_action: 'allow' | 'step_up_auth' | 'alert' | 'block';
};

export type ClassificationResult = {
  output: ClassificationOutput;
  model: string;
  inputTokens: number;
  outputTokens: number;
};

const OUTPUT_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['label', 'confidence', 'rationale', 'recommended_action'],
  properties: {
    label: {
      type: 'string',
      enum: ['legitimate', 'suspicious', 'critical'],
    },
    confidence: { type: 'number' },
    rationale: { type: 'string' },
    recommended_action: {
      type: 'string',
      enum: ['allow', 'step_up_auth', 'alert', 'block'],
    },
  },
} as const;

const SYSTEM_PROMPT = `You are a security analyst classifying login anomaly events for a Zero Trust platform.
Given the signals from a rule-based anomaly detector, classify the event and recommend an action.

Labels:
- "legitimate": the anomaly is very likely benign (e.g. a user travelling, or a new device they own).
- "suspicious": the pattern is unusual and warrants extra verification but is not clearly an attack.
- "critical": the pattern strongly suggests account takeover or an active attack.

Recommended actions:
- "allow": no action needed.
- "step_up_auth": require re-verification (MFA / passkey) before continuing.
- "alert": notify the user and/or security team, but do not block.
- "block": block the session outright.

Judge only from the provided signals. Be conservative about "critical" — reserve it for strong evidence
(e.g. a new country together with a new IP and a new device, or a high score). A passkey login is stronger
evidence of legitimacy than a password login. "confidence" is your certainty in the label, from 0 to 1.`;

@Injectable()
export class AnomalyClassifierService {
  private readonly logger = new Logger(AnomalyClassifierService.name);
  private readonly config: AnomalyClassifierConfig;
  private readonly client: Anthropic | null;

  constructor(
    private readonly configService: ConfigService,
    @InjectRepository(SessionAnomalyClassification)
    private readonly classifications: Repository<SessionAnomalyClassification>,
    @InjectRepository(SessionAnomalyEvent)
    private readonly events: Repository<SessionAnomalyEvent>,
  ) {
    this.config =
      this.configService.get<AnomalyClassifierConfig>('anomalyClassifier')!;
    this.client =
      this.config.enabled && this.config.apiKey
        ? new Anthropic({
            apiKey: this.config.apiKey,
            timeout: this.config.timeoutMs,
            maxRetries: this.config.maxRetries,
          })
        : null;

    if (this.config.enabled && !this.client) {
      this.logger.warn(
        'Anomaly classifier enabled but ANTHROPIC_API_KEY is missing; classification is disabled.',
      );
    }
  }

  get isEnabled(): boolean {
    return this.client !== null;
  }

  /**
   * Off-login-path classification of a persisted anomaly event. Safe to fail:
   * on any error the classification row is left `failed`/`pending`, and the
   * source event and the login flow are never affected.
   */
  async classifyPersisted(payload: AnomalyPersistedEvent): Promise<void> {
    if (!this.client) return;

    let event: SessionAnomalyEvent | null;
    let row: SessionAnomalyClassification;
    try {
      event = await this.events.findOne({ where: { id: payload.eventId } });
      if (!event) {
        this.logger.warn(
          `Anomaly event ${payload.eventId} not found; skipping classification.`,
        );
        return;
      }
      row = await this.classifications.save(
        this.classifications.create({ eventId: event.id, status: 'pending' }),
      );
    } catch (err) {
      this.logger.error(
        `Failed to open classification for anomaly ${payload.eventId}: ${errMessage(err)}`,
      );
      return;
    }

    const startedAt = Date.now();
    try {
      const result = await this.classify(event, payload.history);
      row.status = 'classified';
      row.label = result.output.label;
      row.confidence = result.output.confidence;
      row.rationale = result.output.rationale;
      row.recommendedAction = result.output.recommended_action;
      row.model = result.model;
      row.inputTokens = result.inputTokens;
      row.outputTokens = result.outputTokens;
      row.latencyMs = Date.now() - startedAt;
      await this.classifications.save(row);
      this.logger.log(
        `Classified anomaly ${event.id}: ${row.label} (confidence=${row.confidence}, action=${row.recommendedAction}, ${row.latencyMs}ms)`,
      );
    } catch (err) {
      row.status = 'failed';
      row.latencyMs = Date.now() - startedAt;
      row.error = errMessage(err);
      await this.classifications.save(row).catch(() => undefined);
      this.logger.error(`Failed to classify anomaly ${event.id}: ${row.error}`);
    }
  }

  /**
   * Classify raw signals with Claude. Used by `classifyPersisted` and by the
   * eval harness — no database access.
   */
  async classify(
    signals: AnomalySignals,
    history: AnomalyHistorySummary,
  ): Promise<ClassificationResult> {
    if (!this.client) {
      throw new Error(
        'Anomaly classifier is not configured (disabled or missing API key).',
      );
    }

    const userContent = JSON.stringify(
      {
        detector_signals: {
          flags: signals.flags,
          score: signals.score,
          severity: signals.severity,
          login_kind: signals.loginKind,
          geo: { country: signals.country, city: signals.city },
        },
        user_recent_history: {
          logins_in_window: history.total,
          distinct_ips: history.distinctIps,
          distinct_countries: history.distinctCountries,
          distinct_devices: history.distinctUserAgents,
        },
      },
      null,
      2,
    );

    const response = await this.client.messages.create({
      model: this.config.model,
      max_tokens: this.config.maxTokens,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: userContent }],
      output_config: {
        format: { type: 'json_schema', schema: OUTPUT_SCHEMA },
      },
    });

    const textBlock = response.content.find((b) => b.type === 'text');
    if (!textBlock || textBlock.type !== 'text') {
      throw new Error(
        `Claude returned no text block (stop_reason=${response.stop_reason}).`,
      );
    }

    return {
      output: JSON.parse(textBlock.text) as ClassificationOutput,
      model: response.model,
      inputTokens: response.usage.input_tokens,
      outputTokens: response.usage.output_tokens,
    };
  }
}

function errMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}
