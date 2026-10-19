import { UserRole } from '../types/common';

/**
 * Who may open the Config view (SYSTEM_CONFIG) and which tabs they see.
 * SUPER_ADMIN: every tab. ADMIN: only 'sisters' (Global Relations) so KL admins can add chapter admins,
 * invite members and approve requests (owner decision 2). Editing the chapter list stays SUPER_ADMIN.
 */
export type ConfigTab = 'membership' | 'access' | 'toyyib' | 'whapi' | 'systemlogs' | 'maintenance' | 'postcodes' | 'sisters';

const ADMIN_CONFIG_TABS: readonly ConfigTab[] = ['sisters'];

export const canOpenSystemConfig = (role?: UserRole | string | null): boolean =>
  role === UserRole.SUPER_ADMIN || role === UserRole.ADMIN;

/** Tabs a role may open; null = all tabs (SUPER_ADMIN); [] = none. */
export const allowedConfigTabs = (role?: UserRole | string | null): readonly ConfigTab[] | null => {
  if (role === UserRole.SUPER_ADMIN) return null;
  if (role === UserRole.ADMIN) return ADMIN_CONFIG_TABS;
  return [];
};

/** Add / edit / delete a sister chapter or toggle it active (sisterChapters writes are SUPER_ADMIN in firestore.rules). */
export const canEditChapterList = (role?: UserRole | string | null): boolean => role === UserRole.SUPER_ADMIN;
