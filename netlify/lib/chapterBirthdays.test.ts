import { describe, it, expect } from 'vitest';
import { isActiveExternal, birthdayMmdd, parseMonth, buildChapterBirthdays } from './chapterBirthdays.mjs';

const SG = 'jcicitysg';
const ext = (id: string, extra: Record<string, any> = {}) => ({
  id,
  data: {
    role: 'AFFILIATE', loId: SG, affiliation: { status: 'active' },
    general: { name: `Name ${id}`, dob: '1990-07-15', avatarUrl: `https://x/${id}.png` },
    contact: { email: `${id}@x.test` },
    ...extra,
  },
});

describe('helpers', () => {
  it('isActiveExternal', () => {
    expect(isActiveExternal(ext('a').data)).toBe(true);
    expect(isActiveExternal({ ...ext('a').data, affiliation: { status: 'pending_chapter' } })).toBe(false);
    expect(isActiveExternal({ ...ext('a').data, role: 'MEMBER' })).toBe(false);
    expect(isActiveExternal({ ...ext('a').data, loId: 'jcikl' })).toBe(false);
    expect(isActiveExternal(null)).toBe(false);
  });
  it('birthdayMmdd from dob or birthdayMMDD, validated', () => {
    expect(birthdayMmdd({ general: { dob: '1990-07-15' } })).toBe('0715');
    expect(birthdayMmdd({ birthdayMMDD: '0229' })).toBe('0229');
    expect(birthdayMmdd({ general: { dob: '15/07/1990' } })).toBeNull();
    expect(birthdayMmdd({ birthdayMMDD: '1399' })).toBeNull();
    expect(birthdayMmdd({})).toBeNull();
  });
  it('parseMonth', () => {
    expect(parseMonth(7)).toBe(7);
    expect(parseMonth('12')).toBe(12);
    expect(parseMonth(0)).toBeNull();
    expect(parseMonth(13)).toBeNull();
    expect(parseMonth('x')).toBeNull();
  });
});

describe('buildChapterBirthdays', () => {
  const docs = [
    ext('b', { general: { name: 'Bee', dob: '1985-07-20' } }),
    ext('a', { general: { name: 'Ann', dob: '1990-07-03', avatarUrl: 'https://x/a.png' } }),
    ext('hidden', { privacy: { hideBirthday: true } }),
    ext('aug', { general: { name: 'Aug', dob: '1990-08-01' } }),
    ext('pending', { affiliation: { status: 'pending_chapter' } }),
    ext('other', { loId: 'jcitokyo' }),
    ext('nodob', { general: { name: 'No dob' } }),
    ext('chadmin', { role: 'CHAPTER_ADMIN', general: { name: 'Chap', dob: '1980-07-10' } }),
  ];

  it('returns only own-chapter active externals born in the month, minus hidden, sorted by day', () => {
    const out = buildChapterBirthdays(docs, SG, 7);
    expect(out.map(r => r.id)).toEqual(['a', 'chadmin', 'b']);
  });

  it('returns exactly id / displayName / avatarUrl / mmdd — no year, email or other fields', () => {
    const out = buildChapterBirthdays(docs, SG, 7);
    expect(out[0]).toEqual({ id: 'a', displayName: 'Ann', avatarUrl: 'https://x/a.png', mmdd: '0703' });
    expect(out[2]).toEqual({ id: 'b', displayName: 'Bee', avatarUrl: null, mmdd: '0720' });
    const json = JSON.stringify(out);
    expect(json).not.toContain('1990');
    expect(json).not.toContain('1985');
    expect(json).not.toContain('@x.test');
  });

  it('other months', () => {
    expect(buildChapterBirthdays(docs, SG, 8).map(r => r.id)).toEqual(['aug']);
    expect(buildChapterBirthdays(docs, SG, 1)).toEqual([]);
  });
});
