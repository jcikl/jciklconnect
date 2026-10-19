import { DEFAULT_LO_ID } from '../config/constants';

/** True for KL-chapter members. Legacy docs without a loId count as KL. */
export const isKlMember = (m: { loId?: string | null } | null | undefined): boolean =>
  !!m && (!m.loId || m.loId === DEFAULT_LO_ID);

/**
 * MembersService.deleteMember client guard: true when the caller may not soft-delete a member of another LO.
 * Exception: a KL ADMIN / SUPER_ADMIN removing a legacy sister-chapter doc (rules' update branch lets
 * isAdmin() edit any LO). Non-admins (e.g. BOARD) stay blocked so they get the client message, not a rules denial.
 */
export const isCrossLoDeleteBlocked = (
  callerRole: string | null | undefined,
  myLoId: string | null | undefined,
  targetLoId: string | null | undefined,
): boolean => {
  if (targetLoId == null || myLoId == null || targetLoId === myLoId) return false;
  const klAdminOnSisterDoc = (callerRole === 'ADMIN' || callerRole === 'SUPER_ADMIN') &&
    myLoId === DEFAULT_LO_ID && targetLoId !== DEFAULT_LO_ID;
  return !klAdminOnSisterDoc;
};

/** Client-side safety net: drop external-chapter members from KL-only aggregates. */
export const filterKlMembers = <T extends { loId?: string | null }>(list: T[]): T[] =>
  list.filter(isKlMember);
