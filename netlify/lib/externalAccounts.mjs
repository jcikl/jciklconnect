// Pure rules for external (sister-chapter) accounts, used by netlify/functions/external-accounts.mjs.
// No Firebase imports here so everything can be unit-tested (externalAccounts.test.ts).
// Caller role / status / loId always come from the caller's Firestore member doc, never the request body.
import { KL_LO_ID, shouldHaveCard, buildMemberCard } from '../../utils/memberCard.mjs';
import { categoryForChapter } from '../../utils/affiliation.mjs';

export const MAX_PER_CALL = 20;
export const CHAPTER_MEMBER_CAP = 100;
export const AFFILIATION_STATUSES = ['pending_chapter', 'pending_kl', 'active', 'suspended', 'expired', 'rejected'];

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const DOB_RE = /^\d{4}-\d{2}-\d{2}$/;
const KL_ADMIN_ROLES = ['ADMIN', 'SUPER_ADMIN'];
const EXTERNAL_ROLES = ['AFFILIATE', 'CHAPTER_ADMIN'];

/** KL ADMIN / SUPER_ADMIN (a KL doc: loId 'jcikl' or missing). */
export function isKlAdmin(caller) {
  return !!caller && KL_ADMIN_ROLES.includes(caller.role) && (caller.loId ?? KL_LO_ID) === KL_LO_ID;
}

/** CHAPTER_ADMIN whose own affiliation is active and whose chapter is not KL (mirrors isActiveChapterAdmin()). */
export function isActiveChapterAdmin(caller) {
  return !!caller && caller.role === 'CHAPTER_ADMIN' && caller.affiliation?.status === 'active' &&
    typeof caller.loId === 'string' && caller.loId !== '' && caller.loId !== KL_LO_ID;
}

/** Same sanitising as services/membersService.ts createMember (memberEmails doc id). */
export function emailSlotId(email) {
  return String(email).toLowerCase().replace(/[^a-z0-9@.]/g, '_');
}

/** 'YYYY-MM-DD' → 'MMDD', else null. */
export function mmddFromDob(dob) {
  return typeof dob === 'string' && DOB_RE.test(dob) ? dob.slice(5, 7) + dob.slice(8, 10) : null;
}

/** sisterChapters.type (array) → members.affiliation.category (shared with the app's self-registration). */
export { categoryForChapter };

/**
 * Validate the invitee list: 1–MAX_PER_CALL rows of { name, email, dob? }.
 * Returns { ok: true, invitees } (emails lower-cased, duplicates within the call rejected) or { ok: false, error }.
 */
export function validateInvitees(list) {
  if (!Array.isArray(list) || list.length === 0 || list.length > MAX_PER_CALL) {
    return { ok: false, error: `members must contain 1–${MAX_PER_CALL} entries` };
  }
  const seen = new Set();
  const invitees = [];
  for (let i = 0; i < list.length; i++) {
    const row = list[i] ?? {};
    const name = typeof row.name === 'string' ? row.name.trim() : '';
    const email = typeof row.email === 'string' ? row.email.trim().toLowerCase() : '';
    const dob = typeof row.dob === 'string' && row.dob.trim() ? row.dob.trim() : undefined;
    if (!name || name.length > 120) return { ok: false, error: `row ${i + 1}: name is required` };
    if (!EMAIL_RE.test(email)) return { ok: false, error: `row ${i + 1}: invalid email` };
    if (dob !== undefined && !mmddFromDob(dob)) return { ok: false, error: `row ${i + 1}: dob must be YYYY-MM-DD` };
    if (seen.has(email)) return { ok: false, error: `row ${i + 1}: email repeated in this request` };
    seen.add(email);
    invitees.push(dob ? { name, email, dob } : { name, email });
  }
  return { ok: true, invitees };
}

/**
 * Which chapter / role a create call targets.
 *  createChapterAdmin: KL admin only, chapter named in the body, role CHAPTER_ADMIN.
 *  inviteMember: active CHAPTER_ADMIN → forced to the caller's own chapter, role AFFILIATE (body loId ignored);
 *                KL admin → must name a non-KL chapter, role AFFILIATE.
 * Returns { ok: true, loId, role } or { ok: false, status, error }.
 */
