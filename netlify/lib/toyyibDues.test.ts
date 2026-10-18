import { describe, it, expect, vi } from 'vitest';
import {
  canCreateDuesBillFor, duesAmountFor, isFirstDuesYear, duesBillDescription, createDuesBill, GUEST_ENTRY_FEE,
} from './toyyibDues.mjs';

// The client copy is the reference for the server's amount rules (pure functions; Firebase stubbed out).
vi.mock('../../config/firebase', () => ({ db: {} }));
vi.mock('firebase/firestore', async (orig) => ({ ...(await orig<typeof import('firebase/firestore')>()), doc: vi.fn(() => ({})), collection: vi.fn(() => ({})) }));
vi.mock('../../services/errorLoggingService', () => ({ errorLoggingService: { logError: vi.fn() } }));
const { getTargetDuesForMembershipType, DEFAULT_MEMBERSHIP_RULES } = await import('../../services/membershipConfigService');

const member = (type: string, history?: Record<string, { status: string }>, extra: Record<string, unknown> = {}) => ({
  jciCareer: { membershipType: type, ...(history ? { membershipDuesHistory: history } : {}) },
  general: { name: 'Ali', idNumber: '900101145678' },
  contact: { email: 'ali@example.com', phone: '0123456789' },
  ...extra,
});

describe('dues amount (server copy of membershipConfigService)', () => {
  it('matches getTargetDuesForMembershipType for every paying type, first year and renewal', () => {
    for (const type of ['Probation', 'Official', 'Visiting', 'Associate']) {
      const first = member(type);
      const renewal = member(type, { 2025: { status: 'paid' } });
      expect(duesAmountFor(first, 2026, DEFAULT_MEMBERSHIP_RULES)).toBe(getTargetDuesForMembershipType(type as any, true, DEFAULT_MEMBERSHIP_RULES));
      expect(duesAmountFor(renewal, 2026, DEFAULT_MEMBERSHIP_RULES)).toBe(getTargetDuesForMembershipType(type as any, false, DEFAULT_MEMBERSHIP_RULES));
    }
  });
  it('uses the configured rules over the defaults', () => {
    expect(duesAmountFor(member('Official', { 2025: { status: 'paid' } }), 2026, { Official: { duesAmount: 320 } })).toBe(320);
  });
  it('charges Guests the entry fee and nothing for Honorary / Senator', () => {
    expect(duesAmountFor(member('Guest'), 2026, DEFAULT_MEMBERSHIP_RULES)).toBe(GUEST_ENTRY_FEE);
    expect(duesAmountFor(member('Honorary'), 2026, DEFAULT_MEMBERSHIP_RULES)).toBe(0);
    expect(duesAmountFor(member('Senator'), 2026, DEFAULT_MEMBERSHIP_RULES)).toBe(0);
  });
  it('first year only counts paid / over-paid earlier years', () => {
    expect(isFirstDuesYear(member('Official', { 2025: { status: 'pending' } }), 2026)).toBe(true);
    expect(isFirstDuesYear(member('Official', { 2025: { status: 'over paid' } }), 2026)).toBe(false);
    expect(isFirstDuesYear(member('Official', { 2026: { status: 'paid' } }), 2026)).toBe(true);
  });
});

describe('canCreateDuesBillFor', () => {
  it('lets members pay only their own dues; BOARD+ may pay for anyone', () => {
    expect(canCreateDuesBillFor('u1', 'MEMBER', 'u1')).toBe(true);
    expect(canCreateDuesBillFor('u1', 'GUEST', 'u1')).toBe(true);
    expect(canCreateDuesBillFor('u1', 'MEMBER', 'u2')).toBe(false);
    expect(canCreateDuesBillFor('u1', 'BOARD', 'u2')).toBe(true);
  });
});

describe('duesBillDescription', () => {
  it('matches ToyyibService.formatMembershipBillDescription', () => {
    expect(duesBillDescription(member('Official'), 2026)).toBe('[2026 Renewal Membership] Ali (5678), 0123456789');
    expect(duesBillDescription(member('Guest'), 2026)).toBe('[2026 Renewal Membership] Ali, 0123456789');
  });
});

