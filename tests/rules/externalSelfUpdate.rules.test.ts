// @vitest-environment node
/**
 * "Share my card" for external members: hooks/useSisterChapterMembers optIn() calls
 * MembersService.updateMember(uid, { privacy }). This test runs the REAL updateMember with a fake
 * firebase/firestore that captures the updateDoc payload, then sends exactly that payload (updateDoc =
 * top-level field mask) to the local Firestore emulator as the member themself.
 *
 * Before the fix, updateMember recomputed jciCareer.membershipType (and role) for externals, which the
 * self-update rule locks → permission denied. KL members keep the recompute.
 *
 * Runs ONLY against the local Firestore emulator (never production) and is skipped otherwise.
 *   firebase emulators:exec --only firestore --project demo-jcikl-rules "npx vitest run tests/rules --no-file-parallelism"
 */
import { describe, it, expect, beforeAll, vi } from 'vitest';

type Plain = null | boolean | number | string | Plain[] | { [key: string]: Plain };
type Doc = { [key: string]: Plain };

const HOST = process.env.FIRESTORE_EMULATOR_HOST;
const PROJECT = process.env.GCLOUD_PROJECT || 'demo-jcikl-rules';
const ROOT = `projects/${PROJECT}/databases/(default)/documents`;
const BASE = `http://${HOST}/v1/${ROOT}`;
const SG = 'jcicitysg';

const SEED: Record<string, Doc> = {
  affOpt: {
    role: 'AFFILIATE', loId: SG,
    affiliation: { category: 'sister', country: 'Singapore', status: 'active' },
    general: { name: 'Ann', nationality: 'Singapore' },
    contact: { email: 'ann@example.test' },
    business: { companyName: 'Acme', position: 'CEO' },
    privacy: { showPhone: true },
  },
  chOpt: {
    role: 'CHAPTER_ADMIN', loId: SG,
    affiliation: { category: 'sister', country: 'Singapore', status: 'active' },
    general: { name: 'Ben', nationality: 'Singapore', dob: '1990-01-01' },
    contact: { email: 'ben@example.test' },
    jciCareer: { joinDate: '2020-01-01' },
  },
  klMember: {
    role: 'MEMBER', loId: 'jcikl',
    general: { name: 'Kay', nationality: 'Malaysia', dob: '1995-05-05' },
    contact: { email: 'kay@example.test' },
    jciCareer: { membershipType: 'Probation' },
  },
};

// Fake Timestamp so the captured payload can be converted to a REST timestampValue.
class FakeTimestamp { constructor(public iso: string) {} }
const captured: Array<{ path: string; data: Record<string, unknown> }> = [];

vi.mock('firebase/firestore', () => {
  const doc = (_db: unknown, ...segments: string[]) => ({ path: segments.join('/') });
  const getDoc = async (ref: { path: string }) => {
    const [coll, id] = ref.path.split('/');
    const data = coll === 'members' ? SEED[id] : undefined;
    return { exists: () => !!data, data: () => (data ? JSON.parse(JSON.stringify(data)) : undefined), id };
  };
  const updateDoc = async (ref: { path: string }, data: Record<string, unknown>) => { captured.push({ path: ref.path, data }); };
  const fn = () => vi.fn();
  return {
    collection: fn(), getDocs: fn(), addDoc: fn(), deleteDoc: fn(), setDoc: fn(), query: fn(), where: fn(),
    orderBy: fn(), limit: fn(), startAfter: fn(), writeBatch: fn(), runTransaction: fn(), deleteField: fn(),
    arrayRemove: fn(), arrayUnion: fn(), increment: fn(), serverTimestamp: fn(),
    doc, getDoc, updateDoc,
    Timestamp: { now: () => new FakeTimestamp(new Date().toISOString()), fromDate: (d: Date) => new FakeTimestamp(d.toISOString()) },
  };
});
vi.mock('../../config/firebase', () => ({ db: {}, auth: { currentUser: null } }));
vi.mock('../../utils/devMode', () => ({ isDevMode: () => false, withDevMode: (_m: unknown, real: () => unknown) => real() }));
vi.mock('../../services/errorLoggingService', () => ({
  errorLoggingService: { logError: vi.fn(), logWarning: vi.fn(), logInfo: vi.fn() },
  logError: vi.fn(),
}));
vi.mock('../../services/firestoreLogger', () => ({ logWrite: vi.fn(), logDelete: vi.fn(), logRead: vi.fn(), logPerf: vi.fn() }));
vi.mock('../../services/auditLogService', () => ({ AuditLogService: { log: vi.fn(), logAction: vi.fn() } }));
vi.mock('../../services/larkSyncService', () => ({ LarkSyncService: { syncRecord: vi.fn() } }));
vi.mock('../../services/memberCardsService', () => ({
  MemberCardsService: { syncCards: vi.fn(async () => undefined), applyUpdates: (m: unknown) => m },
}));

