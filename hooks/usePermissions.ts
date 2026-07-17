// Permission Management Hook
import { useMemo } from 'react';
import { useAuth } from './useAuth';
import { UserRole } from '../types';
import { isDevMode } from '../utils/devMode';
import { isMemberCurrentBoard } from '../utils/boardMembership';
import { Permission, ROLE_PERMISSIONS, ALL_PERMISSIONS_GRANTED } from '../utils/rolePermissions';

export type { Permission };

const DEV_MODE_PERMISSIONS: Permission = ALL_PERMISSIONS_GRANTED;

export const usePermissions = () => {
  const { member, isDevMode: isDevModeFromAuth, simulatedRole } = useAuth();
  const devMode = isDevMode() || isDevModeFromAuth;

  const permissions = useMemo(() => {
    // If role is being simulated, use that role's permissions
    if (simulatedRole) {
      return ROLE_PERMISSIONS[simulatedRole] || ROLE_PERMISSIONS[UserRole.MEMBER];
    }

    // Developer mode without simulation: grant all permissions
    if (devMode) {
      return DEV_MODE_PERMISSIONS;
    }

    if (!member) {
      return ROLE_PERMISSIONS[UserRole.GUEST];
    }

    let basePermissions = ROLE_PERMISSIONS[member.role] || ROLE_PERMISSIONS[UserRole.MEMBER];

    // SECONDARY ACCESS: current calendar-year board (synced from boardMembers → member doc)
    const isCurrentBoardMember = isMemberCurrentBoard(member);
    // Legacy BOARD role (static assignment, pre-dynamic board system) gets the same elevation
    const effectiveRoleInner = simulatedRole ?? (member.role as UserRole) ?? UserRole.GUEST;
    const isLegacyBoardRoleInner = effectiveRoleInner === UserRole.BOARD;

    if ((isCurrentBoardMember || isLegacyBoardRoleInner) && member.role !== UserRole.ADMIN && member.role !== UserRole.SUPER_ADMIN && member.role !== UserRole.INACTIVE) {
      basePermissions = {
        ...basePermissions,
        canViewMembers: true,
        canEditMembers: true,
        canViewFinance: true,
        canEditFinance: true,
        canManageProjects: true,
        canManageEvents: true,
        canManageInventory: true,
        canManageAutomation: true,
        canViewReports: true,
        canManageSettings: true,
        canApproveClaims: true,
      };
    }

    return basePermissions;
  }, [member, devMode, simulatedRole]);

  const hasPermission = (permission: keyof Permission): boolean => {
    // If role is being simulated, use that role's permissions
    if (simulatedRole) {
      return permissions[permission];
    }
    // Developer mode without simulation: always return true
    if (devMode) {
      return true;
    }
    return permissions[permission];
  };

  const hasAnyPermission = (...perms: (keyof Permission)[]): boolean => {
    // If role is being simulated, use that role's permissions
    if (simulatedRole) {
      return perms.some(perm => permissions[perm]);
    }
    // Developer mode without simulation: always return true
    if (devMode) {
      return true;
    }
    return perms.some(perm => permissions[perm]);
  };

  const hasAllPermissions = (...perms: (keyof Permission)[]): boolean => {
    // If role is being simulated, use that role's permissions
    if (simulatedRole) {
      return perms.every(perm => permissions[perm]);
    }
    // Developer mode without simulation: always return true
    if (devMode) {
      return true;
    }
    return perms.every(perm => permissions[perm]);
  };

  // Determine effective role (simulated role in dev mode, or actual member role)
  const effectiveRole = simulatedRole ? simulatedRole : (member?.role || UserRole.GUEST);

  const isCurrentBoardMember = isMemberCurrentBoard(member);
  const isLegacyBoardRole = effectiveRole === UserRole.BOARD;
  // T-1: INACTIVE is a hard block — never grant board status regardless of flags
  const isBoardUser = (isCurrentBoardMember || isLegacyBoardRole) && effectiveRole !== UserRole.INACTIVE;
  const isPlainMember =
    effectiveRole === UserRole.MEMBER && !isBoardUser;

  /** Workspace modules (Members, Communication, Gamification etc.) — board, admin only; not plain members/guests */
  // B-7: Honorary and Senator members also get workspace access (they hold special JCI status)
  // T-2: during simulateRole the real membershipType must not bleed into workspace access
  const isHonoraryOrSenator =
    !simulatedRole &&
    (member?.membershipType === 'Honorary' || member?.membershipType === 'Senator');
  const canAccessWorkspaceModules =
    effectiveRole !== UserRole.GUEST &&
    effectiveRole !== UserRole.INACTIVE &&
    (isBoardUser ||
      effectiveRole === UserRole.ADMIN ||
      effectiveRole === UserRole.SUPER_ADMIN ||
      isHonoraryOrSenator);

  /** Events management + Payment Requests — open to all active members */
  const canAccessEventsAndPayments =
    effectiveRole !== UserRole.GUEST &&
    effectiveRole !== UserRole.INACTIVE;

  // B-3: Derive board-position flags from currentBoardPosition field
  const boardPosition = (member?.currentBoardPosition ?? '').toLowerCase();
  const isOrganizationSecretary = isBoardUser && boardPosition.includes('secretary');
  const isPresident = isBoardUser && boardPosition.includes('president') && !boardPosition.includes('vice');
  const isOrganizationFinance =
    isBoardUser &&
    (boardPosition.includes('treasurer') ||
      (boardPosition.includes('finance') && !boardPosition.includes('activity')));
  const isActivityFinance =
    isBoardUser && boardPosition.includes('activity') && boardPosition.includes('finance');

  return {
    permissions,
    hasPermission,
    hasAnyPermission,
    hasAllPermissions,
    isGuest: effectiveRole === UserRole.GUEST,
    // B-2: Derive from actual membershipType field instead of hardcoded false
    isProbationMember: member?.membershipType === 'Probation' && effectiveRole !== UserRole.INACTIVE,
    isMember: effectiveRole === UserRole.MEMBER,
    isPlainMember,
    isCurrentBoardMember: isBoardUser,
    isBoard: isBoardUser,
    canAccessWorkspaceModules,
    canAccessEventsAndPayments,
    isAdmin: effectiveRole === UserRole.ADMIN || effectiveRole === UserRole.SUPER_ADMIN,
    isOrganizationSecretary,
    isPresident,
    isOrganizationFinance,
    isActivityFinance,
    isDeveloper: devMode || !!simulatedRole,
    effectiveRole,
  };
};

