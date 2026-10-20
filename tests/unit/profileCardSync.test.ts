import { describe, it, expect } from 'vitest';
import { applyMergeUpdates, planCardSync } from '../../utils/memberCard.mjs';

// Card sync decision after useAuth().updateMemberProfile (setDoc merge) — see hooks/useAuth.tsx.
const aff = {
  role: 'AFFILIATE', loId: 'jcicitysg',
  affiliation: { category: 'sister', country: 'Singapore', status: 'active' },
  general: { name: 'Ann', dob: '1990-01-01' },
  business: { companyName: 'Acme', position: 'CEO' },
  privacy: { showPhone: true, shareCardInternationally: false },
};

describe('applyMergeUpdates (setDoc merge semantics)', () => {
  it('merges nested maps instead of replacing them; arrays and scalars replace', () => {
    const after = applyMergeUpdates(aff, { business: { companyName: 'NewCo' }, skills: ['a'], phone: null });
    expect(after.business).toEqual({ companyName: 'NewCo', position: 'CEO' });
    expect(after.skills).toEqual(['a']);
    expect(after.phone).toBeNull();
    expect(after.general).toEqual(aff.general);
  });
  it('skips undefined and does not mutate the input', () => {
    const after = applyMergeUpdates(aff, { general: { name: undefined } });
    expect(after.general.name).toBe('Ann');
    expect(aff.business.companyName).toBe('Acme');
  });
});

describe('profile save → card action', () => {
  const plan = (updates: Record<string, unknown>, before: any = aff) => planCardSync(before, applyMergeUpdates(before, updates));

  it('turning on shareCardInternationally rewrites the card', () => {
    expect(plan({ privacy: { ...aff.privacy, shareCardInternationally: true } })).toBe('upsert');
  });
  it('changing a card field (company) rewrites the card', () => {
    expect(plan({ business: { companyName: 'NewCo' } })).toBe('upsert');
  });
  it('non-card fields (phone, other privacy flags, hideBirthday) leave the card alone', () => {
    expect(plan({ phone: '123', privacy: { ...aff.privacy, showPhone: false, hideBirthday: true } })).toBe('none');
  });
  it('a GUEST profile save never writes a card', () => {
    const guest = { ...aff, role: 'GUEST', loId: 'jcikl', affiliation: undefined };
    expect(plan({ privacy: { shareCardInternationally: true } }, guest)).toBe('none');
  });
  it('a KL MEMBER profile change to a card field upserts too', () => {
    const kl = { ...aff, role: 'MEMBER', loId: 'jcikl', affiliation: undefined };
    expect(plan({ privacy: { shareCardInternationally: true } }, kl)).toBe('upsert');
  });
});
