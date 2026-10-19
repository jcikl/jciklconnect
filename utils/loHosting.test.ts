import { describe, it, expect } from 'vitest';
import { parseCoHosting, formatCoHosting, loRoleIn, involvesLo, isKlRelevantEvent, KL_LO_NAME } from './loHosting.mjs';

const roadmapText = 'JCI Bandar Klang, JCI Kuala Lumpur, JCI Lead Tropicana';

describe('parseCoHosting / formatCoHosting', () => {
  it('splits the legacy comma-separated text and keeps lists as they are', () => {
    expect(parseCoHosting(roadmapText)).toEqual(['JCI Bandar Klang', 'JCI Kuala Lumpur', 'JCI Lead Tropicana']);
    expect(parseCoHosting(['JCI Mines', ' JCI Kuala Lumpur '])).toEqual(['JCI Mines', 'JCI Kuala Lumpur']);
  });
  it('drops blanks and duplicates; missing values become an empty list', () => {
    expect(parseCoHosting('JCI A, , JCI A,JCI B ')).toEqual(['JCI A', 'JCI B']);
    expect(parseCoHosting(undefined)).toEqual([]);
    expect(parseCoHosting('')).toEqual([]);
  });
  it('formats a list back to the "A, B" text used for display and editing', () => {
    expect(formatCoHosting(['JCI A', 'JCI B'])).toBe('JCI A, JCI B');
    expect(formatCoHosting(roadmapText)).toBe(roadmapText);
  });
});

describe('LO matching', () => {
  it('finds KL inside a multi-LO co-hosting value (the old checks missed this)', () => {
    expect(loRoleIn({ hostingLo: 'JCI Mines', coHosting: roadmapText }, KL_LO_NAME)).toEqual({ isHosting: false, isCoHosting: true });
    expect(involvesLo({ hostingLo: 'JCI Mines', coHosting: ['JCI Kuala Lumpur'] }, 'jci kuala lumpur')).toBe(true);
  });
  it('does not treat JCI Kuala Lumpur West / Mandarin as KL', () => {
    expect(involvesLo({ hostingLo: 'JCI Kuala Lumpur West', coHosting: ['JCI Kuala Lumpur Mandarin'] }, KL_LO_NAME)).toBe(false);
  });
  it('recognises the hosting LO and ignores an empty LO name', () => {
    expect(loRoleIn({ hostingLo: ' JCI Kuala Lumpur ' }, KL_LO_NAME)).toEqual({ isHosting: true, isCoHosting: false });
    expect(involvesLo({ hostingLo: 'JCI Kuala Lumpur' }, '')).toBe(false);
  });
  it('isKlRelevantEvent: KL hosts / co-hosts, or national / area / JCI level', () => {
    expect(isKlRelevantEvent({ hostingLo: 'JCI Mines', coHosting: roadmapText })).toBe(true);
    expect(isKlRelevantEvent({ hostingLo: 'JCI Mines', level: 'National' })).toBe(true);
    expect(isKlRelevantEvent({ hostingLo: 'JCI Mines', level: 'Area Central' })).toBe(true);
    expect(isKlRelevantEvent({ hostingLo: 'JCI Mines', level: 'Local' })).toBe(false);
  });
});
