// @vitest-environment node
/**
 * Firestore security-rules tests for Phase 1 WP-3: external self-registration (members create branch
 * isExternalSelfRegistration) and public sisterChapters read. Same REST harness as externalMembers.rules.test.ts.
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

/** Unsigned ID token (emulator only); 'anon' = no Authorization header. */
function authHeader(uid: string): Record<string, string> {
  if (uid === 'anon') return {};
  if (uid === 'owner') return { Authorization: 'Bearer owner' };
  const now = Math.floor(Date.now() / 1000);
  const payload = {
    iss: `https://securetoken.google.com/${PROJECT}`, aud: PROJECT, auth_time: now, iat: now, exp: now + 3600,
    sub: uid, user_id: uid, email: `${uid}@example.test`, email_verified: false,
    firebase: { sign_in_provider: 'password', identities: {} },
  };
  return { Authorization: `Bearer ${b64({ alg: 'none', typ: 'JWT' })}.${b64(payload)}.` };
}

async function getDoc(uid: string, path: string): Promise<number> {
  return (await fetch(`${BASE}/${path}`, { headers: authHeader(uid) })).status;
}
async function list(uid: string, collectionId: string): Promise<number> {
  const res = await fetch(`${BASE}:runQuery`, {
    method: 'POST',
    headers: { ...authHeader(uid), 'Content-Type': 'application/json' },
    body: JSON.stringify({ structuredQuery: { from: [{ collectionId }] } }),
  });
  return res.status;
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

/** What hooks/useAuth.tsx signUpExternal writes. */
const external = (extra: Doc = {}, affiliation: Doc = {}): Doc => ({
  general: { name: 'New Person', avatarUrl: 'https://ui-avatars.com/api/?name=N', fullName: 'New Person Full', dob: '1990-07-06' },
  contact: { email: 'new@example.test', phone: '+65 9123 4567' },
  role: 'AFFILIATE',
  loId: SG,
  affiliation: { category: 'sister', country: 'Singapore', status: 'pending_chapter', ...affiliation },
  tier: 'Bronze', points: 0, churnRisk: 'Low', attendanceRate: 100, duesStatus: 'Pending', badges: [],
  jciCareer: { joinDate: '2026-10-20' },
  ...extra,
});

describe.skipIf(!HOST)('firestore.rules — WP-3 external self-registration (emulator)', () => {
  beforeAll(async () => {
    await fetch(`http://${HOST}/emulator/v1/projects/${PROJECT}/databases/(default)/documents`, { method: 'DELETE' });
    expect(await commit('owner', [
      ['sisterChapters/jcicitysg', { name: 'JCI City Singapore', country: 'Singapore', type: ['sister_lo'], isActive: true }],
      ['sisterChapters/jcioff', { name: 'JCI Off', country: 'Japan', type: ['global'], isActive: false }],
      ['members/already', external()],
      ['members/klAdmin', { role: 'ADMIN', loId: 'jcikl', general: { name: 'Admin' } }],
    ])).toBe(OK);
  });

  describe('sisterChapters: public read (decision 5)', () => {
    it('anyone can get and list chapters, even signed out', async () => {
      expect(await getDoc('anon', 'sisterChapters/jcicitysg')).toBe(OK);
      expect(await list('anon', 'sisterChapters')).toBe(OK);
      expect(await list('newbie', 'sisterChapters')).toBe(OK);
    });
    it('writes stay SUPER_ADMIN only', async () => {
      expect(await set('anon', 'sisterChapters/x', { name: 'X', country: 'X', isActive: true })).toBe(DENIED);
      expect(await set('newbie', 'sisterChapters/x', { name: 'X', country: 'X', isActive: true })).toBe(DENIED);
      expect(await set('klAdmin', 'sisterChapters/x', { name: 'X', country: 'X', isActive: true })).toBe(DENIED);
    });
  });

  describe('allowed shape', () => {
    it('a new user may create their own pending_chapter AFFILIATE doc for an active chapter', async () => {
      expect(await set('ok1', 'members/ok1', external())).toBe(OK);
    });
    it('minimal shape (no optional defaults) is allowed too', async () => {
      expect(await set('ok2', 'members/ok2', {
        general: { name: 'Min' }, contact: { email: 'min@example.test' }, role: 'AFFILIATE', loId: SG,
        affiliation: { category: 'apicc', country: 'Singapore', status: 'pending_chapter' },
      })).toBe(OK);
    });
    it('GUEST self sign-up still works (regression)', async () => {
      expect(await set('guest1', 'members/guest1', {
        general: { name: 'Guest' }, contact: { email: 'g@example.test' }, role: 'GUEST', loId: 'jcikl',
        tier: 'Bronze', points: 0, badges: [], jciCareer: { joinDate: '2026-10-20' },
      })).toBe(OK);
    });
  });

  describe('denied variants', () => {
    const cases: Array<[string, string, string, Doc]> = [
      ['another uid', 'other', 'members/bad1', external()],
      ['role CHAPTER_ADMIN', 'bad2', 'members/bad2', external({ role: 'CHAPTER_ADMIN' })],
      ['role MEMBER on a sister chapter', 'bad3', 'members/bad3', external({ role: 'MEMBER' })],
      ['role GUEST with affiliation', 'bad3b', 'members/bad3b', external({ role: 'GUEST' })],
      ['loId jcikl', 'bad4', 'members/bad4', external({ loId: 'jcikl' })],
      ['loId missing', 'bad5', 'members/bad5', (() => { const d = external(); delete d.loId; return d; })()],
      ['loId not a string', 'bad5b', 'members/bad5b', external({ loId: 5 })],
      ['unknown chapter', 'bad6', 'members/bad6', external({ loId: 'jcinowhere' })],
      ['inactive chapter', 'bad7', 'members/bad7', external({ loId: 'jcioff' }, { country: 'Japan' })],
      ['status active', 'bad8', 'members/bad8', external({}, { status: 'active' })],
      ['status pending_kl', 'bad9', 'members/bad9', external({}, { status: 'pending_kl' })],
      ['country differs from chapter', 'bad10', 'members/bad10', external({}, { country: 'Malaysia' })],
      ['extra affiliation key', 'bad11', 'members/bad11', external({}, { chapterApprovedBy: 'bad11' })],
      ['affiliation missing category', 'bad12', 'members/bad12', external({ affiliation: { country: 'Singapore', status: 'pending_chapter' } })],
      ['unknown category', 'bad13', 'members/bad13', external({}, { category: 'kl' })],
      ['affiliation not a map', 'bad13b', 'members/bad13b', external({ affiliation: 'pending_chapter' })],
      ['extra top-level key (board flag)', 'bad14', 'members/bad14', external({ isCurrentBoardMember: true })],
      ['extra top-level key (privacy)', 'bad15', 'members/bad15', external({ privacy: { shareCardInternationally: true } })],
      ['extra top-level key (birthdayMMDD)', 'bad15b', 'members/bad15b', external({ birthdayMMDD: '0706' })],
      ['points granted', 'bad16', 'members/bad16', external({ points: 100 })],
      ['badges granted', 'bad17', 'members/bad17', external({ badges: ['x'] })],
      ['jciCareer beyond joinDate', 'bad18', 'members/bad18', external({ jciCareer: { joinDate: '2026-10-20', position: 'President' } })],
      ['no name', 'bad19', 'members/bad19', external({ general: { fullName: 'x' } })],
      ['no email', 'bad20', 'members/bad20', external({ contact: { phone: '1' } })],
    ];
    it.each(cases)('%s', async (_label, uid, path, data) => {
      expect(await set(uid, path, data)).toBe(DENIED);
    });
    it('signed-out users cannot create member docs', async () => {
      expect(await set('anon', 'members/anon1', external())).toBe(DENIED);
    });
  });
});
