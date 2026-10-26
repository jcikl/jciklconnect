// JCI Malaysia sync core, shared by the CLI (scripts/syncJciMalaysia.mjs) and the Netlify function
// (netlify/functions/jci-malaysia-sync.mjs). Matching rules live in utils/jciMalaysiaMatch.mjs.
//   Source: the owner's SheetScraper Pro Firestore (member_directory, read-only, field mask below).
//   Target: our members (KL only: loId 'jcikl' or missing); three fields under jciCareer.
//   Manual picks: jciMalaysiaOverrides/{ourMemberId} = { sourceId, pickedBy, pickedAt } (Admin SDK only).
//   Apply backups: jciMalaysiaSyncRuns/{runId} = { by, at, counts, before: [{ memberId, before }] } (Admin SDK only).
// Inputs are Admin SDK Firestore instances, so the core is testable with a fake db. No emails or phones leave it.
import {
  buildSourceIndex, matchMember, planUpdate, membershipNo, toIsoDate, KL_SOURCE_CHAPTER,
} from '../../utils/jciMalaysiaMatch.mjs';
import { KL_LO_ID } from '../../utils/memberCard.mjs';

export const SOURCE_DATABASE_ID = 'ai-studio-cba40058-0493-450b-8680-948d1cb07c7d';
export const SOURCE_COLLECTION = 'member_directory';
export const SOURCE_FIELDS = ['id', 'membership', 'joindate', 'email', 'contact', 'chapter', 'fullname', 'gender'];
export const OVERRIDES_COLLECTION = 'jciMalaysiaOverrides';
export const RUNS_COLLECTION = 'jciMalaysiaSyncRuns';
export const SECRET_COLLECTION = 'systemSecrets';
export const SECRET_DOC_ID = 'jciMalaysiaSource';
export const BATCH_SIZE = 400;
// Only what the matcher and the plan read, so the members read stays small.
const MEMBER_FIELDS = [
  'loId', 'name', 'general.name', 'email', 'phone', 'contact.email', 'contact.phone',
  'jciCareer.jciMalaysiaMembershipNo', 'jciCareer.jciMalaysiaJoinDate', 'jciCareer.jciMalaysiaUserId',
];
const BY_COUNT = { manual: 'byManual', userId: 'byUserId', membershipNo: 'byMembershipNo', email: 'byEmail', phone: 'byPhone' };
const FIELD = { membershipNo: 'jciMalaysiaMembershipNo', joinDate: 'jciMalaysiaJoinDate', userId: 'jciMalaysiaUserId' };

/** Only a member doc with isDeveloper === true (set by an admin; members cannot set it, see firestore.rules). */
export const isSyncDeveloper = member => !!member && member.isDeveloper === true && member.role !== 'INACTIVE';

const isKlMember = m => (m.loId ?? KL_LO_ID) === KL_LO_ID;
const memberName = m => m.general?.name ?? m.name ?? m.id;
const threeFields = m => ({
  membershipNo: m.jciCareer?.jciMalaysiaMembershipNo ?? null,
  joinDate: m.jciCareer?.jciMalaysiaJoinDate ?? null,
  userId: m.jciCareer?.jciMalaysiaUserId ?? null,
});

/** A source record as the UI may see it: no email, no phone. */
export const rowSummary = row => row ? {
  sourceId: row.id != null ? String(row.id) : '',
  fullname: row.fullname ?? '',
  chapter: row.chapter ?? '',
  membershipNo: membershipNo(row.membership),
  joinDate: toIsoDate(row.joindate),
} : null;

export async function loadSourceRows(sourceDb) {
  const snap = await sourceDb.collection(SOURCE_COLLECTION).select(...SOURCE_FIELDS).get();
  return snap.docs.map(d => d.data());
}

export async function loadKlMembers(db) {
  const snap = await db.collection('members').select(...MEMBER_FIELDS).get();
  return snap.docs.map(d => ({ ...d.data(), id: d.id })).filter(isKlMember);
}

/** Manual picks from Firestore: our member id -> source record id. */
export async function loadOverrides(db) {
  const snap = await db.collection(OVERRIDES_COLLECTION).get();
  const out = {};
  for (const d of snap.docs) { const s = d.data()?.sourceId; if (s != null && s !== '') out[d.id] = String(s); }
  return out;
}

/** Pure: the plan for these rows, members and manual picks. */
export function buildPlan({ rows, members, overrides = {} }) {
  const index = buildSourceIndex(rows);
  const counts = { members: members.length, byManual: 0, byUserId: 0, byMembershipNo: 0, byEmail: 0, byPhone: 0, conflict: 0, otherChapter: 0, none: 0, toWrite: 0, unchanged: 0 };
  const writes = [], conflicts = [], otherChapter = [], notFound = [];
  for (const m of members) {
    const res = matchMember(m, index, overrides);
    if (res.status === 'conflict') {
      counts.conflict++;
      conflicts.push({ memberId: m.id, name: memberName(m), candidates: { A: rowSummary(res.candidates?.email), B: rowSummary(res.candidates?.phone) } });
      continue;
    }
    if (res.status === 'none') { counts.none++; notFound.push({ memberId: m.id, name: memberName(m) }); continue; }
    if (res.status === 'otherChapter') {
      counts.otherChapter++;
      otherChapter.push({ memberId: m.id, name: memberName(m), chapter: res.row.chapter ?? '', by: res.by });
      continue;
    }
    counts[BY_COUNT[res.by]]++;
    const updates = planUpdate(m, res.row);
    if (!Object.keys(updates).length) { counts.unchanged++; continue; }
    counts.toWrite++;
    const before = threeFields(m);
    const after = Object.fromEntries(Object.entries(FIELD).map(([k, f]) => [k, updates[`jciCareer.${f}`] ?? before[k]]));
    writes.push({ memberId: m.id, name: memberName(m), by: res.by, chapter: res.row.chapter ?? '', updates, before, after });
  }
  return { sourceRows: rows.length, counts, writes, conflicts, otherChapter, notFound };
}

