import { Repository } from 'typeorm';

import { ReplayNonce } from './replay-nonce.entity';
import { ReplayNonceService } from './replay-nonce.service';

function makeService(rawResult: unknown[]) {
  const execute = jest.fn().mockResolvedValue({ raw: rawResult });
  const qb = {
    insert: () => qb,
    into: () => qb,
    values: () => qb,
    orIgnore: () => qb,
    returning: () => qb,
    execute,
  };
  const del = jest.fn().mockResolvedValue({ affected: 0 });
  const repo = {
    createQueryBuilder: () => qb,
    delete: del,
  } as unknown as Repository<ReplayNonce>;
  return { service: new ReplayNonceService(repo), execute, del };
}

describe('ReplayNonceService', () => {
  it('returns true when the nonce is newly recorded', async () => {
    const { service } = makeService([{ key: 'ts:nonce' }]);
    await expect(service.checkAndRecord('ts:nonce', new Date())).resolves.toBe(
      true,
    );
  });

  it('returns false on a replay (conflict → no row returned)', async () => {
    const { service } = makeService([]);
    await expect(service.checkAndRecord('ts:nonce', new Date())).resolves.toBe(
      false,
    );
  });

  it('prunes expired rows', async () => {
    const { service, del } = makeService([]);
    await service.pruneExpired();
    expect(del).toHaveBeenCalled();
  });
});