export function resolveCreateScope(action, caller, bodyLoId) {
  const named = typeof bodyLoId === 'string' ? bodyLoId.trim() : '';
  if (action === 'createChapterAdmin') {
    if (!isKlAdmin(caller)) return { ok: false, status: 403, error: 'Forbidden' };
    if (!named || named === KL_LO_ID) return { ok: false, status: 400, error: 'loId must name a sister chapter' };
    return { ok: true, loId: named, role: 'CHAPTER_ADMIN' };
  }
  if (action === 'inviteMember') {
    if (isActiveChapterAdmin(caller)) return { ok: true, loId: caller.loId, role: 'AFFILIATE' };
    if (isKlAdmin(caller)) {
      if (!named || named === KL_LO_ID) return { ok: false, status: 400, error: 'loId must name a sister chapter' };
      return { ok: true, loId: named, role: 'AFFILIATE' };
    }
    return { ok: false, status: 403, error: 'Forbidden' };
  }
  return { ok: false, status: 400, error: 'unknown action' };
}

/** The chapter must exist and be active. */
export function checkChapter(chapter) {
  if (!chapter) return { ok: false, status: 404, error: 'Chapter not found' };
  if (chapter.isActive !== true) return { ok: false, status: 409, error: 'Chapter is not active' };
  return { ok: true };
}

/**
 * Statuses that count toward the per-chapter cap (review M2). Anyone can self-register a pending_chapter doc,
 * so pending_* / rejected / expired docs must not use up the chapter's places.
 */
export const CAP_COUNTED_STATUSES = ['active', 'suspended'];

/** Whether a member doc counts toward its chapter's cap (external role with an active / suspended affiliation). */
export function countsTowardCap(m) {
  return !!m && EXTERNAL_ROLES.includes(m.role) && CAP_COUNTED_STATUSES.includes(m.affiliation?.status);
}

/** Per-chapter cap: counted members of the chapter (CAP_COUNTED_STATUSES) + new ones. */
export function checkCap(existingCount, adding) {
  return existingCount + adding <= CHAPTER_MEMBER_CAP
    ? { ok: true }
    : { ok: false, status: 409, error: `Chapter member limit (${CHAPTER_MEMBER_CAP}) reached` };
}

/**
 * Build the new external member doc (invited accounts are active immediately; decision 4).
 * `createdAt` is passed in (a Firestore Timestamp in the function) so this stays pure.
 */
export function buildExternalMemberDoc({ role, loId, chapter, invitee, callerUid, nowIso, createdAt }) {
  const general = { name: invitee.name };
  if (invitee.dob) general.dob = invitee.dob;
  const doc = {
    role,
    loId,
    affiliation: {
      category: categoryForChapter(chapter),
      country: String(chapter?.country ?? ''),
      status: 'active',
      activatedAt: nowIso,
      statusUpdatedAt: nowIso,
      statusUpdatedBy: callerUid,
    },
    general,
    contact: { email: invitee.email },
    privacy: { shareCardInternationally: false },
    createdAt,
    createdBy: callerUid,
    updatedAt: createdAt,
  };
  const mmdd = mmddFromDob(invitee.dob);
  if (mmdd) doc.birthdayMMDD = mmdd;
  return doc;
}

/** memberEmails slot for the new doc (same shape as membersService.createMember). */
export function buildEmailSlot(email, memberId, createdAt) {
  return { email, memberId, createdAt };
}

/** Card to write for a member, or null when the member should not have one. */
export function cardFor(member, nowIso) {
  return shouldHaveCard(member) ? buildMemberCard(member, nowIso) : null;
}

/**
 * Status transition check (decision 16).
 *  KL admin: any change between two different known statuses on an external doc (AFFILIATE / CHAPTER_ADMIN).
 *  Active CHAPTER_ADMIN, own-chapter AFFILIATE docs only (never themselves):
 *    pending_chapter → pending_kl (approve), pending_chapter | pending_kl → rejected (reject),
 *    active → suspended, suspended → active only if a chapter admin made that suspension
 *    (affiliation.suspendedByRole == 'CHAPTER_ADMIN', stamped by statusUpdates on every → suspended).
 *  pending_kl → active is KL-admin only.
 * Returns { ok: true } or { ok: false, status, error }.
 */
export function checkStatusTransition(caller, callerUid, targetId, target, nextStatus) {
  if (!AFFILIATION_STATUSES.includes(nextStatus)) return { ok: false, status: 400, error: 'unknown status' };
  if (!target) return { ok: false, status: 404, error: 'Member not found' };
  if (!EXTERNAL_ROLES.includes(target.role)) return { ok: false, status: 400, error: 'Not an external member' };
  const current = target.affiliation?.status;
  if (current === nextStatus) return { ok: false, status: 400, error: 'Status unchanged' };

  if (isKlAdmin(caller)) return { ok: true };

  if (!isActiveChapterAdmin(caller)) return { ok: false, status: 403, error: 'Forbidden' };
  if (targetId === callerUid || target.role !== 'AFFILIATE' || target.loId !== caller.loId) {
    return { ok: false, status: 403, error: 'Forbidden' };
  }
  const allowed =
    (current === 'pending_chapter' && nextStatus === 'pending_kl') ||
    ((current === 'pending_chapter' || current === 'pending_kl') && nextStatus === 'rejected') ||
    (current === 'active' && nextStatus === 'suspended') ||
    // M1: only a suspension the chapter itself made can be lifted by the chapter (never one by JCI KL).
    (current === 'suspended' && nextStatus === 'active' && target.affiliation?.suspendedByRole === 'CHAPTER_ADMIN');
  return allowed ? { ok: true } : { ok: false, status: 403, error: `Transition ${current} → ${nextStatus} not allowed` };
}

