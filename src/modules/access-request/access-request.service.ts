import {
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { AccessRequest } from './entities/access-request.entity';
import { AccessRequestAgentService } from './access-request-agent.service';
import { MembershipsService } from '../memberships/memberships.service';

type Role = 'OWNER' | 'ADMIN' | 'MEMBER';

@Injectable()
export class AccessRequestService {
  private readonly logger = new Logger(AccessRequestService.name);

  constructor(
    @InjectRepository(AccessRequest)
    private readonly repo: Repository<AccessRequest>,
    private readonly agent: AccessRequestAgentService,
    private readonly memberships: MembershipsService,
  ) {}

  get agentEnabled(): boolean {
    return this.agent.isEnabled;
  }

  /**
   * Create a pending request and, when the agent is enabled, attach its
   * advisory proposal. A failed proposal never blocks the request — a human can
   * still decide without it.
   */
  async create(input: {
    tenantId: string;
    requesterUserId: string;
    requestedRole: Role;
    justification: string | null;
  }): Promise<AccessRequest> {
    const entity = this.repo.create({
      tenantId: input.tenantId,
      requesterUserId: input.requesterUserId,
      requestedRole: input.requestedRole,
      justification: input.justification,
      status: 'pending',
    });

    if (this.agent.isEnabled) {
      try {
        const { proposal, model } = await this.agent.propose(input);
        entity.agentProposal = proposal;
        entity.agentModel = model;
      } catch (err: unknown) {
        this.logger.warn(
          `Agent proposal failed for tenant=${input.tenantId}: ${
            err instanceof Error ? err.message : String(err)
          }`,
        );
      }
    }

    return this.repo.save(entity);
  }

  listPending(tenantId: string): Promise<AccessRequest[]> {
    return this.repo.find({
      where: { tenantId, status: 'pending' },
      order: { createdAt: 'ASC' },
    });
  }

  /** Human approval: apply the membership, then record the decision. */
  async approve(
    tenantId: string,
    id: string,
    deciderUserId: string,
  ): Promise<AccessRequest> {
    const request = await this.getPendingOrThrow(tenantId, id);
    const role = request.requestedRole as Role;

    const existing = await this.memberships.findActiveMembership(
      request.requesterUserId,
      request.tenantId,
    );
    if (existing) {
      await this.memberships.update(existing.id, { role });
    } else {
      await this.memberships.create({
        userId: request.requesterUserId,
        tenantId: request.tenantId,
        role,
      });
    }

    request.status = 'approved';
    request.decidedByUserId = deciderUserId;
    request.decidedAt = new Date();
    return this.repo.save(request);
  }

  async reject(
    tenantId: string,
    id: string,
    deciderUserId: string,
  ): Promise<AccessRequest> {
    const request = await this.getPendingOrThrow(tenantId, id);
    request.status = 'rejected';
    request.decidedByUserId = deciderUserId;
    request.decidedAt = new Date();
    return this.repo.save(request);
  }

  private async getPendingOrThrow(
    tenantId: string,
    id: string,
  ): Promise<AccessRequest> {
    const request = await this.repo.findOne({ where: { id, tenantId } });
    if (!request) {
      throw new NotFoundException('Access request not found');
    }
    if (request.status !== 'pending') {
      throw new ConflictException(`Access request already ${request.status}`);
    }
    return request;
  }
}