/**
 * Read source, members and (unless given) the Firestore overrides in parallel, then plan.
 * @param {{ sourceDb: any, db: any, overrides?: Record<string, string> }} args
 */
export async function computePlan({ sourceDb, db, overrides }) {
  const [rows, members, picks] = await Promise.all([
    loadSourceRows(sourceDb), loadKlMembers(db), overrides ? Promise.resolve(overrides) : loadOverrides(db),
  ]);
  return buildPlan({ rows, members, overrides: picks });
}

/** Old values of every planned write, in the shape both backups use (CLI file, jciMalaysiaSyncRuns doc). */
export const backupOf = plan => plan.writes.map(w => ({
  memberId: w.memberId,
  before: {
    jciMalaysiaMembershipNo: w.before.membershipNo,
    jciMalaysiaJoinDate: w.before.joinDate,
    jciMalaysiaUserId: w.before.userId,
  },
}));

/** Write the planned updates in batches of at most BATCH_SIZE. Returns the number of members written. */
export async function applyPlan(db, plan, onProgress) {
  let done = 0;
  for (let i = 0; i < plan.writes.length; i += BATCH_SIZE) {
    const chunk = plan.writes.slice(i, i + BATCH_SIZE);
    const batch = db.batch();
    for (const w of chunk) batch.update(db.collection('members').doc(w.memberId), w.updates);
    await batch.commit();
    done += chunk.length;
    onProgress?.(done, plan.writes.length);
  }
  return done;
}

/** What the UI gets for a preview: no internal update maps. */
export const publicPlan = plan => ({
  sourceRows: plan.sourceRows,
  counts: plan.counts,
  writes: plan.writes.map(({ updates, ...w }) => w),
  conflicts: plan.conflicts,
  otherChapter: plan.otherChapter,
  notFound: plan.notFound,
});

const fail = (status, error) => ({ status, body: { error } });

/**
 * Validate and store a manual pick. sourceId must be one of the member's two conflict candidates, or any
 * JCI Kuala Lumpur source row. Returns { status, body }.
 */
export async function savePick({ sourceDb, db, memberId, sourceId, by, now }) {
  if (typeof memberId !== 'string' || !memberId || memberId.length > 128 || memberId.includes('/')) return fail(400, 'memberId is required');
  if ((typeof sourceId !== 'string' && typeof sourceId !== 'number') || String(sourceId).trim() === '' || String(sourceId).length > 128) return fail(400, 'sourceId is required');
  const sid = String(sourceId).trim();
  const snap = await db.collection('members').doc(memberId).get();
  const member = snap.exists ? { ...snap.data(), id: memberId } : null;
  if (!member || !isKlMember(member)) return fail(404, 'Member not found');

  const index = buildSourceIndex(await loadSourceRows(sourceDb));
  const res = matchMember(member, index, {});
  const candidateIds = res.status === 'conflict'
    ? [res.candidates?.email?.id, res.candidates?.phone?.id].filter(v => v != null).map(String)
    : [];
  const row = index.byId.get(sid);
  const ok = candidateIds.includes(sid) || (row && row.chapter === KL_SOURCE_CHAPTER);
  if (!ok) return fail(400, 'sourceId is not a candidate of this member nor a JCI Kuala Lumpur record');

  await db.collection(OVERRIDES_COLLECTION).doc(memberId).set({ sourceId: sid, pickedBy: by, pickedAt: now });
  await db.collection('auditLog').add({
    action: 'jci_malaysia_sync_pick',
    performedBy: by,
    targetCollection: OVERRIDES_COLLECTION,
    targetId: memberId,
    before: null,
    after: null,
    metadata: { sourceId: sid },
    timestamp: now,
    _source: 'netlify-function',
  });
  return { status: 200, body: { memberId, sourceId: sid } };
}

/**
 * Apply: the plan is ALWAYS recomputed here from the databases; nothing the client sends is used.
 * Order: backup doc -> member batches -> run doc marked done -> one auditLog entry (counts only).
 */
export async function applySync({ sourceDb, db, by, now }) {
  const plan = await computePlan({ sourceDb, db });
  if (!plan.writes.length) return { status: 200, body: { runId: null, written: 0, counts: plan.counts } };
  const runRef = db.collection(RUNS_COLLECTION).doc();
  await runRef.set({ by, at: now, counts: plan.counts, before: backupOf(plan), status: 'started', written: 0 });
  const written = await applyPlan(db, plan);
  await runRef.update({ status: 'done', written });
  await db.collection('auditLog').add({
    action: 'jci_malaysia_sync_apply',
    performedBy: by,
    targetCollection: 'members',
    targetId: runRef.id,
    before: null,
    after: null,
    metadata: { runId: runRef.id, counts: plan.counts, written },
    timestamp: now,
    _source: 'netlify-function',
  });
  return { status: 200, body: { runId: runRef.id, written, counts: plan.counts } };
}

/** Dispatch one function call. `body` is only read for 'pick' (memberId, sourceId). */
export async function runAction({ action, body = {}, sourceDb, db, callerUid, now }) {
  if (action === 'preview') return { status: 200, body: publicPlan(await computePlan({ sourceDb, db })) };
  if (action === 'pick') return savePick({ sourceDb, db, memberId: body.memberId, sourceId: body.sourceId, by: callerUid, now });
  if (action === 'apply') return applySync({ sourceDb, db, by: callerUid, now });
  return fail(400, "action must be 'preview', 'pick' or 'apply'");
}
