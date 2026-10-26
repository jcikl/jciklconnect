// Pure gating for netlify/functions/self-email 'finalize'. An email change may only be finalized for a change the
// member asked for: emailChangeRequests/{uid} = { newEmail, requestedAt (ISO) } written by the 'request' action.

/** How long a requested change stays valid (the verification link must be clicked within this time). */
export const EMAIL_CHANGE_REQUEST_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * @param {{ newEmail?: unknown, requestedAt?: unknown } | null | undefined} request emailChangeRequests/{uid} data
 * @param {string | null | undefined} verifiedAuthEmail the signed-in token's verified email
 * @param {number} [nowMs] injectable for tests
 * @returns {boolean}
 */
export function canFinalizeEmailChange(request, verifiedAuthEmail, nowMs = Date.now()) {
  if (!request || typeof request.newEmail !== 'string' || typeof verifiedAuthEmail !== 'string') return false;
  if (request.newEmail.trim().toLowerCase() !== verifiedAuthEmail.trim().toLowerCase()) return false;
  const at = typeof request.requestedAt === 'string' ? Date.parse(request.requestedAt) : NaN;
  if (Number.isNaN(at)) return false;
  const age = nowMs - at;
  return age >= 0 && age <= EMAIL_CHANGE_REQUEST_MAX_AGE_MS;
}
