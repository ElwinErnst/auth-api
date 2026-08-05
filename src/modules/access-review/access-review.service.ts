import Anthropic from '@anthropic-ai/sdk';
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import type { AccessReviewConfig } from '../../config/access-review.config';
import {
  AccessReviewRecommendation,
  TenantAccessReview,
} from './entities/tenant-access-review.entity';
import {
  AccessReviewSnapshotService,
  TenantAccessSnapshot,
} from './access-review-snapshot.service';

export type RunReviewInput = {
  tenantId: string;
  trigger: 'manual' | 'scheduled';
};

const PRICING: Record<string, { input: number; output: number }> = {
  'claude-sonnet-5': { input: 3, output: 15 },
};

const SYSTEM_PROMPT = `You are a security engineer auditing an SaaS tenant's identity + access surface for a monthly access review.
You are given a JSON snapshot with users, memberships, service accounts, passkeys, sessions and recent session anomalies.

Produce two things:
1. "report_md": a concise markdown report (3-6 short sections) covering the current risk posture, the highest-signal findings, and a summary of your recommendations. Write for a security-aware engineering lead, not a compliance auditor. No apologetics, no filler.
2. "recommendations": a machine-readable list of actionable recommendations, each with a specific subject, an action verb from the allowed enum, a severity, and a one-sentence reason grounded in the snapshot data.

Rules:
- Ground every recommendation in the snapshot. Do NOT invent facts. If the snapshot says "user X has never logged in", say so; if it says "service account Y has 3 failed auth attempts", cite that.
- Prefer the least-privilege action. Downgrade a role before revoking; require MFA / passkey enrollment before locking accounts.
- If a service account has NO use in >60 days AND is still active, recommend "disable_service_account". If it has failed_auth_attempts >= 3, recommend "rotate_service_account_secret".
- If a user has zero passkeys and their tenant handles sensitive data, recommend "require_password_reset" or "review_manually" as appropriate.
- If recent anomalies show new_country + new_ip on password logins for a specific role class, call it out in the report even if you don't emit a targeted recommendation.
- Keep the recommendation list SMALL (typically 3-8 items). Signal beats volume.
- Severity guidance: "critical" = clear leak surface / dormant privileged access; "warning" = risky but explainable; "info" = observation, no immediate action.

CRITICAL OUTPUT CONTRACT:
- Every specific concern you raise in "report_md" that maps to a concrete action MUST also appear as an entry in "recommendations". The report is for humans; the recommendations array is what an operator dashboard, ticketing bot or automated job consumes to actually DO something.
- The typical shape is: 3-8 recommendations, each grounded in one bullet from the report. An empty recommendations array means "no action needed" — only emit it if the tenant truly has nothing to fix.
- Subjects should be specific: use "user:{userId}", "service_account:{serviceAccountId}" or "passkey:{passkeyId}" where possible, not vague labels like "all users".`;

const RECOMMENDATION_ACTIONS = [
  'revoke_membership',
  'downgrade_role',
  'disable_service_account',
  'rotate_service_account_secret',
  'delete_passkey',
  'require_password_reset',
  'review_manually',
] as const;

const RESPONSE_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['report_md', 'recommendations'],
  properties: {
    report_md: { type: 'string', minLength: 1, maxLength: 8000 },
    recommendations: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['subject', 'action', 'severity', 'reason'],
        properties: {
          subject: { type: 'string', minLength: 1, maxLength: 200 },
          action: { type: 'string', enum: [...RECOMMENDATION_ACTIONS] },
          severity: { type: 'string', enum: ['info', 'warning', 'critical'] },
          reason: { type: 'string', minLength: 1, maxLength: 400 },
        },
      },
    },
  },
} as const;

export type RunReviewResult = {
  reviewId: string;
  status: 'succeeded' | 'failed';
  recommendationsCount: number;
  latencyMs: number;
};

@Injectable()
export class AccessReviewService {
  private readonly logger = new Logger(AccessReviewService.name);
  private readonly config: AccessReviewConfig;
  private readonly client: Anthropic | null;

