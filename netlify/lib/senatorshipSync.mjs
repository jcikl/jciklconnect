// Developer-only back-fill of JCI Malaysia senator numbers onto our members. High-risk (member data):
// additive, reversible, board-validated numbers are never overwritten. Read-only on the source.
//   Source: the owner's JCI Malaysia snapshot (event_participants), each person record's `senatorship` string.
//   Match: our member -> a source person by IC (general.idNumber) -> email -> phone, conflict-skip, never by name.
//   Target: members/{id}.jciCareer.senatorship.senatorNumber — written ONLY when the member's
//     jciCareer.senatorship.boardValidated !== true; a board-validated number is preserved. Empty incoming = no-op.
//     Only senatorNumber is touched (certified / boardValidated / validatedAt / By are left as-is).
// The pure parts take plain data so they are testable with an in-memory fake (tests/unit/senatorshipSync.test.ts).
import { emailKey, phoneKey } from '../../utils/jciMalaysiaMatch.mjs';
import { icKey, eventPersons, memberIdentity, loadSourceEventDocs } from './eventRegcode.mjs';

export const RUNS_COLLECTION = 'jciMalaysiaSyncRuns';
export const BATCH_SIZE = 400;

const senatorshipOf = p => String(p?.senatorship ?? '').trim();
const add = (map, key, value) => {
  if (!key) return;
  const set = map.get(key);
  if (set) set.add(value); else map.set(key, new Set([value]));
};
/** The single distinct NON-empty value in a set, or null when there is none or several (ambiguous). */
const uniqNonEmpty = set => {
  if (!set) return null;
  const vals = [...set].filter(Boolean);
  const distinct = [...new Set(vals)];
  return distinct.length === 1 ? distinct[0] : null;
};

/**
 * Global index across EVERY source person: ic/email/phone -> set of senatorship strings (incl. '' so the key's
 * mere presence means "a person exists with this key, even without a senatorship").
 */
export function buildSenatorshipIndex(sourceDocs) {
  const byIc = new Map(), byEmail = new Map(), byPhone = new Map();
  for (const { data } of sourceDocs) {
    for (const p of eventPersons(data)) {
      const sen = senatorshipOf(p);
      add(byIc, icKey(p?.['NRIC/Passport']), sen);
      add(byEmail, emailKey(p?.email), sen);
      add(byPhone, phoneKey(p?.phone), sen);
    }
  }
  return { byIc, byEmail, byPhone };
}

/**
 * Resolve one member's senatorship from the global index. IC -> email -> phone; email and phone pointing to
 * different (non-empty, differing) senatorships = conflict. Returns { status, senatorship?, by? }:
 *   status ∈ 'matched' (has a value) | 'no-value' (matched a person, but blank senatorship) | 'conflict' | 'none'.
 */
export function resolveSenatorship(index, identity = {}) {
  const ic = icKey(identity.ic);
  const icSet = ic && index.byIc.get(ic);
  if (icSet) {
    const v = uniqNonEmpty(icSet);
    return v ? { status: 'matched', senatorship: v, by: 'ic' }
             : (icSet.size && [...icSet].some(Boolean) ? { status: 'conflict', by: 'ic' } : { status: 'no-value', by: 'ic' });
  }
  const e = emailKey(identity.email), p = phoneKey(identity.phone);
  const eSet = e && index.byEmail.get(e);
  const pSet = p && index.byPhone.get(p);
  if (!eSet && !pSet) return { status: 'none' };
  const eVal = uniqNonEmpty(eSet), pVal = uniqNonEmpty(pSet);
  // email and phone lead to different people (two differing senator numbers) -> skip.
  if (eVal && pVal && eVal !== pVal) return { status: 'conflict', by: 'emailphone' };
  const set = eSet || pSet;
  const by = eSet ? 'email' : 'phone';
  const v = eVal || pVal;
  if (v) return { status: 'matched', senatorship: v, by };
  // Matched a person via email/phone but the senatorship is blank (or ambiguous blanks).
  const anyNonEmpty = [...(set ?? [])].some(Boolean);
  return anyNonEmpty ? { status: 'conflict', by } : { status: 'no-value', by };
}

const existingSenatorship = m => (m?.jciCareer?.senatorship ?? {});

