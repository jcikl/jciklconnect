import { UserRole } from '../types';

export interface Permission {
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

/** Static permission baseline per role. Dynamic board elevation is applied at runtime in usePermissions. */
export const ROLE_PERMISSIONS: Record<UserRole, Permission> = {
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
  // BOARD is deprecated as a static role - Board access is granted dynamically via isCurrentBoardMember
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

export const ALL_PERMISSIONS_GRANTED: Permission = {
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
