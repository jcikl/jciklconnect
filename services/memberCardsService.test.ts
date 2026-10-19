import { describe, it, expect, vi, beforeEach } from 'vitest';

const commit = vi.fn();
const setOp = vi.fn();
const deleteOp = vi.fn();
vi.mock('firebase/firestore', () => ({
  doc: (_db: unknown, col: string, id: string) => ({ col, id }),
  writeBatch: () => ({ set: setOp, delete: deleteOp, commit }),
}));
vi.mock('../config/firebase', () => ({ db: {} }));
vi.mock('../utils/devMode', () => ({ isDevMode: () => false }));
const logError = vi.fn();
vi.mock('./errorLoggingService', () => ({ errorLoggingService: { logError: (...a: unknown[]) => logError(...a) } }));

import { MemberCardsService } from './memberCardsService';

const member = { role: 'MEMBER', general: { name: 'Ali' } } as never;

describe('MemberCardsService.syncCards', () => {
  beforeEach(() => { vi.clearAllMocks(); commit.mockResolvedValue(undefined); });

  it('upserts for a qualifying member and deletes for INACTIVE (forceDelete)', async () => {
    const n = await MemberCardsService.syncCards([
      { memberId: 'a', before: null, after: member },
      { memberId: 'b', before: null, after: { role: 'INACTIVE' } as never, forceDelete: true },
      { memberId: 'c', before: null, after: { role: 'GUEST' } as never },
    ]);
    expect(n).toBe(2);
    expect(setOp).toHaveBeenCalledTimes(1);
    expect(setOp.mock.calls[0][0]).toEqual({ col: 'memberCards', id: 'a' });
    expect(deleteOp).toHaveBeenCalledTimes(1);
    expect(commit).toHaveBeenCalledTimes(1);
  });

  it('does not write when nothing card-relevant changed', async () => {
    expect(await MemberCardsService.syncCards([{ memberId: 'a', before: member, after: { ...(member as object), points: 1 } as never }])).toBe(0);
    expect(commit).not.toHaveBeenCalled();
  });

  it('chunks at 400 ops per batch', async () => {
    const inputs = Array.from({ length: 900 }, (_, i) => ({ memberId: `m${i}`, before: null, after: member }));
    await MemberCardsService.syncCards(inputs);
    expect(commit).toHaveBeenCalledTimes(3);
  });

  it('never throws when the card write is denied; logs and continues with the next chunk', async () => {
    commit.mockRejectedValueOnce(new Error('permission-denied')).mockResolvedValue(undefined);
    const inputs = Array.from({ length: 500 }, (_, i) => ({ memberId: `m${i}`, before: null, after: member }));
    await expect(MemberCardsService.syncCards(inputs)).resolves.toBe(100);
    expect(logError).toHaveBeenCalledTimes(1);
    expect(commit).toHaveBeenCalledTimes(2);
  });
});
