import { describe, it, expect } from 'vitest';
import { UserRole } from '../../types';
import { canOpenSystemConfig, allowedConfigTabs, canEditChapterList } from '../../utils/configAccess';

describe('Config gating (owner decision 2)', () => {
  it('SUPER_ADMIN opens Config with every tab and may edit the chapter list', () => {
    expect(canOpenSystemConfig(UserRole.SUPER_ADMIN)).toBe(true);
    expect(allowedConfigTabs(UserRole.SUPER_ADMIN)).toBeNull();
    expect(canEditChapterList(UserRole.SUPER_ADMIN)).toBe(true);
  });

  it('ADMIN opens Config with Global Relations only and may not edit the chapter list', () => {
    expect(canOpenSystemConfig(UserRole.ADMIN)).toBe(true);
    expect(allowedConfigTabs(UserRole.ADMIN)).toEqual(['sisters']);
    expect(canEditChapterList(UserRole.ADMIN)).toBe(false);
  });

  it.each([UserRole.BOARD, UserRole.MEMBER, UserRole.GUEST, UserRole.INACTIVE, UserRole.AFFILIATE, UserRole.CHAPTER_ADMIN, undefined])(
    '%s cannot open Config',
    role => {
      expect(canOpenSystemConfig(role)).toBe(false);
      expect(allowedConfigTabs(role)).toEqual([]);
      expect(canEditChapterList(role)).toBe(false);
    },
  );
});
