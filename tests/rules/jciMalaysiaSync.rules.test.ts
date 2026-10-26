// @vitest-environment node
/**
 * JCI Malaysia sync collections (systemSecrets, jciMalaysiaOverrides, jciMalaysiaSyncRuns) are Admin SDK only:
 * no client get / list / create / update / delete for anyone — the owner (SUPER_ADMIN), an ADMIN, a developer
 * (members.isDeveloper and a developer token claim) and the member a pick is about.
 * Emulator only; skipped otherwise.
 *
 * Run (needs Java 11+ and the firebase CLI):
 *   firebase emulators:exec --only firestore --project demo-jcikl-rules "npx vitest run tests/rules"
 */
import { describe, it, expect, beforeAll } from 'vitest';

const HOST = process.env.FIRESTORE_EMULATOR_HOST;
// Own project id so this file's data is isolated from the other rules test files.
const PROJECT = 'demo-jcikl-jcimsync';
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

function authHeader(uid: string, claims: Record<string, unknown> = {}): Record<string, string> {
  if (uid === 'adminSdk') return { Authorization: 'Bearer owner' };
  const now = Math.floor(Date.now() / 1000);
  const payload = {
    iss: `https://securetoken.google.com/${PROJECT}`, aud: PROJECT, auth_time: now, iat: now, exp: now + 3600,
    sub: uid, user_id: uid, email: `${uid}@example.test`, email_verified: true,
    firebase: { sign_in_provider: 'password', identities: {} }, ...claims,
  };
  return { Authorization: `Bearer ${b64({ alg: 'none', typ: 'JWT' })}.${b64(payload)}.` };
}

type Caller = { uid: string; claims?: Record<string, unknown> };
const headers = (c: Caller) => authHeader(c.uid, c.claims);

async function commit(c: Caller, path: string, data: Doc, mustExist?: boolean): Promise<number> {
  const res = await fetch(`${BASE}:commit`, {
    method: 'POST',
    headers: { ...headers(c), 'Content-Type': 'application/json' },
    body: JSON.stringify({
      writes: [{
        update: { name: `${ROOT}/${path}`, fields: toFields(data) },
        ...(mustExist === undefined ? {} : { currentDocument: { exists: mustExist } }),
      }],
    }),
  });
  return res.status;
}

const OK = 200;
const DENIED = 403;
const KL = 'jcikl';
const person = (role: string, extra: Doc = {}): Doc => ({
  role, loId: KL, general: { name: role }, contact: { email: `${role.toLowerCase()}@example.test` }, ...extra,
});

const CALLERS: Record<string, Caller> = {
  owner: { uid: 'owner1' }, // SUPER_ADMIN
  admin: { uid: 'admin1' },
  developer: { uid: 'dev1' }, // members.isDeveloper == true
  developerClaim: { uid: 'devClaim1', claims: { developer: true, isDeveloper: true } },
  pickedMember: { uid: 'member1' }, // jciMalaysiaOverrides/member1 is about this member
};

const DOCS: Record<string, Doc> = {
  'systemSecrets/jciMalaysiaSource': { type: 'service_account', project_id: 'demo-source', client_email: 'x@demo-source.test', private_key: 'not-a-real-key' },
  'jciMalaysiaOverrides/member1': { sourceId: '123', pickedBy: 'dev1', pickedAt: '2026-10-26T00:00:00.000Z' },
  'jciMalaysiaSyncRuns/run1': { by: 'dev1', at: '2026-10-26T00:00:00.000Z', counts: { toWrite: 1 }, before: [{ memberId: 'member1', before: { jciMalaysiaMembershipNo: null } }] },
};

describe.skipIf(!HOST)('firestore.rules — JCI Malaysia sync collections are Admin SDK only (emulator)', () => {
  beforeAll(async () => {
    await fetch(`http://${HOST}/emulator/v1/projects/${PROJECT}/databases/(default)/documents`, { method: 'DELETE' });
    const seed: Record<string, Doc> = {
      'members/owner1': person('SUPER_ADMIN', { isDeveloper: true }),
      'members/admin1': person('ADMIN'),
      'members/dev1': person('MEMBER', { isDeveloper: true }),
      'members/devClaim1': person('MEMBER'),
      'members/member1': person('MEMBER'),
      ...DOCS,
    };
    for (const [path, data] of Object.entries(seed)) expect(await commit({ uid: 'adminSdk' }, path, data)).toBe(OK);
  });

  for (const [path, data] of Object.entries(DOCS)) {
    const collection = path.split('/')[0];
    for (const [who, caller] of Object.entries(CALLERS)) {
      it(`${collection}: ${who} cannot get, list, create, update or delete`, async () => {
        expect((await fetch(`${BASE}/${path}`, { headers: headers(caller) })).status).toBe(DENIED);
        expect((await fetch(`${BASE}/${collection}`, { headers: headers(caller) })).status).toBe(DENIED);
        expect(await commit(caller, `${collection}/new-${caller.uid}`, data, false)).toBe(DENIED);
        expect(await commit(caller, path, data, true)).toBe(DENIED);
        expect((await fetch(`${BASE}/${path}`, { method: 'DELETE', headers: headers(caller) })).status).toBe(DENIED);
      });
    }
    it(`${collection}: the seeded doc is still there (Admin SDK can read it)`, async () => {
      expect((await fetch(`${BASE}/${path}`, { headers: authHeader('adminSdk') })).status).toBe(OK);
    });
  }
});