/**
 * Pure: the write plan. `writes` carry only { id, senatorNumber, before } (before = prior senatorNumber for rollback).
 * Merge rule: write only when boardValidated !== true and the incoming value differs; never clear; never touch a
 * board-validated number.
 */
export function buildSenatorshipPlan({ members, index }) {
  const counts = {
    members: members.length, matched: 0, wouldWrite: 0,
    skippedBoardValidated: 0, skippedNoValue: 0, conflicts: 0, alreadySame: 0, unmatched: 0,
  };
  const writes = [];
  // Per-member detail for the preview UI so a human can verify each proposed change before applying.
  // Carries the member name (developer-only UI); kept out of writes so the write path stays { id, senatorNumber, before }.
  const items = [];
  for (const m of members) {
    const res = resolveSenatorship(index, memberIdentity(m));
    if (res.status === 'none') { counts.unmatched++; continue; }
    counts.matched++;
    if (res.status === 'conflict') { counts.conflicts++; continue; }
    if (res.status === 'no-value') { counts.skippedNoValue++; continue; }
    const sen = existingSenatorship(m);
    if (sen.boardValidated === true) { counts.skippedBoardValidated++; continue; }
    const current = sen.senatorNumber ?? '';
    if (current === res.senatorship) { counts.alreadySame++; continue; }
    counts.wouldWrite++;
    writes.push({ id: m.id, senatorNumber: res.senatorship, before: current || null });
    items.push({ name: m.general?.name ?? m.id, before: current || null, incoming: res.senatorship, by: res.by });
  }
  return { counts, writes, items };
}

/** All our members with just the fields the matcher and merge rule need. */
export async function loadMembers(db) {
  const snap = await db.collection('members')
    .select('general.name', 'general.idNumber', 'contact.email', 'contact.phone', 'jciCareer.senatorship')
    .get();
  return snap.docs.map(d => ({ ...d.data(), id: d.id }));
}

/** Read our members + the whole source snapshot and build the plan. */
export async function computeSenatorshipPlan({ sourceDb, db }) {
  const [members, sourceDocs] = await Promise.all([
    loadMembers(db),
    loadSourceEventDocs(sourceDb),
  ]);
  const index = buildSenatorshipIndex(sourceDocs);
  return buildSenatorshipPlan({ members, index });
}

/** Write jciCareer.senatorship.senatorNumber (dot path — merges, leaves the rest of senatorship intact). */
export async function applySenatorshipPlan(db, plan, now, onProgress) {
  let done = 0;
  for (let i = 0; i < plan.writes.length; i += BATCH_SIZE) {
    const chunk = plan.writes.slice(i, i + BATCH_SIZE);
    const batch = db.batch();
    for (const w of chunk) batch.update(db.collection('members').doc(w.id), { 'jciCareer.senatorship.senatorNumber': w.senatorNumber, updatedAt: now });
    await batch.commit();
    done += chunk.length;
    onProgress?.(done, plan.writes.length);
  }
  return done;
}

/** preview action: counts + the per-member list of proposed writes (name · old → new) for developer verification. */
export async function previewSenatorship({ sourceDb, db }) {
  const plan = await computeSenatorshipPlan({ sourceDb, db });
  return { status: 200, body: { counts: plan.counts, items: plan.items } };
}

/**
 * apply action: recompute here (nothing the client sends is used), back up prior senator numbers to
 * jciMalaysiaSyncRuns/{runId}, write in batches, then one auditLog entry (counts only).
 */
export async function applySenatorship({ sourceDb, db, by, now }) {
  const plan = await computeSenatorshipPlan({ sourceDb, db });
  if (!plan.writes.length) return { status: 200, body: { runId: null, written: 0, counts: plan.counts } };
  const runRef = db.collection(RUNS_COLLECTION).doc();
  await runRef.set({
    kind: 'senatorship', by, at: now, counts: plan.counts, status: 'started', written: 0,
    before: plan.writes.map(w => ({ memberId: w.id, senatorNumber: w.before })),
  });
  const written = await applySenatorshipPlan(db, plan, now);
  await runRef.update({ status: 'done', written });
  await db.collection('auditLog').add({
    action: 'jci_malaysia_senatorship_apply',
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
