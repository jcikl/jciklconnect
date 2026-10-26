// "My event QR" core: copy each member's JCI Malaysia check-in code (regcode) onto their own
// eventRegistration, so the app can render a QR from it. Read-only on the source.
//   Source: the owner's JCI Malaysia snapshot (Firestore project gen-lang-client-0772255734, named DB
//     ai-studio-cba40058-0493-450b-8680-948d1cb07c7d), collection event_participants/{yyyy00}/{hostingLO}/{eventId}.
//     Each event doc has arrays approved/pending/committee/trainers; each person may have regcode (6-char),
//     NRIC/Passport, email, phone, full name. We regenerate the QR from regcode — their qrcode image is ignored.
//   Target: our eventRegistrations/{eventId}_{memberId}; eventId is a projects doc whose roadmapId = the
//     JCI Malaysia eventId. New field jciMalaysiaRegcode (server-written only; firestore.rules locks it client-side).
//   Match (owner decision): NRIC/Passport -> email -> phone, normalized; email and phone to different regcodes = skip.
// The pure parts take plain data so they are testable with an in-memory fake (tests/unit/eventRegcode.test.ts).
import { emailKey, phoneKey } from '../../utils/jciMalaysiaMatch.mjs';

export const SOURCE_DATABASE_ID = 'ai-studio-cba40058-0493-450b-8680-948d1cb07c7d';
export const SOURCE_COLLECTION = 'event_participants';
export const PARTICIPANT_ARRAYS = ['approved', 'pending', 'committee', 'trainers'];
// Only the person arrays are needed from each source event doc (field-mask read for speed).
export const SOURCE_FIELDS = PARTICIPANT_ARRAYS;
export const RUNS_COLLECTION = 'jciMalaysiaSyncRuns';
export const BATCH_SIZE = 400;

/** IC / passport: strip non-alphanumeric, uppercase. '' when nothing usable. */
export const icKey = v => String(v ?? '').replace(/[^a-z0-9]/gi, '').toUpperCase();

const regcodeOf = p => String(p?.regcode ?? '').trim();
const addKey = (map, key, regcode) => {
  if (!key || !regcode) return;
  const set = map.get(key);
  if (set) set.add(regcode); else map.set(key, new Set([regcode]));
};
/** The one regcode a key points to, or null when absent or ambiguous (several different regcodes). */
const uniq = set => (set && set.size === 1 ? [...set][0] : null);

/** All person records of one source event doc, across the four arrays. */
export function eventPersons(doc) {
  const out = [];
  for (const arr of PARTICIPANT_ARRAYS) if (Array.isArray(doc?.[arr])) out.push(...doc[arr]);
  return out;
}

/** One event's lookup maps: ic/email/phone -> set of regcodes. */
export function buildEventLookup(doc) {
  const byIc = new Map(), byEmail = new Map(), byPhone = new Map();
  for (const p of eventPersons(doc)) {
    const rc = regcodeOf(p);
    if (!rc) continue;
    addKey(byIc, icKey(p?.['NRIC/Passport']), rc);
    addKey(byEmail, emailKey(p?.email), rc);
    addKey(byPhone, phoneKey(p?.phone), rc);
  }
  return { byIc, byEmail, byPhone };
}

/** JCI Malaysia eventId -> event lookup. `docs`: [{ eventId, data }]. */
export function buildRegcodeIndex(docs) {
  const index = new Map();
  for (const { eventId, data } of docs) {
    if (eventId == null || eventId === '') continue;
    index.set(String(eventId), buildEventLookup(data));
  }
  return index;
}

/** Our member's identity for matching (general.idNumber is the IC; contact.email / contact.phone). */
export const memberIdentity = m => ({
  ic: m?.general?.idNumber ?? m?.idNumber ?? '',
  email: m?.contact?.email ?? m?.email ?? '',
  phone: m?.contact?.phone ?? m?.phone ?? '',
});

/**
 * Match one member against one event's lookup. NRIC/Passport -> email -> phone.
 * email and phone leading to different regcodes = conflict. Returns { regcode, by }:
 *   by ∈ 'ic' | 'email' | 'phone' | 'conflict' | 'none'.
 */
export function matchRegcode(lookup, identity = {}) {
  if (!lookup) return { regcode: null, by: 'none' };
  const byIc = uniq(lookup.byIc.get(icKey(identity.ic)));
  if (byIc) return { regcode: byIc, by: 'ic' };
  const e = uniq(lookup.byEmail.get(emailKey(identity.email)));
  const p = uniq(lookup.byPhone.get(phoneKey(identity.phone)));
  if (e && p && e !== p) return { regcode: null, by: 'conflict' };
  const regcode = e || p || null;
  return { regcode, by: e ? 'email' : p ? 'phone' : 'none' };
}

/**
 * Resolve one registration's regcode from already-loaded data.
 * Returns { regcode, by?, reason? }; reason ∈ 'no-roadmapId' | 'event-not-in-snapshot' | 'conflict' | 'member-not-in-list'.
 */
