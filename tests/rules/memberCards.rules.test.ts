// @vitest-environment node
/**
 * Rules test (Phase 0 WP2): a card produced by buildMemberCard() is accepted by the memberCards rule,
 * and the opt-in toggle (member doc + card in ONE commit) works. Emulator only; skipped otherwise.
 *
 * Run (needs Java 11+ and the firebase CLI):
 *   firebase emulators:exec --only firestore --project demo-jcikl-rules "npx vitest run tests/rules"
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { buildMemberCard } from '../../utils/memberCard.mjs';

const HOST = process.env.FIRESTORE_EMULATOR_HOST;
// Own project id so this file's data is isolated from the other rules test files running in parallel.
const PROJECT = 'demo-jcikl-cards';
const ROOT = `projects/${PROJECT}/databases/(default)/documents`;
const BASE = `http://${HOST}/v1/${ROOT}`;

type Plain = null | boolean | number | string | Plain[] | { [key: string]: Plain };
type Doc = { [key: string]: Plain };

function toValue(v: Plain): Record<string, unknown> {
  if (v === null) return { nullValue: null };
  if (typeof v === 'boolean') return { booleanValue: v };
  if (typeof v === 'number') return { integerValue: String(v) };
  if (typeof v === 'string') return { stringValue: v };
  if (Array.isArray(v)) return { arrayValue: { values: v.map(toValue) } };
  return { mapValue: { fields: toFields(v) } };
}
const toFields = (d: Doc) => Object.fromEntries(Object.entries(d).map(([k, v]) => [k, toValue(v)]));
const b64 = (o: object) => Buffer.from(JSON.stringify(o)).toString('base64url');

function authHeader(uid: string): Record<string, string> {
  if (uid === 'owner') return { Authorization: 'Bearer owner' };
  const now = Math.floor(Date.now() / 1000);
  const payload = {
    iss: `https://securetoken.google.com/${PROJECT}`, aud: PROJECT, auth_time: now, iat: now, exp: now + 3600,
    sub: uid, user_id: uid, email: `${uid}@example.test`, email_verified: true,
    firebase: { sign_in_provider: 'password', identities: {} },
  };
  return { Authorization: `Bearer ${b64({ alg: 'none', typ: 'JWT' })}.${b64(payload)}.` };
}

type Write = { path: string; data: Doc; maskFields?: string[] };
async function commit(uid: string, writes: Write[]): Promise<number> {
  const res = await fetch(`${BASE}:commit`, {
    method: 'POST',
    headers: { ...authHeader(uid), 'Content-Type': 'application/json' },
    body: JSON.stringify({
      writes: writes.map(w => ({
        update: { name: `${ROOT}/${w.path}`, fields: toFields(w.data) },
        ...(w.maskFields ? { updateMask: { fieldPaths: w.maskFields } } : {}),
      })),
    }),
  });
  return res.status;
}

const OK = 200;
const DENIED = 403;
const KL = 'jcikl';
const SG = 'jcicitysg';

const klMember = {
  id: 'klMember', role: 'MEMBER', loId: KL,
  general: { name: 'Ali Tan', avatarUrl: 'https://img.example/a.png' },
  contact: { email: 'ali@example.test' },
  business: {
    companyName: 'Acme Sdn Bhd', position: 'Director', industry: 'IT', businessCategory: ['Software'],
    companyDescription: 'We build things', companyWebsite: 'https://acme.example',
    acceptInternationalBusiness: 'Yes', specialOffer: { description: '10% off' },
  },
  privacy: { shareCardInternationally: false },
};
const aff1 = {
  id: 'aff1', role: 'AFFILIATE', loId: SG,
  general: { name: 'Mei Lim' },
  business: { companyName: 'Lion Pte', position: 'CEO' },
  affiliation: { category: 'sister', country: 'Singapore', status: 'active' },
  privacy: { shareCardInternationally: false },
};
const klAdmin = { id: 'klAdmin', role: 'ADMIN', loId: KL, general: { name: 'Admin' } };
const klGuest = { id: 'klGuest', role: 'GUEST', loId: KL, general: { name: 'Guest' } };

const { id: _i1, ...klMemberDoc } = klMember;
const { id: _i2, ...aff1Doc } = aff1;
const { id: _i3, ...klAdminDoc } = klAdmin;
const { id: _i4, ...klGuestDoc } = klGuest;

describe.skipIf(!HOST)('firestore.rules — buildMemberCard output (emulator)', () => {
  beforeAll(async () => {
    await fetch(`http://${HOST}/emulator/v1/projects/${PROJECT}/databases/(default)/documents`, { method: 'DELETE' });
    expect(await commit('owner', [
      { path: 'members/klMember', data: klMemberDoc as Doc },
      { path: 'members/aff1', data: aff1Doc as Doc },
      { path: 'members/klAdmin', data: klAdminDoc as Doc },
      { path: 'members/klGuest', data: klGuestDoc as Doc },
    ])).toBe(OK);
  });

  it('KL member can create own card built by buildMemberCard', async () => {
    const card = buildMemberCard(klMember) as unknown as Doc;
    expect(await commit('klMember', [{ path: 'memberCards/klMember', data: card }])).toBe(OK);
  });

  it('active external can create own card (country from affiliation)', async () => {
    const card = buildMemberCard(aff1) as unknown as Doc;
    expect(card.country).toBe('Singapore');
    expect(await commit('aff1', [{ path: 'memberCards/aff1', data: card }])).toBe(OK);
  });

  it('admin can write a card for another member', async () => {
    const card = buildMemberCard(klMember) as unknown as Doc;
    expect(await commit('klAdmin', [{ path: 'memberCards/klMember', data: card }])).toBe(OK);
  });

  it('opt-in toggle: member doc and card in ONE commit is accepted', async () => {
    const after = { ...klMember, privacy: { shareCardInternationally: true } };
    const card = buildMemberCard(after) as unknown as Doc;
    expect(card.international).toBe(true);
    expect(await commit('klMember', [
      { path: 'members/klMember', data: { ...klMemberDoc, privacy: { shareCardInternationally: true } } as Doc },
      { path: 'memberCards/klMember', data: card },
    ])).toBe(OK);
  });

  it('card whose international differs from the member doc is rejected', async () => {
    // member doc now has shareCardInternationally true (previous test); a card saying false must fail
    const card = buildMemberCard({ ...klMember, privacy: { shareCardInternationally: false } }) as unknown as Doc;
    expect(await commit('klMember', [{ path: 'memberCards/klMember', data: card }])).toBe(DENIED);
  });

  it('card with an extra key is rejected', async () => {
    const card = { ...(buildMemberCard(aff1) as unknown as Doc), phone: '+65 1234' };
    expect(await commit('aff1', [{ path: 'memberCards/aff1', data: card }])).toBe(DENIED);
  });

  it('GUEST cannot create a card', async () => {
    const card = buildMemberCard({ ...klGuest, role: 'MEMBER' }) as unknown as Doc;
    expect(await commit('klGuest', [{ path: 'memberCards/klGuest', data: card }])).toBe(DENIED);
  });
});
