// Developer-only "Back-fill registrations from JCI Malaysia": create eventRegistrations for KL members who
// appear in a linked JCI Malaysia event but have no local registration yet. Read-only on the source.
//   Source: the owner's JCI Malaysia snapshot (event_participants). Each project with a non-empty roadmapId is a
//     JCI Malaysia eventId; for each person in that event's arrays (approved/pending/committee/trainers) we match
//     to a KL member and, when there is no eventRegistrations/{projectId}_{memberId} yet, create one.
//   Target: eventRegistrations/{projectId}_{memberId}. status is ALWAYS 'registered'; the new jciMalaysiaRole
//     field carries the approved/pending/committee/trainer distinction. NO payment fields are ever set.
//   Match (owner decision): NRIC/Passport -> email -> phone, normalized, KL members only. A person whose email
//     maps to member A and phone to a DIFFERENT member B is a CONFLICT: skipped unless the developer resolves it.
// The pure parts take plain data so they are testable with an in-memory fake (tests/unit/eventRegBackfill.test.ts).
import { emailKey, phoneKey } from '../../utils/jciMalaysiaMatch.mjs';
import { icKey, PARTICIPANT_ARRAYS, loadSourceEventDocs, BATCH_SIZE } from './eventRegcode.mjs';

export const RUNS_COLLECTION = 'jciMalaysiaSyncRuns';
export const KL_LO_ID = 'jcikl';
// Source array -> the jciMalaysiaRole stored on the created registration (trainers -> singular 'trainer').
export const ROLE_BY_ARRAY = { approved: 'approved', pending: 'pending', committee: 'committee', trainers: 'trainer' };
// Cap on the per-row preview detail list (PII-safe rows) so the response stays small.
export const DETAIL_CAP = 200;

const str = v => String(v ?? '').trim();

/** Source `meal` -> our dietary enum. /veg/i -> vegetarian; 'halal' without 'non' -> halal; other non-empty -> normal; empty -> null. */
export function mapDietary(meal) {
  const s = str(meal);
  if (!s) return null;
  if (/veg/i.test(s)) return 'vegetarian';
  if (/halal/i.test(s) && !/non/i.test(s)) return 'halal';
  return 'normal';
}

/** memberName: 'name on tag' (if non-empty) else 'full name' else 'fullname' else the member's own general.name, else null. */
export function personName(person, member) {
  return str(person?.['name on tag']) || str(person?.['full name']) || str(person?.['fullname'])
    || str(member?.general?.name) || null;
}

/** A source person's identity for matching. IC from `NRIC/Passport`, email from `email`, phone from `phone` (fall back `contact`). */
export const personIdentity = p => ({
  ic: p?.['NRIC/Passport'] ?? '',
  email: p?.email ?? '',
  phone: str(p?.phone) || str(p?.contact),   // blank `phone` falls back to `contact`
});

/** KL member: loId === 'jcikl' or missing/empty. */
export const isKlMember = m => { const lo = m?.loId; return lo == null || lo === '' || lo === KL_LO_ID; };

const addId = (map, key, memberId) => {
  if (!key || !memberId) return;
  const set = map.get(key);
  if (set) set.add(memberId); else map.set(key, new Set([memberId]));
};
/** The one memberId a key points to, or null when absent or ambiguous (several distinct members share the key). */
const uniqId = set => (set && set.size === 1 ? [...set][0] : null);

/** KL-member lookup maps: ic/email/phone -> set of memberIds. Non-KL members are excluded. */
export function buildMemberIndex(members) {
  const byIc = new Map(), byEmail = new Map(), byPhone = new Map();
  for (const m of members) {
    if (!isKlMember(m)) continue;
    addId(byIc, icKey(m?.general?.idNumber ?? m?.idNumber), m.id);
    addId(byEmail, emailKey(m?.contact?.email ?? m?.email), m.id);
    addId(byPhone, phoneKey(m?.contact?.phone ?? m?.phone), m.id);
  }
  return { byIc, byEmail, byPhone };
}

/**
 * Match one source person to a KL member. NRIC/Passport -> email -> phone.
 * email and phone leading to DIFFERENT members = conflict. Returns { memberId, by, memberA?, memberB? }:
 *   by ∈ 'ic' | 'email' | 'phone' | 'conflict' | 'none'.
 */
