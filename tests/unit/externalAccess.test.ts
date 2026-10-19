import { describe, it, expect } from 'vitest';
import { UserRole } from '../../types';
import type { ViewType } from '../../types/views';
import {
  EXTERNAL_ALLOWED_VIEWS,
  EXTERNAL_INACTIVE_VIEWS,
  getExternalAllowedViews,
  isExternalRole,
  isViewAllowedForRole,
} from '../../utils/externalAccess';
import {
  sidebarNavigationSections,
  isSidebarItemVisible,
  type SidebarNavigationContext,
} from '../../components/app/navigationConfig';

const ALL_VIEWS: ViewType[] = [
  'DASHBOARD', 'MEMBERS', 'EVENTS', 'PROJECTS', 'FINANCE', 'PAYMENT_REQUESTS', 'GAMIFICATION', 'INVENTORY',
  'DIRECTORY', 'AUTOMATION', 'KNOWLEDGE', 'COMMUNICATION', 'CLUBS', 'SURVEYS', 'BENEFITS', 'DATA_IMPORT_EXPORT',
  'ADVERTISEMENTS', 'AI_INSIGHTS', 'TEMPLATES', 'ACTIVITY_PLANS', 'REPORTS', 'DEVELOPER', 'TOYYIB', 'WHAPI_CONFIG',
  'API_CONFIG', 'MEMBERSHIP_CONFIG', 'ACCESS_CONFIG', 'SYSTEM_CONFIG', 'PUBLICATIONS', 'RADAR_IMPORTER',
  'FLAGSHIP_PROJECTS_MGT', 'SPONSORSHIPS', 'ZOOM_BOOKING', 'SOCIAL_MEDIA',
];
const KL_ROLES = [UserRole.GUEST, UserRole.MEMBER, UserRole.BOARD, UserRole.ADMIN, UserRole.SUPER_ADMIN, UserRole.INACTIVE];
const EXTERNAL_ACTIVE: ViewType[] = ['DASHBOARD', 'DIRECTORY', 'BENEFITS', 'EVENTS', 'SURVEYS', 'CLUBS', 'MEMBERS'];
const FORBIDDEN: ViewType[] = ALL_VIEWS.filter(v => !EXTERNAL_ACTIVE.includes(v));
const EXTERNAL_ROLES = [UserRole.AFFILIATE, UserRole.CHAPTER_ADMIN];

describe('external access whitelist', () => {
  it('identifies external roles only', () => {
    expect(isExternalRole(UserRole.AFFILIATE)).toBe(true);
    expect(isExternalRole(UserRole.CHAPTER_ADMIN)).toBe(true);
    for (const r of KL_ROLES) expect(isExternalRole(r)).toBe(false);
    expect(isExternalRole(undefined)).toBe(false);
  });

  it.each(EXTERNAL_ROLES)('%s: active may open exactly the whitelist', role => {
    const allowed = ALL_VIEWS.filter(v => isViewAllowedForRole(role, 'active', v));
    expect([...allowed].sort()).toEqual([...EXTERNAL_ACTIVE].sort());
    for (const v of FORBIDDEN) expect(isViewAllowedForRole(role, 'active', v)).toBe(false);
  });

  it.each(['pending_chapter', 'pending_kl', 'suspended', 'expired', undefined] as const)(
    'externals with status %s may only open their own profile',
    status => {
      for (const role of EXTERNAL_ROLES) {
        expect(ALL_VIEWS.filter(v => isViewAllowedForRole(role, status, v))).toEqual(['MEMBERS']);
      }
      expect(EXTERNAL_INACTIVE_VIEWS).toEqual(['MEMBERS']);
    },
  );

  it('KL roles are never restricted by the whitelist', () => {
    for (const role of KL_ROLES) {
      expect(getExternalAllowedViews(role, undefined)).toBeNull();
      for (const v of ALL_VIEWS) expect(isViewAllowedForRole(role, undefined, v)).toBe(true);
    }
  });

  it('whitelist has an entry per external role', () => {
    expect(Object.keys(EXTERNAL_ALLOWED_VIEWS).sort()).toEqual([...EXTERNAL_ROLES].sort());
  });
});

const base: SidebarNavigationContext = {
  isBoard: false, isAdmin: false, isDeveloper: false, isGuest: false, isPlainMember: false,
  canAccessWorkspaceModules: false, canViewEventsManagement: false, hasPermission: () => false,
};
const visibleItems = (ctx: SidebarNavigationContext) =>
  sidebarNavigationSections.flatMap(s => s.items.filter(i => isSidebarItemVisible(s, i, ctx)).map(i => `${s.id}:${i.view}`));