  constructor(
    private readonly configService: ConfigService,
    private readonly snapshotService: AccessReviewSnapshotService,
    @InjectRepository(TenantAccessReview)
    private readonly reviews: Repository<TenantAccessReview>,
  ) {
    this.config = this.configService.get<AccessReviewConfig>('accessReview')!;
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
        'Access review enabled but ANTHROPIC_API_KEY is missing; runs will fail.',
      );
    }
  }

  get isEnabled(): boolean {
    return this.client !== null;
  }

  async run(input: RunReviewInput): Promise<RunReviewResult> {
    if (!this.client) {
      throw new Error(
        'Access review is not configured (disabled or missing API key).',
      );
    }

    const snapshot = await this.snapshotService.collect(input.tenantId);

    const row = this.reviews.create({
      tenantId: input.tenantId,
      trigger: input.trigger,
      status: 'pending',
      snapshot: snapshot as unknown as Record<string, unknown>,
    });
    await this.reviews.save(row);

    const startedAt = Date.now();
    try {
      const analysis = await this.callClaude(snapshot);
      const latencyMs = Date.now() - startedAt;
      const pricing = PRICING[analysis.model] ?? { input: 0, output: 0 };
      const costUsd =
        (analysis.inputTokens / 1_000_000) * pricing.input +
        (analysis.outputTokens / 1_000_000) * pricing.output;

      row.status = 'succeeded';
      row.reportMd = analysis.reportMd;
      row.recommendations = analysis.recommendations;
      row.model = analysis.model;
      row.inputTokens = analysis.inputTokens;
      row.outputTokens = analysis.outputTokens;
      row.latencyMs = latencyMs;
      row.costUsd = costUsd.toFixed(5);
      await this.reviews.save(row);

      this.logger.log(
        `access review OK tenant=${input.tenantId} trigger=${input.trigger} recommendations=${analysis.recommendations.length} latency=${latencyMs}ms cost=$${costUsd.toFixed(5)}`,
      );

      return {
        reviewId: row.id,
        status: 'succeeded',
        recommendationsCount: analysis.recommendations.length,
        latencyMs,
      };
    } catch (err) {
      const latencyMs = Date.now() - startedAt;
      row.status = 'failed';
      row.error = err instanceof Error ? err.message : String(err);
      row.latencyMs = latencyMs;
      await this.reviews.save(row).catch(() => undefined);

      this.logger.error(
        `access review FAILED tenant=${input.tenantId} trigger=${input.trigger}: ${row.error}`,
      );
      return {
        reviewId: row.id,
        status: 'failed',
        recommendationsCount: 0,
        latencyMs,
      };
    }
  }

  async listForTenant(tenantId: string, limit = 20) {
    return this.reviews.find({
      where: { tenantId },
      order: { createdAt: 'DESC' },
      take: limit,
    });
  }

  async latestForTenant(tenantId: string): Promise<TenantAccessReview | null> {
    return (
      (await this.reviews.findOne({
        where: { tenantId },
        order: { createdAt: 'DESC' },
      })) ?? null
    );
  }

  private async callClaude(snapshot: TenantAccessSnapshot): Promise<{
    reportMd: string;
    recommendations: AccessReviewRecommendation[];
    model: string;
    inputTokens: number;
    outputTokens: number;
  }> {
    const response = await this.client!.messages.create({
      model: this.config.model,
      max_tokens: this.config.maxTokens,
      thinking: { type: 'disabled' },
      system: SYSTEM_PROMPT,
      messages: [
        { role: 'user', content: JSON.stringify(snapshot, null, 2) },
      ],
      output_config: {
        format: { type: 'json_schema', schema: RESPONSE_SCHEMA },
      },
    });

    const textBlock = response.content.find((b) => b.type === 'text');
    if (!textBlock || textBlock.type !== 'text') {
      throw new Error(
        `Claude returned no text block (stop_reason=${response.stop_reason})`,
      );
    }

    const raw = JSON.parse(textBlock.text) as {
      report_md: string;
      recommendations: AccessReviewRecommendation[];
    };

    return {
      reportMd: raw.report_md,
      recommendations: raw.recommendations,
      model: response.model,
      inputTokens: response.usage.input_tokens,
      outputTokens: response.usage.output_tokens,
    };
  }
}
