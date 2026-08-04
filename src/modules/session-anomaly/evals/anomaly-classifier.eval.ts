import 'reflect-metadata';
import { ConfigService } from '@nestjs/config';
import anomalyClassifierConfig from '../../../config/anomaly-classifier.config';
import {
  AnomalyClassifierService,
  ClassificationOutput,
} from '../anomaly-classifier.service';
import { EVAL_FIXTURES } from './fixtures';

/**
 * Offline eval harness for the LLM anomaly classifier.
 *
 * Real API calls — opt-in. Run with:
 *   ANOMALY_CLASSIFIER_ENABLED=true ANTHROPIC_API_KEY=sk-... \
 *     npx ts-node src/modules/session-anomaly/evals/anomaly-classifier.eval.ts
 *
 * Reports per-class precision/recall, a confusion matrix, accuracy, and
 * cost/latency/token stats — the numbers the M2 blog post needs.
 */

type Label = ClassificationOutput['label'];
const LABELS: Label[] = ['legitimate', 'suspicious', 'critical'];

// Pricing per 1M tokens (USD). Update if the model changes.
const PRICING: Record<string, { input: number; output: number }> = {
  'claude-sonnet-5': { input: 3, output: 15 },
  'claude-opus-4-8': { input: 5, output: 25 },
};

function percentile(values: number[], p: number): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const idx = Math.min(
    sorted.length - 1,
    Math.ceil((p / 100) * sorted.length) - 1,
  );
  return sorted[idx];
}

async function main(): Promise<void> {
  const cfg = await anomalyClassifierConfig();
  const configService = {
    get: () => cfg,
  } as unknown as ConfigService;

  // classify() never touches the repositories, so nulls are safe here.
  const service = new AnomalyClassifierService(
    configService,
    null as never,
    null as never,
  );

  if (!service.isEnabled) {
    console.error(
      'Classifier disabled. Set ANOMALY_CLASSIFIER_ENABLED=true and ANTHROPIC_API_KEY.',
    );
    process.exit(1);
  }

  console.log(
    `Running ${EVAL_FIXTURES.length} fixtures against ${cfg.model}...\n`,
  );

  // confusion[expected][predicted]
  const confusion: Record<Label, Record<Label, number>> = {
    legitimate: { legitimate: 0, suspicious: 0, critical: 0 },
    suspicious: { legitimate: 0, suspicious: 0, critical: 0 },
    critical: { legitimate: 0, suspicious: 0, critical: 0 },
  };

  const latencies: number[] = [];
  let totalInputTokens = 0;
  let totalOutputTokens = 0;
  let errors = 0;

  for (const fx of EVAL_FIXTURES) {
    const startedAt = Date.now();
    try {
      const result = await service.classify(fx.signals, fx.history);
      const latency = Date.now() - startedAt;
      latencies.push(latency);
      totalInputTokens += result.inputTokens;
      totalOutputTokens += result.outputTokens;
      confusion[fx.expected][result.output.label] += 1;

      const mark = result.output.label === fx.expected ? 'OK ' : 'MISS';
      console.log(
        `[${mark}] ${fx.name}\n       expected=${fx.expected} got=${result.output.label} ` +
          `conf=${result.output.confidence} action=${result.output.recommended_action} (${latency}ms)`,
      );
    } catch (err) {
      errors += 1;
      console.error(
        `[ERR ] ${fx.name}: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  const total = EVAL_FIXTURES.length - errors;
  const correct = LABELS.reduce((acc, l) => acc + confusion[l][l], 0);

  console.log('\n=== Confusion matrix (rows = expected, cols = predicted) ===');
  console.log(
    `${'expected \\ pred'.padEnd(16)}${LABELS.map((l) => l.padStart(12)).join('')}`,
  );
  for (const exp of LABELS) {
    console.log(
      `${exp.padEnd(16)}${LABELS.map((p) => String(confusion[exp][p]).padStart(12)).join('')}`,
    );
  }

  console.log('\n=== Per-class precision / recall ===');
  for (const label of LABELS) {
    const tp = confusion[label][label];
    const fp = LABELS.reduce(
      (acc, exp) => acc + (exp === label ? 0 : confusion[exp][label]),
      0,
    );
    const fn = LABELS.reduce(
      (acc, pred) => acc + (pred === label ? 0 : confusion[label][pred]),
      0,
    );
    const precision = tp + fp === 0 ? 0 : tp / (tp + fp);
    const recall = tp + fn === 0 ? 0 : tp / (tp + fn);
    const f1 =
      precision + recall === 0
        ? 0
        : (2 * precision * recall) / (precision + recall);
    console.log(
      `${label.padEnd(12)} precision=${precision.toFixed(2)} recall=${recall.toFixed(2)} f1=${f1.toFixed(2)}`,
    );
  }

  const price = PRICING[cfg.model];
  const costUsd = price
    ? (totalInputTokens / 1e6) * price.input +
      (totalOutputTokens / 1e6) * price.output
    : null;

  console.log('\n=== Aggregate ===');
  console.log(
    `accuracy:       ${total === 0 ? 0 : (correct / total).toFixed(3)} (${correct}/${total})`,
  );
  console.log(`errors:         ${errors}`);
  console.log(`latency p50:    ${percentile(latencies, 50)}ms`);
  console.log(`latency p95:    ${percentile(latencies, 95)}ms`);
  console.log(
    `avg tokens:     in=${total === 0 ? 0 : Math.round(totalInputTokens / total)} out=${total === 0 ? 0 : Math.round(totalOutputTokens / total)}`,
  );
  if (costUsd !== null) {
    console.log(
      `total cost:     $${costUsd.toFixed(4)} (${total} classifications)`,
    );
    console.log(
      `cost/analysis:  $${total === 0 ? '0' : (costUsd / total).toFixed(5)}`,
    );
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
