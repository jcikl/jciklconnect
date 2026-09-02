import React from 'react';
import {
  Award,
  Banknote,
  BarChart3,
  BookOpen,
  Briefcase,
  Building2,
  Calendar,
  CheckSquare,
  Code,
  Database,
  FileText,
  FolderKanban,
  Gift,
  Handshake,
  Heart,
  LayoutDashboard,
  Megaphone,
  MessageSquare,
  Package,
  Share2,
  SlidersHorizontal,
  Sparkles,
  Users,
  Video,
  Workflow,
  Zap,
} from 'lucide-react';
import { UserRole } from '../../types';
import { ViewType } from '../../types/views';

export interface SidebarNavigationContext {
  memberRole?: UserRole;
  isBoard: boolean;
  isAdmin: boolean;
  isDeveloper: boolean;
  isGuest: boolean;
  isPlainMember: boolean;
  canAccessWorkspaceModules: boolean;
  canViewEventsManagement: boolean;
  hasPermission: (permission: string) => boolean;
}

export interface SidebarNavigationItem {
  label: string;
  view: ViewType;
  icon: React.ReactNode;
  activeViews?: ViewType[];
  navigateMode?: 'history' | 'direct';
  visible?: (context: SidebarNavigationContext) => boolean;
}

export interface SidebarNavigationSection {
  id: string;
  label?: string;
  inset?: boolean;
  visible?: (context: SidebarNavigationContext) => boolean;
  items: SidebarNavigationItem[];
}

const isPrivileged = ({ isBoard, isAdmin, isDeveloper }: SidebarNavigationContext) => isBoard || isAdmin || isDeveloper;

export const sidebarNavigationSections: SidebarNavigationSection[] = [
  {
    id: 'primary',
    items: [
      {
        icon: <LayoutDashboard size={18} />,
        label: 'Dashboard',
        view: 'DASHBOARD',
      },
      {
        icon: <Users size={18} />,
        label: 'Members',
        view: 'MEMBERS',
        visible: ({ canAccessWorkspaceModules }) => canAccessWorkspaceModules,
      },
      {
        icon: <Calendar size={18} />,
        label: 'Event List',
        view: 'EVENTS',
        visible: ({ canAccessWorkspaceModules }) => canAccessWorkspaceModules,
      },
      {
        icon: <MessageSquare size={18} />,
        label: 'Communication',
        view: 'COMMUNICATION',
        visible: ({ canAccessWorkspaceModules }) => canAccessWorkspaceModules,
      },
      {
        icon: <Building2 size={18} />,
        label: 'Directory',
        view: 'DIRECTORY',
      },
      {
        icon: <BookOpen size={18} />,
        label: 'Knowledge',
        view: 'KNOWLEDGE',
        visible: ({ isGuest }) => !isGuest,
      },
      {
        icon: <Gift size={18} />,
        label: 'Benefits',
        view: 'BENEFITS',
        visible: ({ memberRole }) => memberRole !== UserRole.INACTIVE,
      },
      {
        icon: <Heart size={18} />,
        label: 'Hobby Clubs',
        view: 'CLUBS',
      },
    ],
  },
  {
    id: 'workspace',
    label: 'Workspace',
    visible: ({ memberRole }) => memberRole !== UserRole.GUEST,
    items: [
      {
        icon: <FolderKanban size={18} />,
        label: 'Events Management',
        view: 'PROJECTS',
        visible: ({ canViewEventsManagement }) => canViewEventsManagement,
      },
      {
        icon: <CheckSquare size={18} />,
        label: 'Surveys',
        view: 'SURVEYS',
      },
      {
        icon: <Video size={18} />,
        label: 'Zoom Booking',
        view: 'ZOOM_BOOKING',
      },
      {
        icon: <Share2 size={18} />,
        label: 'Social Media',
        view: 'SOCIAL_MEDIA',
      },
      {
        icon: <Banknote size={18} />,
        label: 'Finances',
        view: 'FINANCE',
        visible: ({ hasPermission }) => hasPermission('canViewFinance'),
      },
      {
        icon: <Package size={18} />,
        label: 'Inventory',
        view: 'INVENTORY',
        visible: ({ hasPermission }) => hasPermission('canViewFinance'),
      },
      {
        icon: <Handshake size={18} />,
        label: 'Sponsorships',
        view: 'SPONSORSHIPS',
        visible: ({ isBoard, isAdmin }) => isBoard || isAdmin,
      },
      {
        icon: <Award size={18} />,
        label: 'Gamification',
        view: 'GAMIFICATION',
        visible: ({ canAccessWorkspaceModules }) => canAccessWorkspaceModules,
      },
    ],
  },
  {
    id: 'portal',
    label: 'Portal',
    visible: isPrivileged,
    items: [
      {
        icon: <Briefcase size={18} />,
        label: 'Flagship Projects Mgt',
        view: 'FLAGSHIP_PROJECTS_MGT',
        visible: ({ canViewEventsManagement, isPlainMember }) => canViewEventsManagement && !isPlainMember,
      },
      {
        icon: <Megaphone size={18} />,
        label: 'Partnerships & Promotions',
        view: 'ADVERTISEMENTS',
        visible: ({ isBoard, isAdmin }) => isBoard || isAdmin,
      },
      {
        icon: <BookOpen size={18} />,
        label: 'Publications',
        view: 'PUBLICATIONS',
      },
    ],
  },
  {
    id: 'system',
    label: 'System',
    inset: true,
    visible: (context) => context.memberRole !== UserRole.GUEST && isPrivileged(context),
    items: [
      {
        icon: <FileText size={18} />,
        label: 'Templates',
        view: 'TEMPLATES',
      },
      {
        icon: <BarChart3 size={18} />,
        label: 'Reports',
        view: 'REPORTS',
      },
      {
        icon: <Database size={18} />,
        label: 'Data Import / Export',
        view: 'DATA_IMPORT_EXPORT',
      },
      {
        icon: <Zap size={18} />,
        label: 'Radar Data Importer',
        view: 'RADAR_IMPORTER',
      },
      {
        icon: <SlidersHorizontal size={18} />,
        label: 'Config',
        view: 'SYSTEM_CONFIG',
        activeViews: ['SYSTEM_CONFIG', 'MEMBERSHIP_CONFIG', 'ACCESS_CONFIG', 'API_CONFIG', 'TOYYIB', 'WHAPI_CONFIG'],
        visible: ({ memberRole }) => memberRole === UserRole.SUPER_ADMIN,
      },
      {
        icon: <Workflow size={18} />,
        label: 'Automation Studio',
        view: 'AUTOMATION',
        visible: ({ isBoard, isAdmin }) => isBoard || isAdmin,
      },
    ],
  },
  {
    id: 'developer',
    label: 'Developer',
    inset: true,
    visible: ({ isDeveloper }) => isDeveloper,
    items: [
      {
        icon: <Sparkles size={18} />,
        label: 'AI Insights',
        view: 'AI_INSIGHTS',
        navigateMode: 'direct',
      },
      {
        icon: <Code size={18} />,
        label: 'Developer Interface',
        view: 'DEVELOPER',
      },
    ],
  },
];
