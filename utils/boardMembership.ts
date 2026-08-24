import { BoardMember, Member } from '../types';

/**
 * Positions that are NOT part of the Board of Directors.
 * Members holding these titles are tracked in boardMembers for record purposes
 * but must NOT receive board-level system permissions.
 *
 * Uses the same regex grouping as BoardOfDirectorsSection tabs:
 *   - /area/i  → Area Officer tab
 *   - /national/i → National Officer tab
 *   - 'JCI Officer' → EXCO tab but honorary; no board permissions
 *
 * Kept as a Set for callers that need exact-name lookup (e.g. saveBoardTerm position param).
 */
export const EXTERNAL_OFFICER_POSITIONS = new Set([
  'Area Officer',
  'National Officer',
  'JCI Officer',
]);

/**
 * Returns true if the position falls outside the Board of Directors permission scope.
 * Matches any position under the Area or National tabs (regex-based, same as tab grouping)
 * plus the legacy "JCI Officer" exact match.
 */
export function isExternalOfficerPosition(position: string | null | undefined): boolean {
  if (!position) return false;
  return /area/i.test(position) || /national/i.test(position) || position === 'JCI Officer';
}

/** Calendar year used for "current board" checks. */
export function getCurrentBoardCalendarYear(): number {
  return new Date().getFullYear();
}

/**
 * Like getCurrentBoardCalendarYear() but accounts for the January transition window:
 * a new board's roster may not yet be configured in early January, so callers that
 * look up board records should fall back to the previous year when month === 0 (January).
 *
 * Usage: prefer this over getCurrentBoardCalendarYear() when querying boardMembers records
 * and the caller should gracefully handle the year-start transition.
 */
export function getBoardCalendarYearWithGrace(): number {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();
  // January grace period: new board may not yet be configured for the current year
  if (month === 0) return year - 1;
  return year;
}

export function isActiveBoardRecordForYear(record: BoardMember, year: number): boolean {
  return record.isActive !== false && parseInt(record.term, 10) === year;
}

/**
 * Whether the member is an active board member this calendar year.
 *
 * Source of truth: `member.jciCareer?.isCurrentBoardMember` flag on the member doc.
 * This flag is kept in sync by `boardManagementService.syncMemberDocumentsForTerm`
 * whenever a board roster is saved. If you find members where this flag is stale,
 * run `BoardManagementService.selfHealBoardMembership()` to repair legacy data.
 *
 * The `currentBoardYear` field is retained on the member doc for display purposes
 * but is NOT used for permission checks — checking two fields in OR produces
 * unpredictable results when they drift.
 */
export function isMemberCurrentBoard(member: Member | null | undefined): boolean {
  if (!member) return false;
  if (!member.jciCareer?.isCurrentBoardMember) return false;
  const pos = member.jciCareer?.currentBoardPosition;
  if (isExternalOfficerPosition(pos)) return false;
  return true;
}

/** Whether any boardMembers record is active for the current calendar year. */
export function hasActiveBoardRecordForCurrentYear(records: BoardMember[]): boolean {
  const year = getCurrentBoardCalendarYear();
  return records.some((r) => isActiveBoardRecordForYear(r, year));
}
