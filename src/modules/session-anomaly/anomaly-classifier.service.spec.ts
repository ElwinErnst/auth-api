import Anthropic from '@anthropic-ai/sdk';
import { ConfigService } from '@nestjs/config';
import { Repository } from 'typeorm';
import { AnomalyClassifierConfig } from '../../config/anomaly-classifier.config';
import {
  AnomalyClassifierService,
  AnomalySignals,
} from './anomaly-classifier.service';
import { SessionAnomalyClassification } from './entities/session-anomaly-classification.entity';
import { SessionAnomalyEvent } from './entities/session-anomaly-event.entity';
import { AnomalyHistorySummary } from './types/anomaly-persisted.event';

jest.mock('@anthropic-ai/sdk');

const MockAnthropic = Anthropic as unknown as jest.Mock;

const SIGNALS: AnomalySignals = {
  flags: ['new_ip', 'new_country', 'new_user_agent'],
  score: 80,
  severity: 'critical',
  country: 'RU',
  city: 'Moscow',
  loginKind: 'password',
  userAgent: 'firefox|windows',
};

const HISTORY: AnomalyHistorySummary = {
  total: 50,
  distinctIps: 3,
  distinctCountries: 1,
  distinctUserAgents: 1,
};

function claudeResponse(body: Record<string, unknown>) {
  return {
    content: [{ type: 'text', text: JSON.stringify(body) }],
    model: 'claude-sonnet-5',
    stop_reason: 'end_turn',
    usage: { input_tokens: 120, output_tokens: 25 },
  };
}

function buildConfig(
  overrides: Partial<AnomalyClassifierConfig> = {},
): ConfigService {
  const cfg: AnomalyClassifierConfig = {
    enabled: true,
    apiKey: 'sk-test',
    model: 'claude-sonnet-5',
    maxTokens: 512,
    timeoutMs: 1000,
    maxRetries: 0,
    ...overrides,
  };
  return { get: () => cfg } as unknown as ConfigService;
}

function makeRepos() {
  const classifications = {
    create: jest.fn((x: Partial<SessionAnomalyClassification>) => ({ ...x })),
    save: jest.fn((x: SessionAnomalyClassification) => Promise.resolve(x)),
  };
  const events = {
    findOne: jest.fn(),
  };
  return { classifications, events };
}

// The argument of the most recent .save() call (the final persisted state).
function lastSaveArg(save: { mock: { calls: unknown[][] } }): any {
  const { calls } = save.mock;
  return calls[calls.length - 1][0];
}

describe('AnomalyClassifierService', () => {
  let create: jest.Mock;

  beforeEach(() => {
    create = jest.fn();
    MockAnthropic.mockImplementation(() => ({
      messages: { create },
    }));
  });

  afterEach(() => jest.clearAllMocks());

  it('is enabled only when flag + api key are present', () => {
    const { classifications, events } = makeRepos();
    const enabled = new AnomalyClassifierService(
      buildConfig(),
      classifications as unknown as Repository<SessionAnomalyClassification>,
      events as unknown as Repository<SessionAnomalyEvent>,
    );
    expect(enabled.isEnabled).toBe(true);

    const noKey = new AnomalyClassifierService(
      buildConfig({ apiKey: null }),
      classifications as unknown as Repository<SessionAnomalyClassification>,
      events as unknown as Repository<SessionAnomalyEvent>,
    );
    expect(noKey.isEnabled).toBe(false);
  });

  it('classify() parses structured output and disables thinking', async () => {
    create.mockResolvedValue(
      claudeResponse({
        label: 'critical',
        confidence: 0.92,
        rationale: 'new country + new IP + new device on a password login',
        recommended_action: 'block',
      }),
    );
    const { classifications, events } = makeRepos();
    const service = new AnomalyClassifierService(
      buildConfig(),
      classifications as unknown as Repository<SessionAnomalyClassification>,
      events as unknown as Repository<SessionAnomalyEvent>,
    );

    const result = await service.classify(SIGNALS, HISTORY);

    expect(result.output.label).toBe('critical');
    expect(result.output.recommended_action).toBe('block');
    expect(result.model).toBe('claude-sonnet-5');
    expect(result.inputTokens).toBe(120);
    expect(result.outputTokens).toBe(25);

    // Thinking must be disabled so the small token budget isn't spent reasoning.
    const params = create.mock.calls[0][0];
    expect(params.thinking).toEqual({ type: 'disabled' });
    expect(params.model).toBe('claude-sonnet-5');
    expect(params.output_config.format.type).toBe('json_schema');
  });

  it('classifyPersisted() records a classified row on success', async () => {
    create.mockResolvedValue(
      claudeResponse({
        label: 'suspicious',
        confidence: 0.6,
        rationale: 'unusual but not conclusive',
        recommended_action: 'step_up_auth',
      }),
    );
    const { classifications, events } = makeRepos();
    events.findOne.mockResolvedValue({ id: 'evt-1', ...SIGNALS });

    const service = new AnomalyClassifierService(
      buildConfig(),
      classifications as unknown as Repository<SessionAnomalyClassification>,
      events as unknown as Repository<SessionAnomalyEvent>,
    );

    await service.classifyPersisted({ eventId: 'evt-1', history: HISTORY });

    const lastSaved = lastSaveArg(classifications.save);
    expect(lastSaved.status).toBe('classified');
    expect(lastSaved.label).toBe('suspicious');
    expect(lastSaved.recommendedAction).toBe('step_up_auth');
    expect(lastSaved.model).toBe('claude-sonnet-5');
    expect(typeof lastSaved.latencyMs).toBe('number');
  });

  it('classifyPersisted() records a failed row when Claude throws', async () => {
    create.mockRejectedValue(new Error('boom'));
    const { classifications, events } = makeRepos();
    events.findOne.mockResolvedValue({ id: 'evt-2', ...SIGNALS });

    const service = new AnomalyClassifierService(
      buildConfig(),
      classifications as unknown as Repository<SessionAnomalyClassification>,
      events as unknown as Repository<SessionAnomalyEvent>,
    );

    // Must not throw — failure is contained off the login path.
    await expect(
      service.classifyPersisted({ eventId: 'evt-2', history: HISTORY }),
    ).resolves.toBeUndefined();

    const lastSaved = lastSaveArg(classifications.save);
    expect(lastSaved.status).toBe('failed');
    expect(lastSaved.error).toBe('boom');
  });

  it('classifyPersisted() is a no-op when disabled', async () => {
    const { classifications, events } = makeRepos();
    const service = new AnomalyClassifierService(
      buildConfig({ enabled: false }),
      classifications as unknown as Repository<SessionAnomalyClassification>,
      events as unknown as Repository<SessionAnomalyEvent>,
    );

    await service.classifyPersisted({ eventId: 'evt-3', history: HISTORY });

    expect(events.findOne).not.toHaveBeenCalled();
    expect(classifications.save).not.toHaveBeenCalled();
    expect(create).not.toHaveBeenCalled();
  });
});
