// @vitest-environment node
/**
 * Own-email change: a member may update their own contact.email on the member doc (KL and external), but
 * cannot move their memberEmails slot from the client (that is why netlify/functions/self-email does it).
 * Emulator only; skipped otherwise.
 *
 * Run (needs Java 11+ and the firebase CLI):
 *   firebase emulators:exec --only firestore --project demo-jcikl-rules "npx vitest run tests/rules"
 */
import { describe, it, expect, beforeAll } from 'vitest';

const HOST = process.env.FIRESTORE_EMULATOR_HOST;
// Own project id so this file's data is isolated from the other rules test files running in parallel.
const PROJECT = 'demo-jcikl-selfemail';
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
const klMember = {
  role: 'MEMBER', loId: KL, general: { name: 'Ali Tan' }, contact: { email: 'ali@example.test' },
  privacy: { shareCardInternationally: false },
};
const aff = {
  role: 'AFFILIATE', loId: 'jcicitysg', general: { name: 'Mei Lim' }, contact: { email: 'mei@example.test' },
  affiliation: { category: 'sister', country: 'Singapore', status: 'active' },
};
const slot = (email: string, memberId: string): Doc => ({ email, memberId, createdAt: '2026-01-01T00:00:00.000Z' });

describe.skipIf(!HOST)('firestore.rules — own email change (emulator)', () => {
  beforeAll(async () => {
    await fetch(`http://${HOST}/emulator/v1/projects/${PROJECT}/databases/(default)/documents`, { method: 'DELETE' });
    expect(await commit('owner', [
      { path: 'members/klMember', data: klMember as Doc },
      { path: 'members/aff', data: aff as Doc },
      { path: 'members/klAdmin', data: { role: 'ADMIN', loId: KL, general: { name: 'Admin' }, contact: { email: 'admin@example.test' } } as Doc },
      { path: 'memberEmails/ali@example.test', data: slot('ali@example.test', 'klMember') },
      { path: 'memberEmails/mei@example.test', data: slot('mei@example.test', 'aff') },
    ])).toBe(OK);
  });

  it('KL member can update their own contact.email on the member doc', async () => {
    expect(await commit('klMember', [{ path: 'members/klMember', data: { contact: { email: 'ali2@example.test' } }, maskFields: ['contact.email'] }])).toBe(OK);
  });

  it('active external can update their own contact.email on the member doc', async () => {
    expect(await commit('aff', [{ path: 'members/aff', data: { contact: { email: 'mei2@example.test' } }, maskFields: ['contact.email'] }])).toBe(OK);
  });

  it('emailChangeRequests: no client read or write, not even by the owner or an admin', async () => {
    const req: Doc = { newEmail: 'ali2@example.test', requestedAt: '2026-10-26T00:00:00.000Z' };
    expect(await commit('klMember', [{ path: 'emailChangeRequests/klMember', data: req }])).toBe(DENIED);
    expect(await commit('klAdmin', [{ path: 'emailChangeRequests/klMember', data: req }])).toBe(DENIED);
    expect(await commit('owner', [{ path: 'emailChangeRequests/klMember', data: req }])).toBe(OK);
    for (const uid of ['klMember', 'klAdmin']) {
      const res = await fetch(`${BASE}/emailChangeRequests/klMember`, { headers: authHeader(uid) });
      expect(res.status).toBe(DENIED);
    }
  });

  it('a member cannot create their new memberEmails slot from the client', async () => {
    expect(await commit('klMember', [{ path: 'memberEmails/ali2@example.test', data: slot('ali2@example.test', 'klMember') }])).toBe(DENIED);
    expect(await commit('aff', [{ path: 'memberEmails/mei2@example.test', data: slot('mei2@example.test', 'aff') }])).toBe(DENIED);
  });
});
