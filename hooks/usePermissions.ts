// Permission Management Hook
import { useMemo } from 'react';
import { useAuth } from './useAuth';
import { UserRole } from '../types';
import { isDevMode } from '../utils/devMode';
import { isMemberCurrentBoard } from '../utils/boardMembership';

interface Permission {
  canViewMembers: boolean;
  canEditMembers: boolean;
  canViewFinance: boolean;
  canEditFinance: boolean;
  canManageProjects: boolean;
  canManageEvents: boolean;
  canManageInventory: boolean;
  canManageAutomation: boolean;
  canViewReports: boolean;
  canManageSettings: boolean;
  canApproveClaims: boolean;
}

const ROLE_PERMISSIONS: Record<UserRole, Permission> = {
  [UserRole.GUEST]: {
    canViewMembers: false,
    canEditMembers: false,
    canViewFinance: false,
    canEditFinance: false,
    canManageProjects: false,
    canManageEvents: false,
    canManageInventory: false,
    canManageAutomation: false,
    canViewReports: false,
    canManageSettings: false,
    canApproveClaims: false,
  },
  // PROBATION is deprecated as a permission tier - maps to MEMBER
  [UserRole.PROBATION]: {
    canViewMembers: true,
    canEditMembers: false,
    canViewFinance: false,
    canEditFinance: false,
    canManageProjects: false,
    canManageEvents: true,
    canManageInventory: false,
    canManageAutomation: false,
    canViewReports: false,
    canManageSettings: false,
    canApproveClaims: false,
  },
  [UserRole.MEMBER]: {
    canViewMembers: true,
    canEditMembers: false,
    canViewFinance: false,
    canEditFinance: false,
    canManageProjects: false,
    canManageEvents: true,
    canManageInventory: false,
    canManageAutomation: false,
    canViewReports: false,
    canManageSettings: false,
    canApproveClaims: false,
  },
  // BOARD is deprecated as a static role - Board access is granted dynamically via currentBoardYear
  [UserRole.BOARD]: {
    canViewMembers: true,
    canEditMembers: false,
    canViewFinance: false,
    canEditFinance: false,
    canManageProjects: false,
    canManageEvents: true,
    canManageInventory: false,
    canManageAutomation: false,
    canViewReports: false,
    canManageSettings: false,
    canApproveClaims: false,
  },
  [UserRole.ADMIN]: {
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
  },
  [UserRole.SUPER_ADMIN]: {
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
  },
  [UserRole.INACTIVE]: {
    canViewMembers: false,
    canEditMembers: false,
    canViewFinance: false,
    canEditFinance: false,
    canManageProjects: false,
    canManageEvents: false,
    canManageInventory: false,
    canManageAutomation: false,
    canViewReports: false,
    canManageSettings: false,
    canApproveClaims: false,
  },
};

// All permissions enabled for developer mode
const DEV_MODE_PERMISSIONS: Permission = {
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

    if (isCurrentBoardMember && member.role !== UserRole.ADMIN && member.role !== UserRole.SUPER_ADMIN) {
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
  const isBoardUser = isCurrentBoardMember || isLegacyBoardRole;
  const isPlainMember =
    (effectiveRole === UserRole.MEMBER || effectiveRole === UserRole.PROBATION) && !isBoardUser;

  /** Workspace modules (Members, Communication, Gamification etc.) — board, admin only; not plain members/guests */
  const canAccessWorkspaceModules =
    effectiveRole !== UserRole.GUEST &&
    (isBoardUser ||
      effectiveRole === UserRole.ADMIN ||
      effectiveRole === UserRole.SUPER_ADMIN);

  /** Events management + Payment Requests — open to all active members */
  const canAccessEventsAndPayments =
    effectiveRole !== UserRole.GUEST &&
    effectiveRole !== UserRole.INACTIVE;

  return {
    permissions,
    hasPermission,
    hasAnyPermission,
    hasAllPermissions,
    isGuest: effectiveRole === UserRole.GUEST,
    isProbationMember: effectiveRole === UserRole.PROBATION, // Kept for backward compat with MembersView probation flow
    isMember: effectiveRole === UserRole.MEMBER || effectiveRole === UserRole.PROBATION,
    isPlainMember,
    isCurrentBoardMember: isBoardUser,
    isBoard: isBoardUser,
    canAccessWorkspaceModules,
    canAccessEventsAndPayments,
    isAdmin: effectiveRole === UserRole.ADMIN || effectiveRole === UserRole.SUPER_ADMIN,
    isOrganizationSecretary: false, // Deprecated - use dynamic assignment
    isOrganizationFinance: false, // Deprecated - use dynamic assignment
    isActivityFinance: false, // Deprecated - use dynamic assignment
    isDeveloper: devMode,
    effectiveRole, // Return the effective role being used
  };
};

