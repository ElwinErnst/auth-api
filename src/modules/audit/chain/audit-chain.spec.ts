import { CURRENT_SERIALIZER, type AuditEventFields } from './audit-canonical.util';
import { verifyRows, type ChainRow } from './audit-chain';

function makeEvent(seq: number, overrides: Partial<AuditEventFields> = {}): AuditEventFields {
  return {
    scope: 'tenant-1',
    seq: String(seq),
    tenantId: 'tenant-1',
    system: 'auth',
    category: 'access',
    action: 'AUTH_LOGIN',
    actorType: 'user',
    actorId: 'user-1',
    resourceType: 'session',
    resourceId: `sess-${seq}`,
    outcome: 'success',
    detail: { ip: '1.2.3.4', role: 'OWNER' },
    occurredAt: `2026-09-20T00:00:0${seq}.000Z`,
    ...overrides,
  };
}

/** Build a valid chain the way the writer (AuditService) will: chained hashes. */
function chain(events: AuditEventFields[]): ChainRow[] {
  const rows: ChainRow[] = [];
  let prevHash: string | null = null;
  for (const e of events) {
    const eventHash = CURRENT_SERIALIZER.computeEventHash(e);
    const chainHash = CURRENT_SERIALIZER.computeChainHash(prevHash, eventHash);
    rows.push({
      ...e,
      prevHash,
      eventHash,
      chainHash,
      schemaVersion: CURRENT_SERIALIZER.version,
      hashAlg: CURRENT_SERIALIZER.hashAlg,
    });
    prevHash = chainHash;
  }
  return rows;
}

describe('audit chain', () => {
  it('verifies an untouched chain as VALID', () => {
    const result = verifyRows('tenant-1', chain([makeEvent(1), makeEvent(2), makeEvent(3)]));
    expect(result.status).toBe('VALID');
    expect(result.checked).toBe(3);
    expect(result.headSeq).toBe('3');
  });

  it('detects a tampered field (EVENT_HASH_MISMATCH)', () => {
    const rows = chain([makeEvent(1), makeEvent(2), makeEvent(3)]);
    rows[1].action = 'AUTH_LOGOUT'; // alter content after it was hashed
    const result = verifyRows('tenant-1', rows);
    expect(result.status).toBe('BROKEN');
    expect(result.firstBreak?.reason).toBe('EVENT_HASH_MISMATCH');
    expect(result.firstBreak?.seq).toBe('2');
  });

  it('detects a tampered detail value', () => {
    const rows = chain([makeEvent(1), makeEvent(2)]);
    (rows[1].detail as Record<string, unknown>).role = 'ADMIN';
    expect(verifyRows('tenant-1', rows).firstBreak?.reason).toBe('EVENT_HASH_MISMATCH');
  });

  it('detects an interior deletion (SEQ_GAP)', () => {
    const rows = chain([makeEvent(1), makeEvent(2), makeEvent(3)]);
    const result = verifyRows('tenant-1', [rows[0], rows[2]]); // drop seq 2
    expect(result.status).toBe('BROKEN');
    expect(result.firstBreak?.reason).toBe('SEQ_GAP');
  });

  it('detects front truncation (BAD_GENESIS)', () => {
    const rows = chain([makeEvent(1), makeEvent(2), makeEvent(3)]);
    const result = verifyRows('tenant-1', rows.slice(1)); // drop genesis
    expect(result.status).toBe('BROKEN');
    expect(result.firstBreak?.reason).toBe('BAD_GENESIS');
  });

  it('detects a broken link (PREV_HASH_MISMATCH)', () => {
    const rows = chain([makeEvent(1), makeEvent(2)]);
    rows[1].prevHash = 'deadbeef'.repeat(8);
    expect(verifyRows('tenant-1', rows).firstBreak?.reason).toBe('PREV_HASH_MISMATCH');
  });

  it('is EMPTY for no rows', () => {
    expect(verifyRows('tenant-1', []).status).toBe('EMPTY');
  });

  it('cannot detect suffix truncation (documented limitation)', () => {
    const rows = chain([makeEvent(1), makeEvent(2), makeEvent(3)]);
    // dropping the newest rows leaves a shorter but internally consistent chain
    expect(verifyRows('tenant-1', rows.slice(0, 2)).status).toBe('VALID');
  });
});
