import { BoardMember, Member } from '../types';

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
 * Source of truth: `member.isCurrentBoardMember` flag on the member doc.
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
  return member.isCurrentBoardMember === true;
}

/** Whether any boardMembers record is active for the current calendar year. */
export function hasActiveBoardRecordForCurrentYear(records: BoardMember[]): boolean {
  const year = getCurrentBoardCalendarYear();
  return records.some((r) => isActiveBoardRecordForYear(r, year));
}
