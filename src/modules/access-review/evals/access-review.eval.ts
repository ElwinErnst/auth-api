import 'reflect-metadata';
import Anthropic from '@anthropic-ai/sdk';
import { ConfigService } from '@nestjs/config';
import accessReviewConfig from '../../../config/access-review.config';
import { ACCESS_REVIEW_FIXTURES } from './fixtures';

/**
 * Semantic eval for the access review LLM output.
 *
 * We bypass the DB layer (no repositories) by calling Claude directly with
 * the same prompt + schema the service uses. Each fixture provides a
 * synthetic TenantAccessSnapshot and a list of predicates over the emitted
 * recommendations array. A fixture passes iff every predicate is true.
 *
 * Run:
 *   docker exec sentinel-suite-auth-api-1 \
 *     node dist/modules/access-review/evals/access-review.eval.js
 */

// Kept in sync with access-review.service.ts. Not imported to avoid pulling
// the Nest DI + repos into a plain-node runner.
const SYSTEM_PROMPT = `You are a security engineer auditing an SaaS tenant's identity + access surface for a monthly access review.
You are given a JSON snapshot with users, memberships, service accounts, passkeys, sessions and recent session anomalies.

Produce two things:
1. "report_md": a concise markdown report (3-6 short sections) covering the current risk posture, the highest-signal findings, and a summary of your recommendations. Write for a security-aware engineering lead, not a compliance auditor. No apologetics, no filler.
2. "recommendations": a machine-readable list of actionable recommendations, each with a specific subject, an action verb from the allowed enum, a severity, and a one-sentence reason grounded in the snapshot data.

Rules:
- Ground every recommendation in the snapshot. Do NOT invent facts.
- Prefer the least-privilege action. Downgrade a role before revoking; require MFA / passkey enrollment before locking accounts.
- If a service account has NO use in >60 days AND is still active, recommend "disable_service_account". If it has failed_auth_attempts >= 3, recommend "rotate_service_account_secret".
- If a user has zero passkeys and their tenant handles sensitive data, recommend "require_password_reset" or "review_manually" as appropriate.
- Keep the recommendation list SMALL (typically 3-8 items). Signal beats volume.

CRITICAL OUTPUT CONTRACT:
- Every specific concern raised in "report_md" that maps to a concrete action MUST also appear in "recommendations".
- Subjects should be specific: "user:{userId}", "service_account:{serviceAccountId}", or "passkey:{passkeyId}".`;

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

const PRICING: Record<string, { input: number; output: number }> = {
  'claude-sonnet-5': { input: 3, output: 15 },
};

async function main(): Promise<void> {
  const cfg = await accessReviewConfig();
  const configService = { get: () => cfg } as unknown as ConfigService;
  void configService; // config only used for readability of the intent

  if (!cfg.enabled || !cfg.apiKey) {
    console.error(
      'Access review disabled. Set ACCESS_REVIEW_ENABLED=true and ANTHROPIC_API_KEY.',
    );
    process.exit(1);
  }

  const client = new Anthropic({
    apiKey: cfg.apiKey,
    timeout: cfg.timeoutMs,
    maxRetries: cfg.maxRetries,
  });

  console.log(
    `Running ${ACCESS_REVIEW_FIXTURES.length} fixtures against ${cfg.model}...\n`,
  );

  const latencies: number[] = [];
  let inputTokensTotal = 0;
  let outputTokensTotal = 0;
  let generationErrors = 0;
  let fixturesPassed = 0;
  let expectationsPassed = 0;
  let expectationsTotal = 0;

  for (const fx of ACCESS_REVIEW_FIXTURES) {
    process.stdout.write(`- ${fx.name} ... `);
    try {
      const startedAt = Date.now();
      const response = await client.messages.create({
        model: cfg.model,
        max_tokens: cfg.maxTokens,
        thinking: { type: 'disabled' },
        system: SYSTEM_PROMPT,
        messages: [
          { role: 'user', content: JSON.stringify(fx.snapshot, null, 2) },
        ],
        output_config: {
          format: { type: 'json_schema', schema: RESPONSE_SCHEMA },
        },
      });
      const latency = Date.now() - startedAt;
      latencies.push(latency);
      inputTokensTotal += response.usage.input_tokens;
      outputTokensTotal += response.usage.output_tokens;

      const textBlock = response.content.find((b) => b.type === 'text');
      if (!textBlock || textBlock.type !== 'text') {
        throw new Error('no text block returned');
      }
      const parsed = JSON.parse(textBlock.text) as {
        report_md: string;
        recommendations: Array<{
          subject: string;
          action: string;
          severity: string;
          reason: string;
        }>;
      };

      const recs = parsed.recommendations as never[];
      let allPass = true;
      const failed: string[] = [];
      for (const exp of fx.expectations) {
        expectationsTotal += 1;
        if (exp.check(recs as never)) {
          expectationsPassed += 1;
        } else {
          allPass = false;
          failed.push(exp.description);
        }
      }
      if (
        fx.maxRecommendations != null &&
        parsed.recommendations.length > fx.maxRecommendations
      ) {
        allPass = false;
        failed.push(
          `exceeded maxRecommendations (${parsed.recommendations.length} > ${fx.maxRecommendations})`,
        );
      }

      if (allPass) {
        fixturesPassed += 1;
        console.log(
          `OK (${fx.expectations.length}/${fx.expectations.length}, ${parsed.recommendations.length} recs, ${latency}ms)`,
        );
      } else {
        console.log(
          `FAIL (${fx.expectations.length - failed.length}/${fx.expectations.length}, ${parsed.recommendations.length} recs, ${latency}ms)`,
        );
        for (const msg of failed) console.log(`      → ${msg}`);
      }
    } catch (err) {
      generationErrors += 1;
      console.log(`ERROR (${err instanceof Error ? err.message : String(err)})`);
    }
  }

  const p = (q: number) => {
    if (latencies.length === 0) return 0;
    const sorted = [...latencies].sort((a, b) => a - b);
    return sorted[
      Math.min(sorted.length - 1, Math.ceil((q / 100) * sorted.length) - 1)
    ];
  };
  const pricing = PRICING[cfg.model] ?? { input: 0, output: 0 };
  const totalCost =
    (inputTokensTotal / 1_000_000) * pricing.input +
    (outputTokensTotal / 1_000_000) * pricing.output;

  console.log(`\n=== Aggregate ===`);
  console.log(
    `fixtures passed:      ${fixturesPassed}/${ACCESS_REVIEW_FIXTURES.length}`,
  );
  console.log(
    `expectations passed:  ${expectationsPassed}/${expectationsTotal}`,
  );
  console.log(`generation errors:    ${generationErrors}`);
  console.log(`latency p50:          ${p(50)}ms`);
  console.log(`latency p95:          ${p(95)}ms`);
  console.log(
    `avg tokens:           in=${Math.round(inputTokensTotal / Math.max(1, latencies.length))} out=${Math.round(outputTokensTotal / Math.max(1, latencies.length))}`,
  );
  console.log(
    `total cost:           $${totalCost.toFixed(4)} (${latencies.length} generations)`,
  );
  console.log(
    `cost/review:          $${(totalCost / Math.max(1, latencies.length)).toFixed(5)}`,
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
