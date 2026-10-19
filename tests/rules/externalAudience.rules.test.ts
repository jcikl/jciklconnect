// @vitest-environment node
/**
 * Firestore security-rules tests for Phase 1 WP-5: surveys / hobby clubs opened to other JCI chapters
 * (`openToExternals`, ticked by board/admin only).
 *
 * Runs ONLY against the local Firestore emulator and is skipped otherwise. Same REST harness as
 * tests/rules/externalMembers.rules.test.ts (seed with `Bearer owner`, unsigned emulator tokens).
 *
 * Run (needs Java 11+ and the firebase CLI):
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

/** Unsigned ID token — accepted by the emulator only. */
function authHeader(uid: string | 'owner'): Record<string, string> {
  if (uid === 'owner') return { Authorization: 'Bearer owner' };
  const now = Math.floor(Date.now() / 1000);
  const payload = {
    iss: `https://securetoken.google.com/${PROJECT}`,
    aud: PROJECT,
    auth_time: now,
    iat: now,
    exp: now + 3600,
    sub: uid,
    user_id: uid,
    email: `${uid}@example.test`,
    email_verified: true,
    firebase: { sign_in_provider: 'password', identities: {} },
  };
  return { Authorization: `Bearer ${b64({ alg: 'none', typ: 'JWT' })}.${b64(payload)}.` };
}

async function getDoc(uid: string, path: string): Promise<number> {
  const res = await fetch(`${BASE}/${path}`, { headers: authHeader(uid) });
  return res.status;
}

type Filter = [field: string, op: 'EQUAL' | 'ARRAY_CONTAINS' | 'IN', value: Plain];

async function query(uid: string, collectionId: string, filters: Filter[] = []): Promise<number> {
  const fieldFilters = filters.map(([field, op, value]) => ({
    fieldFilter: { field: { fieldPath: field }, op, value: toValue(value) },
  }));
  const structuredQuery: Record<string, unknown> = { from: [{ collectionId }] };
  if (fieldFilters.length === 1) structuredQuery.where = fieldFilters[0];
  if (fieldFilters.length > 1) structuredQuery.where = { compositeFilter: { op: 'AND', filters: fieldFilters } };
  const res = await fetch(`${BASE}:runQuery`, {
    method: 'POST',
    headers: { ...authHeader(uid), 'Content-Type': 'application/json' },
    body: JSON.stringify({ structuredQuery }),
  });
  return res.status;
}

/** Full-document writes (setDoc semantics) committed atomically. */
async function commit(uid: string, writes: Array<[path: string, data: Doc]>): Promise<number> {
  const res = await fetch(`${BASE}:commit`, {
    method: 'POST',
    headers: { ...authHeader(uid), 'Content-Type': 'application/json' },
    body: JSON.stringify({
      writes: writes.map(([path, data]) => ({ update: { name: `${ROOT}/${path}`, fields: toFields(data) } })),
    }),
  });
  return res.status;
}

const set = (uid: string, path: string, data: Doc) => commit(uid, [[path, data]]);

const OK = 200;
const DENIED = 403;

// ── Seed data ───────────────────────────────────────────────────────────────────────────────
const KL = 'jcikl';
const SG = 'jcicitysg';

const member = (role: string, loId: string, extra: Doc = {}): Doc => ({
  role,
  loId,
  general: { name: `${role} user` },
  contact: { email: 'x@example.test' },
  ...extra,
});
const affiliation = (status: string): Doc => ({ category: 'sister', country: 'Singapore', status });

const MEMBERS: Record<string, Doc> = {
  klMember: member('MEMBER', KL),
  klBoard: member('BOARD', KL),
  klAdmin: member('ADMIN', KL),
  klGuest: member('GUEST', KL),
  aff1: member('AFFILIATE', SG, { affiliation: affiliation('active') }),
  affPending: member('AFFILIATE', SG, { affiliation: affiliation('pending_kl') }),
  chAdmin: member('CHAPTER_ADMIN', SG, { affiliation: affiliation('active') }),
};

const survey = (status: string, extra: Doc = {}): Doc => ({
  title: `Survey ${status}`,
  status,
  targetAudience: 'All Members',
  questions: [],
  responsesCount: 0,
  createdBy: 'klBoard',
  ...extra,
});

