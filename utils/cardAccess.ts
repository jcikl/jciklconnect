import { UserRole } from '../types/common';
import type { Member } from '../types/member';

/**
 * Reciprocity rule: a user may view other members' cards only if they share their own card
 * (`privacy.shareCardInternationally === true`). Only KL admins (ADMIN, SUPER_ADMIN) are exempt;
 * BOARD, MEMBER and external users (AFFILIATE / CHAPTER_ADMIN, own chapter included) need the opt-in.
 */
export function canViewCards(
  member: Pick<Member, 'privacy'> | null | undefined,
  role: UserRole | string | null | undefined,
): boolean {
  if (role === UserRole.ADMIN || role === UserRole.SUPER_ADMIN) return true;
  return member?.privacy?.shareCardInternationally === true;
}
