import { describe, it, expect } from 'vitest';
import { buildSelfSignUpMember, buildExternalSignUpMember } from '../../utils/signUpPayload';
import { getExternalStatusMessage } from '../../utils/externalAccess';

// Mirrors firestore.rules selfSignUpKeys() (+ 'affiliation' for isExternalSelfRegistration).
const SELF_SIGN_UP_KEYS = [
  'email', 'name', 'displayName', 'photoURL', 'photoUrl', 'createdAt', 'role', 'status', 'loId',
  'general', 'contact', 'membership', 'others', 'skills', 'surveyAnswers', 'personaType', 'tendencyTags',
  'tier', 'points', 'churnRisk', 'attendanceRate', 'duesStatus', 'badges', 'jciCareer',
];

const hasUndefined = (v: unknown): boolean =>
  v === undefined || (v !== null && typeof v === 'object' && Object.values(v as object).some(hasUndefined));

describe('buildSelfSignUpMember (GUEST sign-up)', () => {
  it('reads general.* / contact.phone, defaults loId to jcikl and role GUEST, strips top-level undefined', () => {
    const doc = buildSelfSignUpMember('Ali', 'ali@x.com', {
      general: { fullName: 'Ali Bin Abu', gender: 'Male', dob: '1990-01-02', nationality: 'Malaysia' },
      contact: { phone: '0123' },
      selectedHobbies: ['Golf'],
      personaType: 'Leader',
    });
    expect(doc).toMatchObject({
      role: 'GUEST', loId: 'jcikl',
      general: { name: 'Ali', fullName: 'Ali Bin Abu', gender: 'Male', dob: '1990-01-02', nationality: 'Malaysia' },
      contact: { email: 'ali@x.com', phone: '0123' },
      others: { hobbies: ['Golf'] },
      personaType: 'Leader', tier: 'Bronze', points: 0, badges: [],
    });
    expect(Object.values(doc).some(v => v === undefined)).toBe(false);
    for (const k of Object.keys(doc)) expect(SELF_SIGN_UP_KEYS).toContain(k);
  });
});

describe('buildExternalSignUpMember', () => {
  const base = { name: 'Siti', email: 'siti@x.sg', loId: 'jcicitysg', chapter: { country: 'Singapore', type: ['sister_lo'] } };

  it('builds the exact shape isExternalSelfRegistration accepts', () => {
    const doc = buildExternalSignUpMember({ ...base, dob: '1992-03-04', phone: ' +65 1 ', gender: 'Female', fullName: ' Siti Full ' });
    expect(doc).toMatchObject({
      role: 'AFFILIATE', loId: 'jcicitysg',
      affiliation: { category: 'sister', country: 'Singapore', status: 'pending_chapter' },
      general: { name: 'Siti', fullName: 'Siti Full', gender: 'Female', dob: '1992-03-04' },
      contact: { email: 'siti@x.sg', phone: '+65 1' },
      tier: 'Bronze', points: 0, churnRisk: 'Low', attendanceRate: 100, duesStatus: 'Pending', badges: [],
    });
    expect(Object.keys(doc.affiliation as object).sort()).toEqual(['category', 'country', 'status']);
    expect(Object.keys(doc.jciCareer as object)).toEqual(['joinDate']);
    for (const k of Object.keys(doc)) expect([...SELF_SIGN_UP_KEYS, 'affiliation']).toContain(k);
  });

  it('omits empty optional fields (no nested undefined), never writes birthdayMMDD / privacy', () => {
    const doc = buildExternalSignUpMember(base);
    expect(hasUndefined(doc)).toBe(false);
    expect(doc.general).toEqual({ name: 'Siti', avatarUrl: expect.any(String) });
    expect(doc.contact).toEqual({ email: 'siti@x.sg' });
    expect(doc).not.toHaveProperty('birthdayMMDD');
    expect(doc).not.toHaveProperty('privacy');
  });

  it('category follows the chapter type', () => {
    expect((buildExternalSignUpMember({ ...base, chapter: { country: 'Japan', type: ['apicc'] } }).affiliation as any).category).toBe('apicc');
    expect((buildExternalSignUpMember({ ...base, chapter: { country: 'Japan', type: ['global'] } }).affiliation as any).category).toBe('global');
  });
});

describe('getExternalStatusMessage', () => {
  it('has a rejected message', () => {
    expect(getExternalStatusMessage('rejected').title).toMatch(/not approved/i);
  });
});
