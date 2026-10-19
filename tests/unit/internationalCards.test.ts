import { describe, it, expect } from 'vitest';
import { attachSisterChapters, planCardQuery } from '../../utils/internationalCards';

const ch = (id: string) => ({ id, name: `JCI ${id}`, country: 'X', isActive: true }) as any;
const card = (id: string, loId: string) => ({ id, loId, displayName: id, international: true, updatedAt: '' }) as any;

describe('attachSisterChapters', () => {
  it('attaches the matching chapter and drops cards of unknown / inactive chapters', () => {
    const out = attachSisterChapters([card('a', 'sg'), card('b', 'my'), card('c', 'zz')], [ch('sg'), ch('my')]);
    expect(out.map(c => [c.id, c.sisterChapter.id])).toEqual([['a', 'sg'], ['b', 'my']]);
  });

  it('returns nothing when no chapters loaded (chapters failed) instead of throwing', () => {
    expect(attachSisterChapters([card('a', 'sg')], [])).toEqual([]);
  });
});

describe('planCardQuery', () => {
  it('KL users query the active chapters by loId', () => {
    expect(planCardQuery(false, [ch('sg'), ch('my')])).toEqual({ kind: 'chapters', loIds: ['sg', 'my'] });
  });
  it('externals only query international cards', () => {
    expect(planCardQuery(true, [ch('sg')])).toEqual({ kind: 'international' });
  });
});
