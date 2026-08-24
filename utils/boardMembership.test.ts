import { describe, expect, it } from 'vitest';
import { UserRole, type Member } from '../types';
import { isMemberCurrentBoard } from './boardMembership';

describe('isMemberCurrentBoard', () => {
  it('accepts legacy top-level current board fields', () => {
    const member = {
      id: 'member-1',
      role: UserRole.MEMBER,
      isCurrentBoardMember: true,
      currentBoardPosition: 'Treasurer',
    } as unknown as Member;

    expect(isMemberCurrentBoard(member)).toBe(true);
  });

  it('rejects external officer positions from legacy fields', () => {
    const member = {
      id: 'member-2',
      role: UserRole.MEMBER,
      isCurrentBoardMember: true,
      currentBoardPosition: 'National Officer',
    } as unknown as Member;

    expect(isMemberCurrentBoard(member)).toBe(false);
  });
});