/** affiliation field updates (dot paths) for a status change; audit fields always name the caller. */
export function statusUpdates(caller, callerUid, target, nextStatus, nowIso) {
  const u = {
    'affiliation.status': nextStatus,
    'affiliation.statusUpdatedAt': nowIso,
    'affiliation.statusUpdatedBy': callerUid,
    updatedBy: callerUid,
  };
  const current = target.affiliation?.status;
  if (current === 'pending_chapter' && nextStatus === 'pending_kl') {
    u['affiliation.chapterApprovedAt'] = nowIso;
    u['affiliation.chapterApprovedBy'] = callerUid;
  }
  if (nextStatus === 'active' && isKlAdmin(caller) && (current === 'pending_kl' || current === 'pending_chapter')) {
    u['affiliation.klApprovedAt'] = nowIso;
    u['affiliation.klApprovedBy'] = callerUid;
  }
  if (nextStatus === 'active' && !target.affiliation?.activatedAt) u['affiliation.activatedAt'] = nowIso;
  if (nextStatus === 'suspended') u['affiliation.suspendedByRole'] = isKlAdmin(caller) ? 'KL' : 'CHAPTER_ADMIN';
  return u;
}

/** Member as it will look after statusUpdates (for card sync). */
export function withStatus(target, updates) {
  const affiliation = { ...(target.affiliation ?? {}) };
  for (const [k, v] of Object.entries(updates)) {
    if (k.startsWith('affiliation.')) affiliation[k.slice('affiliation.'.length)] = v;
  }
  return { ...target, affiliation };
}

/** resendInvite scope: KL admin → any external; active CHAPTER_ADMIN → own-chapter AFFILIATE (not self). */
export function canManageMember(caller, callerUid, targetId, target) {
  if (!target || !EXTERNAL_ROLES.includes(target.role)) return false;
  if (isKlAdmin(caller)) return true;
  return isActiveChapterAdmin(caller) && targetId !== callerUid &&
    target.role === 'AFFILIATE' && target.loId === caller.loId;
}

/**
 * deleteAccount scope (permanent delete). Never self, never a KL member (non-external role, or loId 'jcikl' /
 * missing). KL admin → any external (AFFILIATE / CHAPTER_ADMIN); active CHAPTER_ADMIN → own-chapter AFFILIATE only.
 * Returns { ok: true } or { ok: false, status, error }.
 */
export function canDeleteAccount(caller, callerUid, targetId, target) {
  if (!target) return { ok: false, status: 404, error: 'Member not found' };
  if (!targetId || targetId === callerUid) return { ok: false, status: 403, error: 'You cannot delete your own account' };
  if (!EXTERNAL_ROLES.includes(target.role) || (target.loId ?? KL_LO_ID) === KL_LO_ID) {
    return { ok: false, status: 400, error: 'Not an external member' };
  }
  if (isKlAdmin(caller)) return { ok: true };
  if (isActiveChapterAdmin(caller) && target.role === 'AFFILIATE' && target.loId === caller.loId) return { ok: true };
  return { ok: false, status: 403, error: 'Forbidden' };
}

/**
 * Retry after a delete whose Auth step failed: the member doc is already gone, so the target cannot be checked
 * again. Only a KL admin may finish it, and only when an earlier deleteAccount audit entry exists for that id
 * (proof it was an external account removed by this action, never a KL member).
 */
export function canRetryAccountDeletion(caller, callerUid, targetId, priorDeletionLogged) {
  return isKlAdmin(caller) && !!targetId && targetId !== callerUid && priorDeletionLogged === true;
}

/**
 * Docs one deleteAccount batch removes, as [collection, id] pairs: the member doc, its memberEmails slots
 * (only slots whose memberId is this member, found by query), the card, the pending email-change request and the
 * public business listing. Deleting a missing doc is a no-op, so the same plan is safe on a retry.
 */
export function planAccountDeletion(memberId, slotIds = []) {
  return [
    ['members', memberId],
    ...[...new Set(slotIds)].map(id => ['memberEmails', id]),
    ['memberCards', memberId],
    ['emailChangeRequests', memberId],
    ['publicBusinessListings', memberId],
  ];
}