export function matchMemberId(index, identity = {}) {
  if (!index) return { memberId: null, by: 'none' };
  const byIc = uniqId(index.byIc.get(icKey(identity.ic)));
  if (byIc) return { memberId: byIc, by: 'ic' };
  const e = uniqId(index.byEmail.get(emailKey(identity.email)));
  const p = uniqId(index.byPhone.get(phoneKey(identity.phone)));
  if (e && p && e !== p) return { memberId: null, by: 'conflict', memberA: e, memberB: p };
  const memberId = e || p || null;
  return { memberId, by: e ? 'email' : p ? 'phone' : 'none' };
}

const memberNameById = (membersById, id) => str(membersById.get(id)?.general?.name) || id;

/**
 * Pure: the back-fill plan.
 *  - counts: { linkedEvents, personsMatched, alreadyRegistered, conflicts, wouldCreate:{approved,pending,committee,trainers,total} }
 *  - creates: the full registration docs to write ({ id, data }). Server-side only — NEVER returned in the preview.
 *  - detail: PII-safe preview rows ({ memberName, event, role, hasRegcode }), capped at DETAIL_CAP.
 *  - conflicts: PII-safe ({ label (regcode/short id, never email/phone), memberA:{id,name}, memberB:{id,name} }).
 * `resolutions`: map `${projectId}:${label}` -> 'skip' | 'A' | 'B' (developer choices; not persisted).
 */
export function buildBackfillPlan({ projects, sourceByRoadmap, memberIndex, membersById = new Map(), existingRegIds = new Set(), resolutions = {}, nowIso }) {
  const counts = {
    linkedEvents: 0, personsMatched: 0, alreadyRegistered: 0, conflicts: 0,
    wouldCreate: { approved: 0, pending: 0, committee: 0, trainers: 0, total: 0 },
  };
  const creates = [];
  const detail = [];
  const conflicts = [];

  for (const project of projects) {
    const roadmapId = project?.roadmapId != null ? String(project.roadmapId).trim() : '';
    if (!roadmapId) continue;
    const doc = sourceByRoadmap.get(roadmapId);
    if (!doc) continue;
    counts.linkedEvents++;
    const eventLabel = str(project.title) || str(project.name) || roadmapId;
    const projLoId = project?.loId != null && project.loId !== '' ? project.loId : null;
    const seen = new Set();          // memberIds already handled for this event (first array wins)
    const seenConflict = new Set();  // conflict labels already reported for this event
    let confSeq = 0;

    for (const arr of PARTICIPANT_ARRAYS) {
      const list = Array.isArray(doc[arr]) ? doc[arr] : [];
      const role = ROLE_BY_ARRAY[arr];
      for (const person of list) {
        const m = matchMemberId(memberIndex, personIdentity(person));
        let memberId = m.memberId;

        if (m.by === 'conflict') {
          const label = str(person?.regcode) || `conflict-${roadmapId}-${++confSeq}`;
          const resolution = resolutions[`${project.id}:${label}`] || 'skip';
          if (resolution === 'A') memberId = m.memberA;
          else if (resolution === 'B') memberId = m.memberB;
          else {
            if (!seenConflict.has(label)) {
              seenConflict.add(label);
              counts.conflicts++;
              conflicts.push({
                // `key` is the exact resolutions map key the UI echoes back; projectId is not PII.
                key: `${project.id}:${label}`,
                label,
                memberA: { id: m.memberA, name: memberNameById(membersById, m.memberA) },
                memberB: { id: m.memberB, name: memberNameById(membersById, m.memberB) },
              });
            }
            continue;
          }
        }
        if (!memberId) continue;              // 'none'
        if (seen.has(memberId)) continue;     // first array wins (approved > pending > committee > trainers)
        seen.add(memberId);
        counts.personsMatched++;

        const regId = `${project.id}_${memberId}`;
        if (existingRegIds.has(regId)) { counts.alreadyRegistered++; continue; }

        const regcode = str(person?.regcode) || null;
        const data = {
          eventId: project.id,
          memberId,
          status: 'registered',
          jciMalaysiaRole: role,
          jciMalaysiaRegcode: regcode,
          memberName: personName(person, membersById.get(memberId)),
          dietary: mapDietary(person?.meal),
          tshirtSize: str(person?.tshirt_size) || null,
          emergencyContactName: str(person?.['emergency name']) || null,
          emergencyContactPhone: str(person?.['emergency phone']) || null,
          loId: projLoId,
          createdAt: nowIso,
          updatedAt: nowIso,
        };
        creates.push({ id: regId, data });
        counts.wouldCreate[arr]++;
        counts.wouldCreate.total++;
        if (detail.length < DETAIL_CAP) detail.push({ memberName: data.memberName, event: eventLabel, role, hasRegcode: !!regcode });
      }
    }
  }
  return { counts, creates, detail, conflicts };
}

