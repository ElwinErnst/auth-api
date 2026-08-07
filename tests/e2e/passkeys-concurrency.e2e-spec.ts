import 'reflect-metadata';
import { DataSource, IsNull, Repository } from 'typeorm';
import { WebauthnChallenge } from '../../src/modules/passkeys/entities/webauthn-challenge.entity';

describe('Passkey challenge locking (PostgreSQL e2e)', () => {
  let dataSource: DataSource;
  let challenges: Repository<WebauthnChallenge>;

  beforeAll(async () => {
    dataSource = new DataSource({
      type: 'postgres',
      host: process.env.DB_HOST ?? '127.0.0.1',
      port: Number(process.env.DB_PORT ?? 5434),
      username: process.env.DB_USER ?? 'postgres',
      password: process.env.DB_PASS ?? 'postgres',
      database: process.env.DB_NAME ?? 'auth',
      entities: [WebauthnChallenge],
      synchronize: false,
    });
    await dataSource.initialize();
    challenges = dataSource.getRepository(WebauthnChallenge);
  });

  afterEach(async () => {
    await challenges.delete({ challenge: 'concurrency-e2e-challenge' });
  });

  afterAll(async () => {
    await dataSource?.destroy();
  });

  it('allows only one concurrent transaction to consume a challenge', async () => {
    const row = await challenges.save(
      challenges.create({
        kind: 'authentication',
        userId: null,
        challenge: 'concurrency-e2e-challenge',
        expiresAt: new Date(Date.now() + 60_000),
      }),
    );

    let firstHasLock!: () => void;
    const locked = new Promise<void>((resolve) => {
      firstHasLock = resolve;
    });
    let releaseFirst!: () => void;
    const release = new Promise<void>((resolve) => {
      releaseFirst = resolve;
    });

    const consume = (pauseAfterLock: boolean) =>
      dataSource.transaction(async (manager) => {
        await manager.query(
          'SELECT pg_advisory_xact_lock(hashtextextended($1, 0))',
          ['authentication:anonymous'],
        );
        const repository = manager.getRepository(WebauthnChallenge);
        const challenge = await repository.findOne({
          where: {
            kind: 'authentication',
            userId: IsNull(),
          },
          order: { createdAt: 'DESC' },
          lock: { mode: 'pessimistic_write' },
        });
        if (!challenge) return false;
        if (pauseAfterLock) {
          firstHasLock();
          await release;
        }
        await repository.remove(challenge);
        return true;
      });

    const first = consume(true);
    await locked;
    const second = consume(false);
    releaseFirst();

    await expect(Promise.all([first, second])).resolves.toEqual([true, false]);
    await expect(challenges.findOneBy({ id: row.id })).resolves.toBeNull();
  });
});
