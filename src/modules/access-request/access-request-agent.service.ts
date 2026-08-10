import Anthropic from '@anthropic-ai/sdk';
import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  Annotation,
  END,
  START,
  StateGraph,
} from '@langchain/langgraph';

import type { AccessRequestConfig } from '../../config/access-request.config';
import { AccessReviewSnapshotService } from '../access-review/access-review-snapshot.service';
import type { AccessRequestProposal } from './entities/access-request.entity';

export type AgentInput = {
  requesterUserId: string;
  tenantId: string;
  requestedRole: string;
  justification: string | null;
};

export type AgentResult = {
  proposal: AccessRequestProposal;
  model: string;
};

type RequesterContext =
  | { isMember: false }
  | {
      isMember: true;
      currentRole: 'OWNER' | 'ADMIN' | 'MEMBER';
      isActive: boolean;
      passkeys: number;
      lastLoginAt: string | null;
    };

type GatheredContext = {
  requester: RequesterContext;
  recentCriticalAnomalies: number;
  tenantActiveUsers: number;
};

const SYSTEM_PROMPT = `You review requests to grant or raise a tenant membership role in a Zero Trust system.
Given the request and the requester's current access context, propose "allow" or "deny".

Guidance:
- Least privilege: only allow when the justification and context support the requested role.
- OWNER/ADMIN are powerful — require a strong justification and a clean security posture.
- Treat recent critical anomalies for the tenant, an inactive requester, or no passkey as risk signals that favor "deny" or a lower role.
- A request to RAISE a role (e.g. MEMBER -> ADMIN) needs more justification than a first MEMBER role.
- You only PROPOSE. A human makes the final call, so surface your reasoning clearly and set a calibrated confidence.`;

const RESPONSE_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['recommendation', 'reasoning', 'confidence'],
  properties: {
    recommendation: { type: 'string', enum: ['allow', 'deny'] },
    reasoning: { type: 'string', minLength: 1, maxLength: 800 },
    // Anthropic structured output rejects minimum/maximum on numbers; the 0..1
    // range is stated in the prompt and clamped client-side below.
    confidence: { type: 'number' },
  },
} as const;

/**
 * LangGraph agent that proposes a decision for an access request. Two nodes:
 * `gatherContext` (reuse the access-review snapshot to summarise the requester's
 * current standing) then `propose` (LLM with structured output). It never
 * applies anything — a human approves the proposal separately.
 */
@Injectable()
export class AccessRequestAgentService {
  private readonly logger = new Logger(AccessRequestAgentService.name);
  private readonly config: AccessRequestConfig;
  private readonly client: Anthropic | null;
  private readonly graph: ReturnType<AccessRequestAgentService['buildGraph']>;

  constructor(
    private readonly configService: ConfigService,
    @Inject(AccessReviewSnapshotService)
    private readonly snapshots: AccessReviewSnapshotService,
  ) {
    this.config =
      this.configService.get<AccessRequestConfig>('accessRequest')!;
    this.client =
      this.config.enabled && this.config.apiKey
        ? new Anthropic({
            apiKey: this.config.apiKey,
            timeout: this.config.timeoutMs,
          })
        : null;
    if (this.config.enabled && !this.client) {
      this.logger.warn(
        'Access-request agent enabled but ANTHROPIC_API_KEY is missing; proposals are disabled.',
      );
    }
    this.graph = this.buildGraph();
  }

  get isEnabled(): boolean {
    return this.client !== null;
  }

  async propose(input: AgentInput): Promise<AgentResult> {
    if (!this.client) {
      throw new Error(
        'Access-request agent is not configured (disabled or missing API key).',
      );
    }
    const final = await this.graph.invoke(input);
    if (!final.proposal) {
      throw new Error('Agent produced no proposal');
    }
    return { proposal: final.proposal, model: this.config.model };
  }

  private buildGraph() {
    const State = Annotation.Root({
      requesterUserId: Annotation<string>(),
      tenantId: Annotation<string>(),
      requestedRole: Annotation<string>(),
      justification: Annotation<string | null>(),
      context: Annotation<GatheredContext | null>(),
      proposal: Annotation<AccessRequestProposal | null>(),
    });

    const gatherContext = async (state: typeof State.State) => {
      const snapshot = await this.snapshots.collect(state.tenantId);
      const user = snapshot.users.find(
        (u) => u.userId === state.requesterUserId,
      );
      const requester: RequesterContext = user
        ? {
            isMember: true,
            currentRole: user.role,
            isActive: user.isActive,
            passkeys: user.passkeys,
            lastLoginAt: user.lastLoginAt,
          }
        : { isMember: false };

      const context: GatheredContext = {
        requester,
        recentCriticalAnomalies:
          snapshot.aggregates.criticalAnomaliesLastWindow,
        tenantActiveUsers: snapshot.aggregates.activeUsers,
      };
      return { context };
    };

    const propose = async (state: typeof State.State) => {
      const userContent = JSON.stringify(
        {
          request: {
            requestedRole: state.requestedRole,
            justification: state.justification,
          },
          context: state.context,
        },
        null,
        2,
      );

      const response = await this.client!.messages.create({
        model: this.config.model,
        max_tokens: this.config.maxTokens,
        thinking: { type: 'disabled' },
        system: SYSTEM_PROMPT,
        messages: [{ role: 'user', content: userContent }],
        output_config: {
          format: { type: 'json_schema', schema: RESPONSE_SCHEMA },
        },
      });

      const textBlock = response.content.find((b) => b.type === 'text');
      if (!textBlock || textBlock.type !== 'text') {
        throw new Error(
          `Agent returned no text block (stop_reason=${response.stop_reason})`,
        );
      }
      const parsed = JSON.parse(textBlock.text) as AccessRequestProposal;
      const proposal: AccessRequestProposal = {
        ...parsed,
        confidence: Math.min(1, Math.max(0, Number(parsed.confidence) || 0)),
      };
      return { proposal };
    };

    return new StateGraph(State)
      .addNode('gatherContext', gatherContext)
      .addNode('propose', propose)
      .addEdge(START, 'gatherContext')
      .addEdge('gatherContext', 'propose')
      .addEdge('propose', END)
      .compile();
  }
}