export function resolveRegcode({ project, member, index }) {
  const roadmapId = project?.roadmapId != null ? String(project.roadmapId).trim() : '';
  if (!roadmapId) return { regcode: null, reason: 'no-roadmapId' };
  const lookup = index.get(roadmapId);
  if (!lookup) return { regcode: null, reason: 'event-not-in-snapshot' };
  const res = matchRegcode(lookup, memberIdentity(member));
  if (res.by === 'conflict') return { regcode: null, reason: 'conflict' };
  if (!res.regcode) return { regcode: null, reason: 'member-not-in-list' };
  return { regcode: res.regcode, by: res.by };
}

// ---------------------------------------------------------------------------
// Loaders (Admin SDK). Kept thin so the pure parts above stay testable.
// ---------------------------------------------------------------------------

/** Every source event doc (field-masked), optionally filtered to a set of needed eventIds. */
export async function loadSourceEventDocs(sourceDb, neededEventIds = null) {
  const monthDocs = await sourceDb.collection(SOURCE_COLLECTION).listDocuments();
  const docs = [];
  for (const mon of monthDocs) {
    const subs = await mon.listCollections();
    for (const sub of subs) {
      const snap = await sub.select(...SOURCE_FIELDS).get();
      for (const d of snap.docs) {
        if (!neededEventIds || neededEventIds.has(d.id)) docs.push({ eventId: d.id, data: d.data() });
      }
    }
  }
  return docs;
}

/** Find ONE source event doc by its JCI Malaysia eventId (for the single-registration auto-attach). */
export async function findSourceEventDoc(sourceDb, roadmapId) {
  const id = String(roadmapId ?? '').trim();
  if (!id) return null;
  const monthDocs = await sourceDb.collection(SOURCE_COLLECTION).listDocuments();
  for (const mon of monthDocs) {
    const subs = await mon.listCollections();
    const snaps = await Promise.all(subs.map(sub => sub.doc(id).get()));
    const hit = snaps.find(s => s.exists);
    if (hit) return hit.data();
  }
  return null;
}