// Minimal in-memory Firestore stand-in for the calls createDuesBill makes.
function fakeDb(seed: Record<string, Record<string, any>>) {
  const data: Record<string, Record<string, any>> = JSON.parse(JSON.stringify(seed));
  const writes: { op: string; path: string; value: any }[] = [];
  let n = 0;
  const ref = (col: string, id: string) => ({
    id, path: `${col}/${id}`,
    get: async () => ({ exists: !!data[col]?.[id], id, data: () => data[col]?.[id] }),
  });
  const query = (col: string, filters: [string, any][] = []) => ({
    where: (f: string, _op: string, v: any) => query(col, [...filters, [f, v]]),
    limit: () => query(col, filters),
    get: async () => {
      const docs = Object.entries(data[col] ?? {})
        .filter(([, d]) => filters.every(([f, v]) => d[f] === v))
        .map(([id, d]) => ({ id, ref: ref(col, id), data: () => d }));
      return { empty: docs.length === 0, docs };
    },
  });
  return {
    writes,
    collection: (col: string) => ({ ...query(col), doc: (id?: string) => ref(col, id ?? `new${++n}`) }),
    doc: (path: string) => { const [col, id] = path.split('/'); return ref(col, id); },
    batch: () => {
      const ops: any[] = [];
      return {
        set: (r: any, value: any) => ops.push({ op: 'set', path: r.path, value }),
        update: (r: any, value: any) => ops.push({ op: 'update', path: r.path, value }),
        commit: async () => { writes.push(...ops); },
      };
    },
  };
}

const seed = (overrides: Record<string, Record<string, any>> = {}) => ({
  members: { m1: member('Official', { 2025: { status: 'paid' } }) },
  systemSettings: { membershipRules: { rules: DEFAULT_MEMBERSHIP_RULES } },
  toyyibCategories: { '2026_membership': { categoryCode: 'cat2026', linkedType: 'membership', linkedYear: '2026', isActive: true } },
  toyyibBills: {},
  ...overrides,
});

describe('createDuesBill', () => {
  it('creates the bill with the server-computed amount and writes bill, category count and member link together', async () => {
    const db = fakeDb(seed());
    const createBill = vi.fn(async () => 'abc123');
    const r = await createDuesBill({ db, memberId: 'm1', year: 2026, isSandbox: true, createBill });
    expect(r).toEqual({ billCode: 'abc123', paymentUrl: 'https://dev.toyyibpay.com/abc123', isExisting: false });
    expect(createBill).toHaveBeenCalledWith(expect.objectContaining({ categoryCode: 'cat2026', billAmount: '30000', billName: '2026 Renewal Membership' }));
    expect(db.writes.map(w => `${w.op} ${w.path.split('/')[0]}`)).toEqual(['set toyyibBills', 'set toyyibCategories', 'update members']);
    expect(db.writes[0].value).toMatchObject({ billCode: 'abc123', memberId: 'm1', year: 2026, isSandbox: true, billAmount: 300, categoryCode: 'cat2026' });
    expect(db.writes[1].path).toBe('toyyibCategories/2026_membership');
    expect(db.writes[2].value).toMatchObject({
      'membership.2026.toyyibBillCode': 'abc123',
      'jciCareer.membershipDuesHistory.2026.toyyibPaymentUrl': 'https://dev.toyyibpay.com/abc123',
    });
  });

  it('refuses when the year has no linked dues category (members never create one)', async () => {
    const db = fakeDb(seed({ toyyibCategories: {} }));
    const createBill = vi.fn();
    const r = await createDuesBill({ db, memberId: 'm1', year: 2026, isSandbox: true, createBill });
    expect(r).toMatchObject({ status: 409 });
    expect(createBill).not.toHaveBeenCalled();
    expect(db.writes).toEqual([]);
  });

  it('reuses an unpaid existing bill in the environment it was created in', async () => {
    const db = fakeDb(seed({ toyyibBills: { b1: { billCode: 'old1', memberId: 'm1', categoryCode: 'cat2026', billpaymentStatus: '2', isSandbox: false } } }));
    const createBill = vi.fn();
    const r = await createDuesBill({ db, memberId: 'm1', year: 2026, isSandbox: true, createBill });
    expect(r).toEqual({ billCode: 'old1', paymentUrl: 'https://toyyibpay.com/old1', isExisting: true });
    expect(createBill).not.toHaveBeenCalled();
  });

  it('creates a new bill when the previous one failed, and charges Guests the entry fee', async () => {
    const db = fakeDb(seed({
      members: { g1: member('Guest') },
      toyyibBills: { b1: { billCode: 'failed1', memberId: 'g1', categoryCode: 'cat2026', billpaymentStatus: '3' } },
    }));
    const createBill = vi.fn(async () => 'new1');
    const r = await createDuesBill({ db, memberId: 'g1', year: 2026, isSandbox: true, createBill });
    expect(r).toMatchObject({ billCode: 'new1', isExisting: false });
    expect(createBill).toHaveBeenCalledWith(expect.objectContaining({ billAmount: '35000' }));
  });

  it('refuses members with nothing to pay', async () => {
    const db = fakeDb(seed({ members: { h1: member('Honorary') } }));
    expect(await createDuesBill({ db, memberId: 'h1', year: 2026, isSandbox: true, createBill: vi.fn() })).toMatchObject({ status: 400 });
  });
});