// ---------------------------------------------------------------------------
// Loaders (Admin SDK). Kept thin so the pure parts above stay testable.
// ---------------------------------------------------------------------------

/** Every project that has a non-empty roadmapId ({ id, roadmapId, title, name, loId }). */
export async function loadProjectsWithRoadmap(db) {
  const snap = await db.collection('projects').select('roadmapId', 'title', 'name', 'loId').get();
  const out = [];
  for (const d of snap.docs) {
    const data = d.data();
    const roadmapId = data.roadmapId != null ? String(data.roadmapId).trim() : '';
    if (roadmapId) out.push({ id: d.id, roadmapId, title: data.title, name: data.name, loId: data.loId });
  }
  return out;
}

/** Identity for every member (KL filtering happens in buildMemberIndex). */
export async function loadMembers(db) {
  const snap = await db.collection('members')
    .select('general.name', 'general.idNumber', 'contact.email', 'contact.phone', 'loId').get();
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

/** The ids of every existing eventRegistration (ids only — no fields read). */
export async function loadExistingRegIds(db) {
  const snap = await db.collection('eventRegistrations').select().get();
  return new Set(snap.docs.map(d => d.id));
}

/** Read our projects/members/registrations + the linked source events and build the plan. */
export async function computeBackfillPlan({ sourceDb, db, resolutions = {}, nowIso }) {
  const [projects, members, existingRegIds] = await Promise.all([
    loadProjectsWithRoadmap(db),
    loadMembers(db),
    loadExistingRegIds(db),
  ]);
  const neededRoadmapIds = new Set(projects.map(p => p.roadmapId));
  const sourceDocs = await loadSourceEventDocs(sourceDb, neededRoadmapIds);
  const sourceByRoadmap = new Map(sourceDocs.map(({ eventId, data }) => [String(eventId), data]));
  const memberIndex = buildMemberIndex(members);
  const membersById = new Map(members.map(m => [m.id, m]));
  return buildBackfillPlan({ projects, sourceByRoadmap, memberIndex, membersById, existingRegIds, resolutions, nowIso });
}

/** Sanitise the client-sent resolutions: only `${projectId}:${label}` -> 'A' | 'B' are kept (default is skip). */
export function sanitizeResolutions(raw) {
  const out = {};
  if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
    for (const [k, v] of Object.entries(raw)) {
      if (typeof k === 'string' && k.length <= 256 && (v === 'A' || v === 'B')) out[k] = v;
    }
  }
  return out;
}

/** preview action (read-only): PII-safe counts + detail + conflicts. NO writes, NO creates returned. */
export async function previewBackfill({ sourceDb, db, resolutions = {} }) {
  const plan = await computeBackfillPlan({ sourceDb, db, resolutions, nowIso: new Date().toISOString() });
  return { status: 200, body: { counts: plan.counts, detail: plan.detail, conflicts: plan.conflicts } };
}

/**
 * apply (background only): recompute the plan here (nothing the client sends is used except the resolutions map),
 * back up the created doc ids to jciMalaysiaSyncRuns/{runId}, create the docs in batches of <= BATCH_SIZE, then
 * write one auditLog entry (counts only, no PII). Rollback = delete the ids listed in the run doc (manual).
 */
export async function applyBackfill({ sourceDb, db, by, nowTs, resolutions = {} }) {
  const nowIso = (nowTs?.toDate ? nowTs.toDate() : new Date()).toISOString();
  const plan = await computeBackfillPlan({ sourceDb, db, resolutions, nowIso });
  const runRef = db.collection(RUNS_COLLECTION).doc();
  const runId = runRef.id;
  await runRef.set({
    kind: 'eventRegBackfill', by, at: nowTs, counts: plan.counts,
    created: plan.creates.map(c => c.id), status: 'started', written: 0,
  });
  let written = 0;
  for (let i = 0; i < plan.creates.length; i += BATCH_SIZE) {
    const chunk = plan.creates.slice(i, i + BATCH_SIZE);
    const batch = db.batch();
    for (const c of chunk) batch.set(db.collection('eventRegistrations').doc(c.id), c.data);
    await batch.commit();
    written += chunk.length;
  }
  await runRef.update({ status: 'done', written });
  await db.collection('auditLog').add({
    action: 'jci_malaysia_reg_backfill_apply',
    performedBy: by,
    targetCollection: 'eventRegistrations',
    targetId: runId,
    before: null,
    after: null,
    metadata: { runId, counts: plan.counts, written },
    timestamp: nowTs,
    _source: 'netlify-function',
  });
  return { runId, written, counts: plan.counts };
}