// Real survey docs for non-'Specific Group' audiences usually have no specificMemberIds field at all.
const SURVEYS: Record<string, Doc> = {
  openActive: survey('Active', { openToExternals: true }),
  openDraft: survey('Draft', { openToExternals: true }),
  openClosed: survey('Closed', { openToExternals: true }),
  klOnly: survey('Active'),
  klOnlyFalse: survey('Active', { openToExternals: false, specificMemberIds: [] }),
  targeted: survey('Active', { targetAudience: 'Specific Group', specificMemberIds: ['aff1'] }),
  counter: survey('Active', { openToExternals: true }),
};

const club = (name: string, extra: Doc = {}): Doc => ({ name, category: 'Social', lead: 'Lead', image: '', ...extra });

const CLUBS: Record<string, Doc> = {
  openClub: club('Open club', { openToExternals: true }),
  closedClub: club('Closed club'),
  closedFalseClub: club('Closed club 2', { openToExternals: false }),
  ledClub: club('Led by klMember', { leadId: 'klMember' }),
};

const response = (uid: string, surveyId: string): Doc => ({
  surveyId,
  memberId: uid,
  responses: { q1: 'yes' },
  submittedAt: '2026-10-19T00:00:00.000Z',
});

describe.skipIf(!HOST)('firestore.rules — surveys / hobby clubs open to externals (emulator)', () => {
  beforeAll(async () => {
    await fetch(`http://${HOST}/emulator/v1/projects/${PROJECT}/databases/(default)/documents`, { method: 'DELETE' });
    const writes: Array<[string, Doc]> = [
      ...Object.entries(MEMBERS).map(([id, d]): [string, Doc] => [`members/${id}`, d]),
      ...Object.entries(SURVEYS).map(([id, d]): [string, Doc] => [`surveys/${id}`, d]),
      ...Object.entries(CLUBS).map(([id, d]): [string, Doc] => [`hobbyClubs/${id}`, d]),
    ];
    expect(await commit('owner', writes)).toBe(OK);
  });

  describe('surveys: external listing', () => {
    it('can list with the targeted constraint', async () => {
      expect(await query('aff1', 'surveys', [['specificMemberIds', 'ARRAY_CONTAINS', 'aff1']])).toBe(OK);
    });
    it('can list with the open + Active constraint', async () => {
      const open: Filter[] = [['openToExternals', 'EQUAL', true], ['status', 'EQUAL', 'Active']];
      expect(await query('aff1', 'surveys', open)).toBe(OK);
      expect(await query('chAdmin', 'surveys', open)).toBe(OK);
    });
    it('cannot list without a matching constraint', async () => {
      expect(await query('aff1', 'surveys')).toBe(DENIED);
      expect(await query('aff1', 'surveys', [['openToExternals', 'EQUAL', true]])).toBe(DENIED); // drafts too
      expect(await query('aff1', 'surveys', [['status', 'EQUAL', 'Active']])).toBe(DENIED);
      expect(await query('aff1', 'surveys', [['openToExternals', 'EQUAL', true], ['status', 'EQUAL', 'Draft']])).toBe(DENIED);
    });
    it('pending external cannot list open surveys', async () => {
      const open: Filter[] = [['openToExternals', 'EQUAL', true], ['status', 'EQUAL', 'Active']];
      expect(await query('affPending', 'surveys', open)).toBe(DENIED);
    });
  });

  describe('surveys: external get', () => {
    it('open + Active and targeted surveys are visible', async () => {
      expect(await getDoc('aff1', 'surveys/openActive')).toBe(OK);
      expect(await getDoc('aff1', 'surveys/targeted')).toBe(OK);
    });
    it('a draft or closed survey stays hidden even when open to externals', async () => {
      expect(await getDoc('aff1', 'surveys/openDraft')).toBe(DENIED);
      expect(await getDoc('aff1', 'surveys/openClosed')).toBe(DENIED);
    });
    it('KL-only surveys (field missing or false) are hidden', async () => {
      expect(await getDoc('aff1', 'surveys/klOnly')).toBe(DENIED);
      expect(await getDoc('aff1', 'surveys/klOnlyFalse')).toBe(DENIED);
    });
  });

  describe('surveyResponses: external create', () => {
    it('can answer an open Active survey', async () => {
      expect(await set('aff1', 'surveyResponses/openActive_aff1', response('aff1', 'openActive'))).toBe(OK);
    });
    it('cannot answer the same survey twice (dedup unchanged)', async () => {
      expect(await set('aff1', 'surveyResponses/openActive_aff1', response('aff1', 'openActive'))).toBe(DENIED);
    });
    it('can still answer a targeted survey', async () => {
      expect(await set('aff1', 'surveyResponses/targeted_aff1', response('aff1', 'targeted'))).toBe(OK);
    });
    it('cannot answer a draft, closed or KL-only survey', async () => {
      expect(await set('aff1', 'surveyResponses/openDraft_aff1', response('aff1', 'openDraft'))).toBe(DENIED);
      expect(await set('aff1', 'surveyResponses/openClosed_aff1', response('aff1', 'openClosed'))).toBe(DENIED);
      expect(await set('aff1', 'surveyResponses/klOnly_aff1', response('aff1', 'klOnly'))).toBe(DENIED);
    });
    it('ownership checks unchanged: cannot answer as someone else; pending cannot answer', async () => {
      expect(await set('aff1', 'surveyResponses/openActive_x', response('chAdmin', 'openActive'))).toBe(DENIED);
      expect(await set('affPending', 'surveyResponses/openActive_affPending', response('affPending', 'openActive'))).toBe(DENIED);
    });
  });

  describe('hobbyClubs: externals', () => {
    it('can read and list clubs open to externals', async () => {
      expect(await getDoc('aff1', 'hobbyClubs/openClub')).toBe(OK);
      expect(await query('aff1', 'hobbyClubs', [['openToExternals', 'EQUAL', true]])).toBe(OK);
    });
    it('a closed club is denied (field missing or false)', async () => {
      expect(await getDoc('aff1', 'hobbyClubs/closedClub')).toBe(DENIED);
      expect(await getDoc('aff1', 'hobbyClubs/closedFalseClub')).toBe(DENIED);
    });
    it('cannot list clubs without the constraint', async () => {
      expect(await query('aff1', 'hobbyClubs')).toBe(DENIED);
    });
    it('pending external cannot read even an open club', async () => {
      expect(await getDoc('affPending', 'hobbyClubs/openClub')).toBe(DENIED);
    });
  });

  describe('hobbyClubs: only board/admin set openToExternals', () => {
    it('a MEMBER cannot create a club open to externals; may create a closed one', async () => {
      expect(await set('klMember', 'hobbyClubs/m1', club('M1', { openToExternals: true }))).toBe(DENIED);
      expect(await set('klMember', 'hobbyClubs/m2', club('M2', { openToExternals: false }))).toBe(OK);
      expect(await set('klMember', 'hobbyClubs/m3', club('M3'))).toBe(OK);
    });
    it('a club lead cannot open their club to externals but can still edit descriptive fields', async () => {
      expect(await set('klMember', 'hobbyClubs/ledClub', { ...CLUBS.ledClub, openToExternals: true })).toBe(DENIED);
      expect(await set('klMember', 'hobbyClubs/ledClub', { ...CLUBS.ledClub, name: 'Renamed' })).toBe(OK);
    });
    it('BOARD and ADMIN can open a club', async () => {
      expect(await set('klBoard', 'hobbyClubs/b1', club('B1', { openToExternals: true }))).toBe(OK);
      expect(await set('klAdmin', 'hobbyClubs/closedClub', { ...CLUBS.closedClub, openToExternals: true })).toBe(OK);
      expect(await set('owner', 'hobbyClubs/closedClub', CLUBS.closedClub)).toBe(OK); // restore
    });
  });

  // SurveysService.submitResponse: tx.get(survey) + tx.get(response id, not yet existing)
  // then tx.set(response) + tx.update(survey, { responsesCount: +1, updatedAt }).
  describe('survey submit (response + responsesCount +1 in one write)', () => {
    const submit = (uid: string, surveyId: string, count: number, surveyExtra: Doc = {}) =>
      commit(uid, [
        [`surveyResponses/${surveyId}_${uid}`, response(uid, surveyId)],
        [`surveys/${surveyId}`, { ...SURVEYS[surveyId], responsesCount: count, updatedAt: '2026-10-20T00:00:00.000Z', ...surveyExtra }],
      ]);
    // Keep the seed in step with what the emulator holds after each successful submit.
    const bump = (surveyId: string) => {
      SURVEYS[surveyId] = { ...SURVEYS[surveyId], responsesCount: (SURVEYS[surveyId].responsesCount as number) + 1, updatedAt: '2026-10-20T00:00:00.000Z' };
    };

    it('the duplicate check can read a not-yet-existing response id (404, not denied)', async () => {
      expect(await getDoc('klMember', 'surveyResponses/counter_klMember')).toBe(404);
      expect(await getDoc('aff1', 'surveyResponses/counter_aff1')).toBe(404);
    });
    it('a KL MEMBER can submit', async () => {
      expect(await submit('klMember', 'counter', 1)).toBe(OK);
      bump('counter');
    });
    it('an active external can submit to an open Active survey', async () => {
      expect(await submit('aff1', 'counter', 2)).toBe(OK);
      bump('counter');
    });
    it('the duplicate check cannot read someone else\'s existing response', async () => {
      expect(await getDoc('chAdmin', 'surveyResponses/counter_aff1')).toBe(DENIED);
    });
    it('+2, a decrement or any other field is denied', async () => {
      expect(await submit('chAdmin', 'counter', 4)).toBe(DENIED);
      expect(await submit('chAdmin', 'counter', 2)).toBe(DENIED);
      expect(await submit('chAdmin', 'counter', 3, { title: 'Hijacked' })).toBe(DENIED);
      expect(await submit('chAdmin', 'counter', 3, { openToExternals: false })).toBe(DENIED);
    });
    it('a second response is denied', async () => {
      expect(await submit('klMember', 'counter', 3)).toBe(DENIED);
    });
    it('an external cannot bump a survey it cannot read', async () => {
      expect(await submit('aff1', 'klOnly', 1)).toBe(DENIED);
      expect(await set('aff1', 'surveys/klOnly', { ...SURVEYS.klOnly, responsesCount: 1 })).toBe(DENIED);
    });
    // Review M3: the +1 is only allowed together with the caller's own new response, on an Active survey.
    const countOnly = (uid: string, surveyId: string) =>
      set(uid, `surveys/${surveyId}`, {
        ...SURVEYS[surveyId],
        responsesCount: (SURVEYS[surveyId].responsesCount as number) + 1,
        updatedAt: '2026-10-20T00:00:00.000Z',
      });
    // Re-seed so a wrongly allowed write in one case cannot mask another case.
    const reseed = async (...ids: string[]) => {
      for (const id of ids) expect(await set('owner', `surveys/${id}`, SURVEYS[id])).toBe(OK);
    };
    it('M3: count +1 without creating a response is denied', async () => {
      await reseed('counter', 'klOnly');
      expect(await countOnly('chAdmin', 'counter')).toBe(DENIED);
      expect(await countOnly('klMember', 'klOnly')).toBe(DENIED);
    });
    it('M3: a GUEST cannot bump the count without a response', async () => {
      await reseed('openDraft', 'klOnly');
      expect(await countOnly('klGuest', 'openDraft')).toBe(DENIED);
      expect(await countOnly('klGuest', 'klOnly')).toBe(DENIED);
    });
    it('M3: submitting to a Draft survey is denied', async () => {
      await reseed('openDraft');
      expect(await submit('klMember', 'openDraft', 1)).toBe(DENIED);
    });
    it("M3: the response must be the caller's own id", async () => {
      await reseed('counter');
      expect(
        await commit('chAdmin', [
          ['surveyResponses/counter_someoneElse', response('chAdmin', 'counter')],
          ['surveys/counter', { ...SURVEYS.counter, responsesCount: (SURVEYS.counter.responsesCount as number) + 1 }],
        ]),
      ).toBe(DENIED);
    });
    it('a non-board user still cannot edit a survey otherwise', async () => {
      expect(await set('klMember', 'surveys/counter', { ...SURVEYS.counter, title: 'Edited' })).toBe(DENIED);
    });
  });

  describe('KL behaviour unchanged', () => {
    it('KL MEMBER reads every survey and lists unfiltered', async () => {
      expect(await getDoc('klMember', 'surveys/openDraft')).toBe(OK);
      expect(await getDoc('klMember', 'surveys/klOnly')).toBe(OK);
      expect(await query('klMember', 'surveys')).toBe(OK);
    });
    it('KL MEMBER answers a KL-only survey', async () => {
      expect(await set('klMember', 'surveyResponses/klOnly_klMember', response('klMember', 'klOnly'))).toBe(OK);
    });
    it('KL MEMBER reads every club and lists unfiltered', async () => {
      expect(await getDoc('klMember', 'hobbyClubs/closedClub')).toBe(OK);
      expect(await query('klMember', 'hobbyClubs')).toBe(OK);
    });
    it('surveys stay board/admin-managed', async () => {
      expect(await set('klMember', 'surveys/x1', survey('Draft', { openToExternals: true }))).toBe(DENIED);
      expect(await set('aff1', 'surveys/x2', survey('Draft'))).toBe(DENIED);
      expect(await set('klBoard', 'surveys/x3', survey('Draft', { openToExternals: true }))).toBe(OK);
    });
  });
});