const BOARD_ITEMS = [
  'primary:DASHBOARD', 'primary:MEMBERS', 'primary:EVENTS', 'primary:COMMUNICATION', 'primary:DIRECTORY',
  'primary:KNOWLEDGE', 'primary:BENEFITS', 'primary:CLUBS',
  'workspace:PROJECTS', 'workspace:SURVEYS', 'workspace:ZOOM_BOOKING', 'workspace:SOCIAL_MEDIA', 'workspace:FINANCE',
  'workspace:INVENTORY', 'workspace:SPONSORSHIPS', 'workspace:GAMIFICATION',
  'portal:FLAGSHIP_PROJECTS_MGT', 'portal:ADVERTISEMENTS', 'portal:PUBLICATIONS',
  'system:TEMPLATES', 'system:REPORTS', 'system:DATA_IMPORT_EXPORT', 'system:RADAR_IMPORTER', 'system:AUTOMATION',
];
const SUPER_ITEMS = [
  ...BOARD_ITEMS.slice(0, -1), 'system:SYSTEM_CONFIG', 'system:AUTOMATION',
];

// Sidebar visibility for KL roles, captured from the code BEFORE the external-role change.
const KL_BASELINE: Record<string, string[]> = {
  GUEST: ['primary:DASHBOARD', 'primary:DIRECTORY', 'primary:BENEFITS', 'primary:CLUBS'],
  INACTIVE: ['primary:DASHBOARD', 'primary:DIRECTORY', 'primary:KNOWLEDGE', 'primary:CLUBS', 'workspace:SURVEYS', 'workspace:ZOOM_BOOKING', 'workspace:SOCIAL_MEDIA'],
  PLAIN: ['primary:DASHBOARD', 'primary:DIRECTORY', 'primary:KNOWLEDGE', 'primary:BENEFITS', 'primary:CLUBS', 'workspace:PROJECTS', 'workspace:SURVEYS', 'workspace:ZOOM_BOOKING', 'workspace:SOCIAL_MEDIA'],
  BOARD: BOARD_ITEMS,
  ADMIN: BOARD_ITEMS,
  SUPER: SUPER_ITEMS,
  DEV: [...SUPER_ITEMS, 'developer:AI_INSIGHTS', 'developer:DEVELOPER'],
};

const KL_CONTEXTS: Record<string, SidebarNavigationContext> = {
  GUEST: { ...base, memberRole: UserRole.GUEST, isGuest: true },
  INACTIVE: { ...base, memberRole: UserRole.INACTIVE },
  PLAIN: { ...base, memberRole: UserRole.MEMBER, isPlainMember: true, canViewEventsManagement: true },
  BOARD: { ...base, memberRole: UserRole.MEMBER, isBoard: true, canAccessWorkspaceModules: true, canViewEventsManagement: true, hasPermission: () => true },
  ADMIN: { ...base, memberRole: UserRole.ADMIN, isAdmin: true, canAccessWorkspaceModules: true, canViewEventsManagement: true, hasPermission: () => true },
  SUPER: { ...base, memberRole: UserRole.SUPER_ADMIN, isAdmin: true, canAccessWorkspaceModules: true, canViewEventsManagement: true, hasPermission: () => true },
  DEV: { ...base, memberRole: UserRole.SUPER_ADMIN, isDeveloper: true, isAdmin: true, canAccessWorkspaceModules: true, canViewEventsManagement: true, hasPermission: () => true },
};

describe('sidebar navigation', () => {
  it.each(Object.keys(KL_BASELINE))('KL context %s is unchanged from the pre-change baseline', key => {
    expect(visibleItems(KL_CONTEXTS[key])).toEqual(KL_BASELINE[key]);
  });

  it.each(EXTERNAL_ROLES)('%s sees only whitelisted entries, even with elevated flags', role => {
    const ctx: SidebarNavigationContext = {
      ...base, memberRole: role, isBoard: true, isAdmin: true, canAccessWorkspaceModules: true,
      canViewEventsManagement: true, hasPermission: () => true,
      externalAllowedViews: getExternalAllowedViews(role, 'active'),
    };
    const views = visibleItems(ctx).map(v => v.split(':')[1] as ViewType);
    for (const v of views) expect(EXTERNAL_ACTIVE).toContain(v);
    expect(views).toEqual(expect.arrayContaining(EXTERNAL_ACTIVE));
  });

  it('a pending external sees only My Profile', () => {
    const ctx: SidebarNavigationContext = {
      ...base, memberRole: UserRole.AFFILIATE, externalAllowedViews: getExternalAllowedViews(UserRole.AFFILIATE, 'pending_chapter'),
    };
    expect(visibleItems(ctx)).toEqual(['primary:MEMBERS']);
  });
});
