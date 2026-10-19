import { UserRole } from '../types/common';
import type { AffiliationStatus } from '../types/member';
import type { ViewType } from '../types/views';

/**
 * SINGLE SOURCE of what external users (members of OTHER JCI chapters) can open.
 * Navigation (sidebar, mobile menu, quick search) and view rendering (viewRegistry) all read this file.
 * KL roles are never restricted by it (`getExternalAllowedViews` returns null for them).
 */

export type ExternalRole = UserRole.AFFILIATE | UserRole.CHAPTER_ADMIN;

export const isExternalRole = (role?: UserRole | string | null): role is ExternalRole =>
  role === UserRole.AFFILIATE || role === UserRole.CHAPTER_ADMIN;

/** Views both external roles can open once their affiliation is `active`. 'MEMBERS' = own profile only. */
const EXTERNAL_COMMON_VIEWS: readonly ViewType[] = [
  'DASHBOARD',
  'DIRECTORY',
  'BENEFITS',
  'EVENTS',
  'SURVEYS',
  'CLUBS',
  'MEMBERS',
];

/** Active externals, per role. CHAPTER_ADMIN also gets MY_CHAPTER (approvals / members / invite of own chapter). */
export const EXTERNAL_ALLOWED_VIEWS: Record<ExternalRole, readonly ViewType[]> = {
  [UserRole.AFFILIATE]: EXTERNAL_COMMON_VIEWS,
  [UserRole.CHAPTER_ADMIN]: [...EXTERNAL_COMMON_VIEWS, 'MY_CHAPTER'],
};

/** Externals whose affiliation is not `active` (pending / suspended / expired): own profile only. */
export const EXTERNAL_INACTIVE_VIEWS: readonly ViewType[] = ['MEMBERS'];

/** Dashboard widgets externals may mount. Everything else (journey, commitments, board, finance, points…) must not mount. */
export const EXTERNAL_DASHBOARD_WIDGETS = ['birthdays', 'partners', 'events', 'profile'] as const;

/**
 * Views an external may open, or null when the role is not external (= no whitelist applies).
 * A missing affiliation status is treated as not active (fail closed).
 */
export const getExternalAllowedViews = (
  role: UserRole | string | null | undefined,
  status?: AffiliationStatus | null,
): readonly ViewType[] | null => {
  if (!isExternalRole(role)) return null;
  return status === 'active' ? EXTERNAL_ALLOWED_VIEWS[role] : EXTERNAL_INACTIVE_VIEWS;
};

/** True when `view` may be opened. Non-external roles are unrestricted here (their own rules still apply). */
export const isViewAllowedForRole = (
  role: UserRole | string | null | undefined,
  status: AffiliationStatus | null | undefined,
  view: ViewType,
): boolean => {
  const allowed = getExternalAllowedViews(role, status);
  return allowed === null || allowed.includes(view);
};

export const getExternalStatusMessage = (status?: AffiliationStatus | null): { title: string; description: string } => {
  switch (status) {
    case 'suspended':
      return { title: 'Your membership is suspended', description: 'Please contact your chapter administrator or JCI KL for more information.' };
    case 'expired':
      return { title: 'Your membership has expired', description: 'Please contact your chapter administrator to renew your affiliation.' };
    case 'pending_kl':
      return { title: 'Your membership is pending approval', description: 'Your chapter has approved your request. JCI KL is reviewing it and you will get access once it is approved.' };
    default:
      return { title: 'Your membership is pending approval', description: 'Your chapter administrator needs to approve your request before you can access JCI KL Connect.' };
  }
};
