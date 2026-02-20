// Permission Management Hook
import { useMemo } from 'react';
import { useAuth } from './useAuth';
import { UserRole } from '../types';
import { isDevMode } from '../utils/devMode';

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
  },
  [UserRole.PROBATION_MEMBER]: {
    canViewMembers: true,
    canEditMembers: false,
    canViewFinance: false,
    canEditFinance: false,
    canManageProjects: false,
    canManageEvents: true, // Can register for events
    canManageInventory: false,
    canManageAutomation: false,
    canViewReports: false,
    canManageSettings: false,
  },
  [UserRole.MEMBER]: {
    canViewMembers: true,
    canEditMembers: false,
    canViewFinance: false,
    canEditFinance: false,
    canManageProjects: false,
    canManageEvents: false,
    canManageInventory: false,
    canManageAutomation: false,
    canViewReports: false,
    canManageSettings: false,
  },
  [UserRole.BOARD]: {
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
  },
  [UserRole.ORGANIZATION_SECRETARY]: {
    canViewMembers: true,
    canEditMembers: true,
    canViewFinance: false,
    canEditFinance: false,
    canManageProjects: false,
    canManageEvents: false,
    canManageInventory: false,
    canManageAutomation: false,
    canViewReports: false,
    canManageSettings: false,
  },
  [UserRole.ORGANIZATION_FINANCE]: {
    canViewMembers: true,
    canEditMembers: false,
    canViewFinance: true,
    canEditFinance: true,
    canManageProjects: false,
    canManageEvents: false,
    canManageInventory: false,
    canManageAutomation: false,
    canViewReports: true,
    canManageSettings: false,
  },
  [UserRole.ACTIVITY_FINANCE]: {
    canViewMembers: true,
    canEditMembers: false,
    canViewFinance: true,
    canEditFinance: true,
    canManageProjects: false,
    canManageEvents: true,
    canManageInventory: false,
    canManageAutomation: false,
    canViewReports: false,
    canManageSettings: false,
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
};

export const usePermissions = () => {
  const { member, isDevMode: isDevModeFromAuth, simulatedRole } = useAuth();
  const devMode = isDevMode() || isDevModeFromAuth;
  
  const permissions = useMemo(() => {
    // If role is being simulated in dev mode, use that role's permissions
    if (devMode && simulatedRole) {
      return ROLE_PERMISSIONS[simulatedRole] || ROLE_PERMISSIONS[UserRole.MEMBER];
    }
    
    // Developer mode without simulation: grant all permissions
    if (devMode) {
      return DEV_MODE_PERMISSIONS;
    }
    
    if (!member) {
      return ROLE_PERMISSIONS[UserRole.GUEST];
    }
    return ROLE_PERMISSIONS[member.role] || ROLE_PERMISSIONS[UserRole.MEMBER];
  }, [member, devMode, simulatedRole]);

  const hasPermission = (permission: keyof Permission): boolean => {
    // If role is being simulated, use that role's permissions
    if (devMode && simulatedRole) {
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
    if (devMode && simulatedRole) {
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
    if (devMode && simulatedRole) {
      return perms.every(perm => permissions[perm]);
    }
    // Developer mode without simulation: always return true
    if (devMode) {
      return true;
    }
    return perms.every(perm => permissions[perm]);
  };

  // Determine effective role (simulated role in dev mode, or actual member role)
  const effectiveRole = devMode && simulatedRole ? simulatedRole : (member?.role || UserRole.GUEST);
  
  return {
    permissions,
    hasPermission,
    hasAnyPermission,
    hasAllPermissions,
    isGuest: effectiveRole === UserRole.GUEST,
    isProbationMember: effectiveRole === UserRole.PROBATION_MEMBER,
    isMember: effectiveRole === UserRole.MEMBER,
    isBoard: effectiveRole === UserRole.BOARD,
    isAdmin: effectiveRole === UserRole.ADMIN,
    isOrganizationSecretary: effectiveRole === UserRole.ORGANIZATION_SECRETARY,
    isOrganizationFinance: effectiveRole === UserRole.ORGANIZATION_FINANCE,
    isActivityFinance: effectiveRole === UserRole.ACTIVITY_FINANCE,
    isDeveloper: devMode,
    effectiveRole, // Return the effective role being used
  };
};

