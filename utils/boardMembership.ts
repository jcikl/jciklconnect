import { BoardMember, Member } from '../types';

/** Calendar year used for "current board" checks. */
export function getCurrentBoardCalendarYear(): number {
  return new Date().getFullYear();
}

export function isActiveBoardRecordForYear(record: BoardMember, year: number): boolean {
  return record.isActive !== false && parseInt(record.term, 10) === year;
}

/** Whether member doc reflects active board service for the current calendar year. */
export function isMemberCurrentBoard(member: Member | null | undefined): boolean {
  if (!member) return false;
  if (member.isCurrentBoardMember === true) return true;
  return member.currentBoardYear === getCurrentBoardCalendarYear();
}

/** Whether any boardMembers record is active for the current calendar year. */
export function hasActiveBoardRecordForCurrentYear(records: BoardMember[]): boolean {
  const year = getCurrentBoardCalendarYear();
  return records.some((r) => isActiveBoardRecordForYear(r, year));
}
