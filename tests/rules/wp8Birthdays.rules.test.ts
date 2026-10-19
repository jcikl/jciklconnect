// @vitest-environment node
/**
 * Firestore security-rules tests for Phase 1 WP-8: external members may set their own general.dob (and a
 * matching birthdayMMDD) once, while dob is empty. Same REST harness as externalMembers.rules.test.ts.
 *
 * Runs ONLY against the local Firestore emulator (never production) and is skipped otherwise.
 *   firebase emulators:exec --only firestore --project demo-jcikl-rules "npx vitest run tests/rules --no-file-parallelism"
 */
import { describe, it, expect, beforeAll } from 'vitest';

const HOST = process.env.FIRESTORE_EMULATOR_HOST;
const PROJECT = process.env.GCLOUD_PROJECT || 'demo-jcikl-rules';
const ROOT = `projects/${PROJECT}/databases/(default)/documents`;
const BASE = `http://${HOST}/v1/${ROOT}`;

type Plain = null | boolean | number | string | Plain[] | { [key: string]: Plain };
type Doc = { [key: string]: Plain };
type FsValue = Record<string, unknown>;

function toValue(v: Plain): FsValue {
  if (v === null) return { nullValue: null };
  if (typeof v === 'boolean') return { booleanValue: v };
  if (typeof v === 'number') return Number.isInteger(v) ? { integerValue: String(v) } : { doubleValue: v };
  if (typeof v === 'string') return { stringValue: v };
  if (Array.isArray(v)) return { arrayValue: { values: v.map(toValue) } };
  return { mapValue: { fields: toFields(v) } };
}
function toFields(d: Doc): Record<string, FsValue> {
  const out: Record<string, FsValue> = {};
  for (const [k, v] of Object.entries(d)) out[k] = toValue(v);
  return out;
}
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
async function commit(uid: string, writes: Array<[path: string, data: Doc]>): Promise<number> {
  const res = await fetch(`${BASE}:commit`, {
    method: 'POST',
    headers: { ...authHeader(uid), 'Content-Type': 'application/json' },
    body: JSON.stringify({ writes: writes.map(([path, data]) => ({ update: { name: `${ROOT}/${path}`, fields: toFields(data) } })) }),
  });
  return res.status;
}
const set = (uid: string, path: string, data: Doc) => commit(uid, [[path, data]]);

const OK = 200;
const DENIED = 403;
const SG = 'jcicitysg';

const member = (role: string, loId: string, general: Doc = {}, extra: Doc = {}): Doc => ({
  role,
  loId,
  general: { name: `${role} user`, nationality: 'Singapore', ...general },
  contact: { email: 'x@example.test' },
  ...(role === 'AFFILIATE' || role === 'CHAPTER_ADMIN'
    ? { affiliation: { category: 'sister', country: 'Singapore', status: 'active' } }
    : {}),
  ...extra,
});

const SEED: Record<string, Doc> = {
  affA: member('AFFILIATE', SG),
  affB: member('AFFILIATE', SG),
  affC: member('AFFILIATE', SG),
  affD: member('AFFILIATE', SG),
  affEmpty: member('AFFILIATE', SG, { dob: '' }),
  affHasDob: member('AFFILIATE', SG, { dob: '1990-07-06' }, { birthdayMMDD: '0706' }),
  chNoDob: member('CHAPTER_ADMIN', SG),
  klNoDob: member('MEMBER', 'jcikl'),
  guest: member('GUEST', 'jcikl'),
};

const withDob = (id: string, dob: Plain, extra: Doc = {}): Doc => ({
  ...SEED[id],
  general: { ...(SEED[id].general as Doc), dob },
  ...extra,
});

describe.skipIf(!HOST)('firestore.rules — WP-8 external dob once (emulator)', () => {
  beforeAll(async () => {
    await fetch(`http://${HOST}/emulator/v1/projects/${PROJECT}/databases/(default)/documents`, { method: 'DELETE' });
    expect(await commit('owner', Object.entries(SEED).map(([id, d]): [string, Doc] => [`members/${id}`, d]))).toBe(OK);
  });

  describe('allowed', () => {
    it('AFFILIATE with no dob sets dob and the matching birthdayMMDD', async () => {
      expect(await set('affA', 'members/affA', withDob('affA', '1991-02-28', { birthdayMMDD: '0228' }))).toBe(OK);
    });
    it('AFFILIATE with no dob sets dob only', async () => {
      expect(await set('affB', 'members/affB', withDob('affB', '1991-02-28'))).toBe(OK);
    });
    it('AFFILIATE whose dob is an empty string sets it', async () => {
      expect(await set('affEmpty', 'members/affEmpty', withDob('affEmpty', '1988-12-01', { birthdayMMDD: '1201' }))).toBe(OK);
    });
    it('CHAPTER_ADMIN with no dob sets dob', async () => {
      expect(await set('chNoDob', 'members/chNoDob', withDob('chNoDob', '1980-01-15', { birthdayMMDD: '0115' }))).toBe(OK);
    });
    it('GUEST may still edit dob (unchanged GUEST behaviour)', async () => {
      expect(await set('guest', 'members/guest', withDob('guest', '1999-09-09'))).toBe(OK);
    });
  });

  describe('denied', () => {
    it('only once: an external with a dob cannot change it', async () => {
      expect(await set('affHasDob', 'members/affHasDob', withDob('affHasDob', '1990-07-07', { birthdayMMDD: '0707' }))).toBe(DENIED);
      expect(await set('affHasDob', 'members/affHasDob', withDob('affHasDob', '1990-07-07'))).toBe(DENIED);
    });
    it('after setting it once, the same user cannot change it again', async () => {
      expect(await set('affA', 'members/affA', withDob('affA', '1991-03-01', { birthdayMMDD: '0301' }))).toBe(DENIED);
    });
    it('an external with a dob cannot change birthdayMMDD alone', async () => {
      expect(await set('affHasDob', 'members/affHasDob', { ...SEED.affHasDob, birthdayMMDD: '0101' })).toBe(DENIED);
    });
    it('birthdayMMDD must match the new dob', async () => {
      expect(await set('affC', 'members/affC', withDob('affC', '1991-02-28', { birthdayMMDD: '0101' }))).toBe(DENIED);
    });
    it('dob must be YYYY-MM-DD', async () => {
      expect(await set('affD', 'members/affD', withDob('affD', '28/02/1991'))).toBe(DENIED);
      expect(await set('affD', 'members/affD', withDob('affD', 19910228))).toBe(DENIED);
    });
    it('a KL MEMBER still cannot set their own dob', async () => {
      expect(await set('klNoDob', 'members/klNoDob', withDob('klNoDob', '1990-01-01'))).toBe(DENIED);
    });
    it('GUEST still cannot set birthdayMMDD', async () => {
      expect(await set('guest', 'members/guest', withDob('guest', '1999-09-09', { birthdayMMDD: '0909' }))).toBe(DENIED);
    });
    it('nobody can set another member’s dob through the self branch', async () => {
      expect(await set('affD', 'members/chNoDob', withDob('chNoDob', '1980-01-15'))).toBe(DENIED);
    });
  });
});
