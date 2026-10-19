import { describe, it, expect } from 'vitest';
import { canViewCards } from '../../utils/cardAccess';
import { UserRole } from '../../types';

const opted = { privacy: { shareCardInternationally: true } } as any;
const notOpted = { privacy: { shareCardInternationally: false } } as any;
const noPrivacy = {} as any;

describe('canViewCards (reciprocity)', () => {
  it('KL admins are exempt, opted in or not', () => {
    for (const role of [UserRole.ADMIN, UserRole.SUPER_ADMIN]) {
      expect(canViewCards(notOpted, role)).toBe(true);
      expect(canViewCards(null, role)).toBe(true);
    }
  });

  it.each([UserRole.MEMBER, UserRole.BOARD, UserRole.AFFILIATE, UserRole.CHAPTER_ADMIN])(
    '%s needs the opt-in',
    role => {
      expect(canViewCards(opted, role)).toBe(true);
      expect(canViewCards(notOpted, role)).toBe(false);
      expect(canViewCards(noPrivacy, role)).toBe(false);
      expect(canViewCards(null, role)).toBe(false);
    },
  );
});