/** Our eventRegistrations ({ id, eventId, memberId, jciMalaysiaRegcode }). */
export async function loadRegistrations(db) {
  const snap = await db.collection('eventRegistrations').select('eventId', 'memberId', 'jciMalaysiaRegcode').get();
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

/** projects/{id}.roadmapId for the given ids. */
export async function loadProjectsRoadmap(db, ids) {
  const out = new Map();
  const refs = [...ids].map(id => db.collection('projects').doc(id));
  for (let i = 0; i < refs.length; i += BATCH_SIZE) {
    const snaps = await db.getAll(...refs.slice(i, i + BATCH_SIZE), { fieldMask: ['roadmapId'] });
    for (const s of snaps) if (s.exists) out.set(s.id, s.data());
  }
  return out;
}

/** members/{id} identity for the given ids. */
export async function loadMembersIdentity(db, ids) {
  const out = new Map();
  const refs = [...ids].map(id => db.collection('members').doc(id));
  for (let i = 0; i < refs.length; i += BATCH_SIZE) {
    const snaps = await db.getAll(...refs.slice(i, i + BATCH_SIZE), { fieldMask: ['general.idNumber', 'contact.email', 'contact.phone'] });
    for (const s of snaps) if (s.exists) out.set(s.id, s.data());
  }
  return out;
}

/** Pure: the back-fill plan. `writes` carries no PII — only { id, regcode } per registration to update. */
export function buildPlan({ registrations, projectsById, membersById, index }) {
  const counts = {
    registrations: registrations.length,
    linkable: 0, wouldGetRegcode: 0, conflicts: 0, alreadySet: 0, toWrite: 0,
    noRoadmapId: 0, eventNotInSnapshot: 0, memberNotInList: 0, memberMissing: 0,
  };
  const writes = [];
  for (const reg of registrations) {
    const project = projectsById.get(reg.eventId);
    if (!project || project.roadmapId == null || String(project.roadmapId).trim() === '') { counts.noRoadmapId++; continue; }
    counts.linkable++;
    const member = membersById.get(reg.memberId);
    if (!member) { counts.memberMissing++; continue; }
    const res = resolveRegcode({ project, member, index });
    if (res.reason === 'event-not-in-snapshot') { counts.eventNotInSnapshot++; continue; }
    if (res.reason === 'conflict') { counts.conflicts++; continue; }
    if (!res.regcode) { counts.memberNotInList++; continue; }
    counts.wouldGetRegcode++;
    if ((reg.jciMalaysiaRegcode ?? null) === res.regcode) { counts.alreadySet++; continue; }
    counts.toWrite++;
    writes.push({ id: reg.id, regcode: res.regcode });
  }
  return { counts, writes };
}

/** Read our registrations + the source (only the events we reference) and build the plan. */
export async function computePlan({ sourceDb, db }) {
  const registrations = await loadRegistrations(db);
  const eventIds = new Set(registrations.map(r => r.eventId).filter(Boolean));
  const projectsById = await loadProjectsRoadmap(db, eventIds);
  const roadmapIds = new Set(
    [...projectsById.values()].map(p => (p.roadmapId != null ? String(p.roadmapId).trim() : '')).filter(Boolean),
  );
  const memberIds = new Set(registrations.map(r => r.memberId).filter(Boolean));
  const [membersById, sourceDocs] = await Promise.all([
    loadMembersIdentity(db, memberIds),
    loadSourceEventDocs(sourceDb, roadmapIds),
  ]);
  const index = buildRegcodeIndex(sourceDocs);
  return buildPlan({ registrations, projectsById, membersById, index });
}

/** Write jciMalaysiaRegcode onto the planned registrations in batches of <= BATCH_SIZE. */
export async function applyPlan(db, plan, now, onProgress) {
  let done = 0;
  for (let i = 0; i < plan.writes.length; i += BATCH_SIZE) {
    const chunk = plan.writes.slice(i, i + BATCH_SIZE);
    const batch = db.batch();
    for (const w of chunk) batch.update(db.collection('eventRegistrations').doc(w.id), { jciMalaysiaRegcode: w.regcode, updatedAt: now });
    await batch.commit();
    done += chunk.length;
    onProgress?.(done, plan.writes.length);
  }
  return done;
}

const fail = (status, error) => ({ status, body: { error } });

/** preview action: counts only, no PII. */
export async function previewRegcodes({ sourceDb, db }) {
  const plan = await computePlan({ sourceDb, db });
  return { status: 200, body: { counts: plan.counts } };
}

/**
 * apply action: recompute here (nothing the client sends is used), back up to jciMalaysiaSyncRuns/{runId},
 * write in batches, then one auditLog entry (counts only).
 */
export async function applyRegcodes({ sourceDb, db, by, now }) {
  const plan = await computePlan({ sourceDb, db });
  if (!plan.writes.length) return { status: 200, body: { runId: null, written: 0, counts: plan.counts } };
  const runRef = db.collection(RUNS_COLLECTION).doc();
  await runRef.set({ kind: 'eventRegcode', by, at: now, counts: plan.counts, before: plan.writes.map(w => w.id), status: 'started', written: 0 });
  const written = await applyPlan(db, plan, now);
  await runRef.update({ status: 'done', written });
  await db.collection('auditLog').add({
    action: 'jci_malaysia_regcode_apply',
    performedBy: by,
    targetCollection: 'eventRegistrations',
    targetId: runRef.id,
    before: null,
    after: null,
    metadata: { runId: runRef.id, counts: plan.counts, written },
    timestamp: now,
    _source: 'netlify-function',
  });
  return { status: 200, body: { runId: runRef.id, written, counts: plan.counts } };
}

/**
 * attachMyRegcode action (non-developer, authenticated): operate ONLY on the caller's own registration
 * {eventId}_{callerUid}. Reads one project + one source event doc + one member, writes at most one field.
 * Never touches another member's registration. Fails quietly (regcode stays null) when nothing matches.
 */
export async function attachMyRegcode({ sourceDb, db, callerUid, eventId, now }) {
  if (typeof eventId !== 'string' || !eventId || eventId.length > 256 || eventId.includes('/')) return fail(400, 'eventId is required');
  const regId = `${eventId}_${callerUid}`;
  const regRef = db.collection('eventRegistrations').doc(regId);
  const regSnap = await regRef.get();
  if (!regSnap.exists) return { status: 200, body: { attached: false, reason: 'no-registration' } };
  // Defence in depth: the doc id already binds to the caller, but refuse if memberId is not the caller.
  if ((regSnap.data()?.memberId ?? callerUid) !== callerUid) return fail(403, 'Forbidden');

  const [projectSnap, memberSnap] = await Promise.all([
    db.collection('projects').doc(eventId).get(),
    db.collection('members').doc(callerUid).get(),
  ]);
  const project = projectSnap.exists ? projectSnap.data() : null;
  const roadmapId = project?.roadmapId != null ? String(project.roadmapId).trim() : '';
  if (!roadmapId) return { status: 200, body: { attached: false, reason: 'no-roadmapId' } };

  const eventDoc = await findSourceEventDoc(sourceDb, roadmapId);
  if (!eventDoc) return { status: 200, body: { attached: false, reason: 'event-not-in-snapshot' } };

  const res = matchRegcode(buildEventLookup(eventDoc), memberIdentity(memberSnap.exists ? memberSnap.data() : null));
  if (!res.regcode) return { status: 200, body: { attached: false, reason: res.by === 'conflict' ? 'conflict' : 'member-not-in-list' } };
  if ((regSnap.data()?.jciMalaysiaRegcode ?? null) === res.regcode) return { status: 200, body: { attached: true, changed: false } };
  await regRef.update({ jciMalaysiaRegcode: res.regcode, updatedAt: now });
  return { status: 200, body: { attached: true, changed: true } };
}
