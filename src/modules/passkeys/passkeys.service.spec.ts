import { UnauthorizedException } from '@nestjs/common';
import {
  generateAuthenticationOptions,
  generateRegistrationOptions,
  verifyAuthenticationResponse,
  verifyRegistrationResponse,
} from '@simplewebauthn/server';
import { PasskeysService } from './passkeys.service';

jest.mock('@simplewebauthn/server', () => ({
  generateAuthenticationOptions: jest.fn(),
  generateRegistrationOptions: jest.fn(),
  verifyAuthenticationResponse: jest.fn(),
  verifyRegistrationResponse: jest.fn(),
}));

describe('PasskeysService WebAuthn invariants', () => {
  const challenge = {
    id: 'challenge-id',
    kind: 'registration',
    userId: 'user-id',
    challenge: 'challenge',
    expiresAt: new Date(Date.now() + 60_000),
    createdAt: new Date(),
  };

  function createService() {
    const challengeRepository = {
      delete: jest.fn(),
      create: jest.fn((value) => value),
      save: jest.fn(),
      manager: { transaction: jest.fn() },
    };
    const passkeyRepository = {
      find: jest.fn().mockResolvedValue([]),
      findOne: jest.fn(),
    };
    const users = {
      findById: jest.fn().mockResolvedValue({
        id: 'user-id',
        email: 'user@example.com',
        firstName: 'Test',
        lastName: 'User',
      }),
      findByEmailWithMemberships: jest.fn(),
    };
    const tenants = {
      findBySlug: jest
        .fn()
        .mockResolvedValue({ id: 'tenant-id', isActive: true }),
    };
    const memberships = {
      findActiveMembership: jest.fn().mockResolvedValue({ role: 'MEMBER' }),
    };
    const sessions = {
      createEmpty: jest.fn().mockResolvedValue({ id: 'session-id' }),
      updateRefreshToken: jest.fn(),
    };
    const tokens = {
      buildRefreshExpiryDate: jest
        .fn()
        .mockReturnValue(new Date(Date.now() + 60_000)),
      generateTokenPair: jest.fn().mockResolvedValue({
        accessToken: 'access',
        refreshToken: 'refresh',
      }),
    };
    const anomalies = { analyze: jest.fn() };
    const service = new PasskeysService(
      passkeyRepository as never,
      challengeRepository as never,
      users as never,
      tenants as never,
      memberships as never,
      sessions as never,
      tokens as never,
      {
        get: jest.fn().mockReturnValue({
          rpName: 'Test',
          rpID: 'localhost',
          origins: ['http://localhost:3000'],
          challengeTtlMs: 300_000,
          authenticationBeginMinDurationMs: 250,
        }),
      } as never,
      anomalies as never,
    );
    return {
      service,
      challengeRepository,
      passkeyRepository,
      users,
      tenants,
      memberships,
      sessions,
      tokens,
      anomalies,
    };
  }

  beforeEach(() => jest.clearAllMocks());

  it('requires discoverable, user-verified credentials at registration', async () => {
    const { service } = createService();
    jest.mocked(generateRegistrationOptions).mockResolvedValue({
      challenge: 'challenge',
    } as never);

    await service.registrationBegin('user-id');

    expect(generateRegistrationOptions).toHaveBeenCalledWith(
      expect.objectContaining({
        authenticatorSelection: {
          residentKey: 'required',
          userVerification: 'required',
        },
      }),
    );
  });

  it('does not disclose credential IDs during authentication begin', async () => {
    const { service, users } = createService();
    users.findByEmailWithMemberships.mockResolvedValue({ id: 'user-id' });
    jest.mocked(generateAuthenticationOptions).mockResolvedValue({
      challenge: 'challenge',
    } as never);

    await service.authenticationBegin('user@example.com', 'tenant');

    expect(generateAuthenticationOptions).toHaveBeenCalledWith(
      expect.objectContaining({
        allowCredentials: [],
        userVerification: 'required',
      }),
    );
  });

  it('normalizes authentication begin to the configured minimum duration', async () => {
    jest.useFakeTimers();
    try {
      const { service, users } = createService();
      users.findByEmailWithMemberships.mockResolvedValue(null);
      jest.mocked(generateAuthenticationOptions).mockResolvedValue({
        challenge: 'challenge',
      } as never);

      let settled = false;
      const result = service
        .authenticationBegin('missing@example.com', 'tenant')
        .then(() => {
          settled = true;
        });

      await jest.advanceTimersByTimeAsync(249);
      expect(settled).toBe(false);

      await jest.advanceTimersByTimeAsync(1);
      await result;
      expect(settled).toBe(true);
    } finally {
      jest.useRealTimers();
    }
  });

  it('locks and retains a challenge when verification fails', async () => {
    const { service, challengeRepository } = createService();
    const transactionalChallenges = {
      findOne: jest.fn().mockResolvedValue(challenge),
      remove: jest.fn(),
    };
    const manager = {
      query: jest.fn(),
      getRepository: jest.fn().mockReturnValue(transactionalChallenges),
    };
    challengeRepository.manager.transaction.mockImplementation(
      async (work: (manager: unknown) => unknown) => work(manager),
    );
    jest.mocked(verifyRegistrationResponse).mockResolvedValue({
      verified: false,
    } as never);

    await expect(
      service.registrationFinish('user-id', {} as never, 'Laptop'),
    ).rejects.toBeInstanceOf(UnauthorizedException);

    expect(transactionalChallenges.findOne).toHaveBeenCalledWith(
      expect.objectContaining({ lock: { mode: 'pessimistic_write' } }),
    );
    expect(transactionalChallenges.remove).not.toHaveBeenCalled();
  });

  it('rejects stored counters that cannot be represented safely', async () => {
    const { service, challengeRepository, passkeyRepository } = createService();
    const passkey = {
      id: 'passkey-id',
      userId: 'user-id',
      credentialId: Buffer.from('credential'),
      publicKey: Buffer.from('key'),
      counter: '9007199254740992',
      transports: [],
    };
    passkeyRepository.findOne.mockResolvedValue(passkey);
    const transactionalChallenges = {
      findOne: jest.fn().mockResolvedValue({
        ...challenge,
        kind: 'authentication',
      }),
      remove: jest.fn(),
    };
    const transactionalPasskeys = {
      findOne: jest.fn().mockResolvedValue(passkey),
      save: jest.fn(),
    };
    const manager = {
      query: jest.fn(),
      getRepository: jest
        .fn()
        .mockReturnValueOnce(transactionalChallenges)
        .mockReturnValueOnce(transactionalPasskeys),
    };
    challengeRepository.manager.transaction.mockImplementation(
      async (work: (manager: unknown) => unknown) => work(manager),
    );

    await expect(
      service.authenticationFinish(
        { id: Buffer.from('credential').toString('base64url') } as never,
        'tenant',
      ),
    ).rejects.toThrow('outside the supported range');
    expect(verifyAuthenticationResponse).not.toHaveBeenCalled();
    expect(transactionalChallenges.remove).not.toHaveBeenCalled();
  });

  it('commits registration state before deleting the challenge', async () => {
    const { service, challengeRepository } = createService();
    const events: string[] = [];
    const savedPasskey = {
      id: 'passkey-id',
      userId: 'user-id',
      friendlyName: 'Laptop',
      deviceType: 'singleDevice',
      backedUp: false,
      transports: [],
      createdAt: new Date(),
      lastUsedAt: null,
    };
    const transactionalChallenges = {
      findOne: jest.fn().mockResolvedValue(challenge),
      remove: jest
        .fn()
        .mockImplementation(async () => events.push('challenge-delete')),
    };
    const transactionalPasskeys = {
      findOne: jest.fn().mockResolvedValue(null),
      create: jest.fn((value) => ({ ...savedPasskey, ...value })),
      save: jest.fn().mockImplementation(async (value) => {
        events.push('credential-save');
        return value;
      }),
    };
    const manager = {
      query: jest.fn(),
      getRepository: jest
        .fn()
        .mockReturnValueOnce(transactionalChallenges)
        .mockReturnValueOnce(transactionalPasskeys),
    };
    challengeRepository.manager.transaction.mockImplementation(
      async (work: (manager: unknown) => unknown) => work(manager),
    );
    jest.mocked(verifyRegistrationResponse).mockResolvedValue({
      verified: true,
      registrationInfo: {
        credential: {
          id: 'credential-id',
          publicKey: new Uint8Array([1, 2, 3]),
          counter: 0,
          transports: [],
        },
        credentialDeviceType: 'singleDevice',
        credentialBackedUp: false,
      },
    } as never);

    await service.registrationFinish('user-id', {} as never, 'Laptop');

    expect(events).toEqual(['credential-save', 'challenge-delete']);
  });

  it('serializes concurrent finishes so a challenge succeeds only once', async () => {
    const { service, challengeRepository } = createService();
    let available = true;
    let tail = Promise.resolve();
    const transactionalChallenges = {
      findOne: jest
        .fn()
        .mockImplementation(async () => (available ? challenge : null)),
      remove: jest.fn().mockImplementation(async () => {
        available = false;
      }),
    };
    const transactionalPasskeys = {
      findOne: jest.fn().mockResolvedValue(null),
      create: jest.fn((value) => ({
        id: 'passkey-id',
        createdAt: new Date(),
        ...value,
      })),
      save: jest.fn().mockImplementation(async (value) => value),
    };
    const manager = {
      query: jest.fn(),
      getRepository: jest.fn((entity) =>
        entity.name === 'WebauthnChallenge'
          ? transactionalChallenges
          : transactionalPasskeys,
      ),
    };
    challengeRepository.manager.transaction.mockImplementation(
      (work: (manager: unknown) => Promise<unknown>) => {
        const current = tail.then(() => work(manager));
        tail = current.then(
          () => undefined,
          () => undefined,
        );
        return current;
      },
    );
    jest.mocked(verifyRegistrationResponse).mockResolvedValue({
      verified: true,
      registrationInfo: {
        credential: {
          id: 'credential-id',
          publicKey: new Uint8Array([1]),
          counter: 0,
          transports: [],
        },
        credentialDeviceType: 'singleDevice',
        credentialBackedUp: false,
      },
    } as never);

    const results = await Promise.allSettled([
      service.registrationFinish('user-id', {} as never, 'Laptop'),
      service.registrationFinish('user-id', {} as never, 'Laptop'),
    ]);

    expect(results.map((result) => result.status).sort()).toEqual([
      'fulfilled',
      'rejected',
    ]);
    expect(verifyRegistrationResponse).toHaveBeenCalledTimes(1);
    expect(transactionalChallenges.remove).toHaveBeenCalledTimes(1);
  });

  it('updates the locked counter before deleting the authentication challenge', async () => {
    const { service, challengeRepository, passkeyRepository } = createService();
    const events: string[] = [];
    const passkey = {
      id: 'passkey-id',
      userId: 'user-id',
      credentialId: Buffer.from('credential'),
      publicKey: Buffer.from('key'),
      counter: '1',
      transports: [],
    };
    passkeyRepository.findOne.mockResolvedValue(passkey);
    const transactionalChallenges = {
      findOne: jest
        .fn()
        .mockResolvedValue({ ...challenge, kind: 'authentication' }),
      remove: jest
        .fn()
        .mockImplementation(async () => events.push('challenge-delete')),
    };
    const transactionalPasskeys = {
      findOne: jest.fn().mockResolvedValue(passkey),
      save: jest.fn().mockImplementation(async (value) => {
        events.push('counter-save');
        return value;
      }),
    };
    const manager = {
      query: jest.fn(),
      getRepository: jest
        .fn()
        .mockReturnValueOnce(transactionalChallenges)
        .mockReturnValueOnce(transactionalPasskeys),
    };
    challengeRepository.manager.transaction.mockImplementation(
      async (work: (manager: unknown) => unknown) => work(manager),
    );
    jest.mocked(verifyAuthenticationResponse).mockResolvedValue({
      verified: true,
      authenticationInfo: { newCounter: 2 },
    } as never);

    await service.authenticationFinish(
      { id: Buffer.from('credential').toString('base64url') } as never,
      'tenant',
    );

    expect(transactionalPasskeys.findOne).toHaveBeenCalledWith(
      expect.objectContaining({ lock: { mode: 'pessimistic_write' } }),
    );
    expect(events).toEqual(['counter-save', 'challenge-delete']);
    expect(passkey.counter).toBe('2');
  });
});
