import { ConflictException, NotFoundException } from '@nestjs/common';
import { Repository } from 'typeorm';

import {
  AccessRequest,
  AccessRequestProposal,
} from './entities/access-request.entity';
import { AccessRequestService } from './access-request.service';
import { AccessRequestAgentService } from './access-request-agent.service';
import { MembershipsService } from '../memberships/memberships.service';

const PROPOSAL: AccessRequestProposal = {
  recommendation: 'deny',
  reasoning: 'generic justification for a role escalation',
  confidence: 0.7,
};

function makeService(
  opts: {
    agentEnabled?: boolean;
    agentThrows?: boolean;
    existingRequest?: Partial<AccessRequest> | null;
    existingMembership?: { id: string } | null;
  } = {},
) {
  const save = jest.fn((r: AccessRequest) =>
    Promise.resolve({ ...r, id: r.id ?? 'ar-1' }),
  );
  const repo = {
    create: (r: Partial<AccessRequest>) => ({ ...r }) as AccessRequest,
    save,
    find: jest.fn().mockResolvedValue([]),
    findOne: jest.fn().mockResolvedValue(opts.existingRequest ?? null),
  } as unknown as Repository<AccessRequest>;

  const propose = jest.fn(
    opts.agentThrows
      ? () => Promise.reject(new Error('LLM down'))
      : () => Promise.resolve({ proposal: PROPOSAL, model: 'claude-sonnet-5' }),
  );
  const agent = {
    isEnabled: opts.agentEnabled ?? true,
    propose,
  } as unknown as AccessRequestAgentService;

  const membershipCreate = jest.fn().mockResolvedValue({ id: 'm-new' });
  const membershipUpdate = jest.fn().mockResolvedValue({ id: 'm-1' });
  const memberships = {
    findActiveMembership: jest
      .fn()
      .mockResolvedValue(opts.existingMembership ?? null),
    create: membershipCreate,
    update: membershipUpdate,
  } as unknown as MembershipsService;

  return {
    service: new AccessRequestService(repo, agent, memberships),
    save,
    propose,
    membershipCreate,
    membershipUpdate,
  };
}

const CREATE_INPUT = {
  tenantId: 'tenant-1',
  requesterUserId: 'user-1',
  requestedRole: 'ADMIN' as 'OWNER' | 'ADMIN' | 'MEMBER',
  justification: 'need to manage vaults',
};

describe('AccessRequestService', () => {
  it('creates a pending request and attaches the agent proposal', async () => {
    const { service } = makeService({ agentEnabled: true });
    const req = await service.create(CREATE_INPUT);

    expect(req.status).toBe('pending');
    expect(req.agentProposal).toEqual(PROPOSAL);
    expect(req.agentModel).toBe('claude-sonnet-5');
  });

  it('still creates the request when the agent proposal fails', async () => {
    const { service, propose } = makeService({
      agentEnabled: true,
      agentThrows: true,
    });
    const req = await service.create(CREATE_INPUT);

    expect(propose).toHaveBeenCalled();
    expect(req.status).toBe('pending');
    expect(req.agentProposal).toBeUndefined();
  });

  it('does not call the agent when it is disabled', async () => {
    const { service, propose } = makeService({ agentEnabled: false });
    const req = await service.create(CREATE_INPUT);

    expect(propose).not.toHaveBeenCalled();
    expect(req.status).toBe('pending');
  });

  it('approve creates a membership for a non-member and records the decision', async () => {
    const { service, membershipCreate, membershipUpdate } = makeService({
      existingRequest: {
        id: 'ar-1',
        tenantId: 'tenant-1',
        requesterUserId: 'user-1',
        requestedRole: 'ADMIN',
        status: 'pending',
      },
      existingMembership: null,
    });

    const decided = await service.approve('tenant-1', 'ar-1', 'admin-9');

    expect(membershipCreate).toHaveBeenCalledWith({
      userId: 'user-1',
      tenantId: 'tenant-1',
      role: 'ADMIN',
    });
    expect(membershipUpdate).not.toHaveBeenCalled();
    expect(decided.status).toBe('approved');
    expect(decided.decidedByUserId).toBe('admin-9');
    expect(decided.decidedAt).toBeInstanceOf(Date);
  });

  it('approve updates an existing membership role', async () => {
    const { service, membershipCreate, membershipUpdate } = makeService({
      existingRequest: {
        id: 'ar-1',
        tenantId: 'tenant-1',
        requesterUserId: 'user-1',
        requestedRole: 'ADMIN',
        status: 'pending',
      },
      existingMembership: { id: 'm-1' },
    });

    await service.approve('tenant-1', 'ar-1', 'admin-9');

    expect(membershipUpdate).toHaveBeenCalledWith('m-1', { role: 'ADMIN' });
    expect(membershipCreate).not.toHaveBeenCalled();
  });

  it('reject records the decision without touching memberships', async () => {
    const { service, membershipCreate, membershipUpdate } = makeService({
      existingRequest: {
        id: 'ar-1',
        tenantId: 'tenant-1',
        requesterUserId: 'user-1',
        requestedRole: 'ADMIN',
        status: 'pending',
      },
    });

    const decided = await service.reject('tenant-1', 'ar-1', 'admin-9');

    expect(decided.status).toBe('rejected');
    expect(decided.decidedByUserId).toBe('admin-9');
    expect(membershipCreate).not.toHaveBeenCalled();
    expect(membershipUpdate).not.toHaveBeenCalled();
  });

  it('rejects deciding a request that is not pending', async () => {
    const { service } = makeService({
      existingRequest: {
        id: 'ar-1',
        tenantId: 'tenant-1',
        status: 'approved',
      },
    });
    await expect(
      service.approve('tenant-1', 'ar-1', 'admin-9'),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('throws when the request does not exist', async () => {
    const { service } = makeService({ existingRequest: null });
    await expect(
      service.approve('tenant-1', 'missing', 'admin-9'),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});
