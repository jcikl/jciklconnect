/**
 * HobbyClubsService.getAllClubs must list clubs that have NO isDeleted field.
 * createClub never writes isDeleted, and Firestore's `where('isDeleted','!=',true)` silently drops
 * documents missing the field — so the old query returned (almost) nothing. The fake getDocs below
 * applies Firestore's semantics for that filter so the bug is reproducible without an emulator.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

type FakeDoc = { id: string; data: Record<string, unknown> };
const STORE: FakeDoc[] = [
  { id: 'c1', data: { name: 'Runners' } }, // created by createClub: no isDeleted field
  { id: 'c2', data: { name: 'Art', isDeleted: false } },
  { id: 'c3', data: { name: 'Gone', isDeleted: true } },
  { id: 'c4', data: { name: 'Book club' } },
];

vi.mock('firebase/firestore', () => {
  const where = (field: string, op: string, value: unknown) => ({ kind: 'where', field, op, value });
  const orderBy = (field: string, dir = 'asc') => ({ kind: 'orderBy', field, dir });
  const query = (_col: unknown, ...constraints: Array<{ kind: string; field: string; op?: string; value?: unknown }>) => ({ constraints });
  const getDocs = async (q: { constraints?: Array<{ kind: string; field: string; op?: string; value?: unknown }> }) => {
    let docs = [...STORE];
    for (const c of q.constraints ?? []) {
      // Firestore: != and orderBy both exclude documents where the field does not exist.
      if (c.kind === 'where' && c.op === '!=') docs = docs.filter(d => c.field in d.data && d.data[c.field] !== c.value);
      if (c.kind === 'where' && c.op === '==') docs = docs.filter(d => d.data[c.field] === c.value);
      if (c.kind === 'orderBy') docs = docs.filter(d => c.field in d.data);
    }
    return { docs: docs.map(d => ({ id: d.id, data: () => d.data })) };
  };
  return {
    collection: () => ({}),
    doc: () => ({}),
    getDoc: vi.fn(),
    getDocs,
    addDoc: vi.fn(),
    updateDoc: vi.fn(),
    query,
    where,
    orderBy,
    Timestamp: { now: () => new Date() },
    runTransaction: vi.fn(),
  };
});
vi.mock('../../config/firebase', () => ({ db: {}, auth: null }));
vi.mock('../../utils/devMode', () => ({ isDevMode: () => false, withDevMode: (_m: unknown, real: () => unknown) => real() }));
vi.mock('../../services/errorLoggingService', () => ({ errorLoggingService: { logError: vi.fn() } }));

import { HobbyClubsService } from '../../services/hobbyClubsService';

describe('HobbyClubsService.getAllClubs', () => {
  beforeEach(() => HobbyClubsService.invalidateClubsCache());

  it('includes clubs without an isDeleted field and excludes soft-deleted ones, sorted by name', async () => {
    const clubs = await HobbyClubsService.getAllClubs();
    expect(clubs.map(c => c.id)).toEqual(['c2', 'c4', 'c1']); // Art, Book club, Runners
  });
});