import { MembersService } from '../../services/membersService';
import { toExternalSelfUpdate } from '../../utils/externalAccess';

function toValue(v: unknown): Record<string, unknown> {
  if (v instanceof FakeTimestamp) return { timestampValue: v.iso };
  if (v === null || v === undefined) return { nullValue: null };
  if (typeof v === 'boolean') return { booleanValue: v };
  if (typeof v === 'number') return Number.isInteger(v) ? { integerValue: String(v) } : { doubleValue: v };
  if (typeof v === 'string') return { stringValue: v };
  if (Array.isArray(v)) return { arrayValue: { values: v.map(toValue) } };
  return { mapValue: { fields: toFields(v as Record<string, unknown>) } };
}
function toFields(d: Record<string, unknown>): Record<string, Record<string, unknown>> {
  const out: Record<string, Record<string, unknown>> = {};
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
/**
 * Same semantics as updateDoc(ref, data): each key replaces that field; a dotted key ('general.birthPlace')
 * is a nested field path, overlaid on the map of the same name when both are sent (as the SDK does).
 */
async function patch(uid: string, path: string, data: Record<string, unknown>, fullReplace = false): Promise<number> {
  const nested: Record<string, unknown> = {};
  const paths: string[] = [];
  for (const [key, value] of Object.entries(data)) {
    const parts = key.split('.');
    let node = nested;
    for (const p of parts.slice(0, -1)) {
      if (typeof node[p] !== 'object' || node[p] === null) node[p] = {};
      node = node[p] as Record<string, unknown>;
    }
    const leaf = parts[parts.length - 1];
    node[leaf] = (typeof value === 'object' && value !== null && !Array.isArray(value) && !(value instanceof FakeTimestamp)
      && typeof node[leaf] === 'object' && node[leaf] !== null) ? { ...(node[leaf] as object), ...(value as object) } : value;
    paths.push(key);
  }
  // Drop mask paths already covered by a parent path in the mask (the parent's value carries them).
  const mask = paths.filter(p => !paths.some(q => q !== p && p.startsWith(`${q}.`)));
  const res = await fetch(`${BASE}:commit`, {
    method: 'POST',
    headers: { ...authHeader(uid), 'Content-Type': 'application/json' },
    body: JSON.stringify({
      writes: [{
        update: { name: `${ROOT}/${path}`, fields: toFields(nested) },
        ...(fullReplace ? {} : { updateMask: { fieldPaths: mask } }),
      }],
    }),
  });
  return res.status;
}

/** Runs the real MembersService.updateMember and returns the payload it handed to updateDoc. */
async function updateMemberPayload(id: string, updates: Record<string, unknown>) {
  captured.length = 0;
  await MembersService.updateMember(id, updates as any);
  expect(captured).toHaveLength(1);
  return captured[0].data;
}

describe.skipIf(!HOST)('firestore.rules — external "Share my card" through MembersService.updateMember (emulator)', () => {
  beforeAll(async () => {
    await fetch(`http://${HOST}/emulator/v1/projects/${PROJECT}/databases/(default)/documents`, { method: 'DELETE' });
    for (const [id, d] of Object.entries(SEED)) expect(await patch('owner', `members/${id}`, d, true)).toBe(200);
  });

  it('AFFILIATE opting in: the payload touches no locked key and the rules allow it', async () => {
    const payload = await updateMemberPayload('affOpt', { privacy: { showPhone: true, shareCardInternationally: true } });
    expect(await patch('affOpt', 'members/affOpt', payload)).toBe(200);
    expect(payload).not.toHaveProperty('role');
    expect((payload.jciCareer as Record<string, unknown> | undefined)?.membershipType).toBeUndefined();
  });

  // Directory bookmarks: useBusinessBookmarks -> useAuth.updateMemberProfile(setDoc merge) writes
  // { business: { ...own business, bookmarkedBusinessIds }, updatedAt } on the external's own doc.
  it('AFFILIATE can bookmark directory cards on their own member doc', async () => {
    const payload = { business: { ...(SEED.affOpt.business as Doc), bookmarkedBusinessIds: ['klMember'] }, updatedAt: '2026-10-26T00:00:00.000Z' };
    expect(await patch('affOpt', 'members/affOpt', payload)).toBe(200);
  });

  it('CHAPTER_ADMIN (with jciCareer) opting in is allowed', async () => {
    const payload = await updateMemberPayload('chOpt', { privacy: { shareCardInternationally: true } });
    expect(await patch('chOpt', 'members/chOpt', payload)).toBe(200);
    expect(payload).not.toHaveProperty('role');
  });

  // MemberDetail handleGlobalSave payload for an external editing their own profile (startInlineEdit
  // defaults: nationality 'Malaysia' when empty, '' for id number / dob / introducer / senatorship).
  const globalSave = (extra: Record<string, unknown> = {}) => ({
    avatar: '', avatarUrl: '', name: 'Ann', fullName: 'Ann Tan', idNumber: '',
    birthPlace: 'Singapore', 'general.birthPlace': 'Singapore',
    dateOfBirth: '', gender: 'Female', ethnicity: 'Chinese', 'general.ethnicity': 'Chinese',
    nationality: 'Malaysia', introducer: '', bio: 'Hi', hobbies: ['Golf'], skills: ['Sales'],
    companyName: 'Acme', companyWebsite: 'acme.test', companyDescription: 'We build', departmentAndPosition: 'CEO',
    'business.companyDescription': 'We build', 'business.departmentAndPosition': 'CEO',
    acceptInternationalBusiness: 'Yes', businessCategory: [], industry: 'Tech', interestedIndustries: [],
    'business.interestedIndustries': [], levelOfManagement: '', idealReferralIndustry: '', idealReferral: '',
    specialOffers: [], privacy: { showPhone: true, showAlternatePhone: true, showSocials: true },
    phone: '123', alternatePhone: '', email: 'ann@example.test', whatsappGroup: false, address: '',
    emergencyContactName: '', emergencyContactRelationship: '', emergencyContactPhone: '',
    linkedin: '', facebook: '', instagram: '', wechat: '',
    cutStyle: '', tshirtSize: '', jacketSize: '', tshirtStatus: 'NA', embroideredName: '',
    senatorshipId: '', senatorCertified: false, senatorshipBoardValidated: false,
    senatorshipValidatedBy: '', 'jciCareer.senatorshipValidatedBy': '',
    senatorshipValidatedAt: '', 'jciCareer.senatorshipValidatedAt': '',
    role: 'AFFILIATE',
    ...extra,
  });

  it('external profile save from MemberDetail: denied as-is, allowed after toExternalSelfUpdate', async () => {
    const raw = await updateMemberPayload('affOpt', globalSave());
    expect(await patch('affOpt', 'members/affOpt', raw)).toBe(403);
    const clean = await updateMemberPayload('affOpt', toExternalSelfUpdate(globalSave()));
    expect(await patch('affOpt', 'members/affOpt', clean)).toBe(200);
  });

  it('KL MEMBER keeps the membershipType recompute (unchanged behaviour)', async () => {
    const payload = await updateMemberPayload('klMember', { privacy: { shareCardInternationally: true } });
    expect((payload.jciCareer as Record<string, unknown>).membershipType).toBeDefined();
    expect(await patch('klMember', 'members/klMember', payload)).toBe(200);
  });
});
