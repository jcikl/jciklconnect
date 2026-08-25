import React, { lazy } from 'react';
import { UserRole } from '../../types';
import { ViewType } from '../../types/views';

const FinanceView = lazy(() => import('../modules/FinanceView').then(m => ({ default: m.FinanceView })));
const PaymentRequestsView = lazy(() => import('../modules/PaymentRequestsView').then(m => ({ default: m.PaymentRequestsView })));
const GamificationView = lazy(() => import('../modules/GamificationView').then(m => ({ default: m.GamificationView })));
const EventsView = lazy(() => import('../modules/EventsView').then(m => ({ default: m.EventsView })));
const MembersView = lazy(() => import('../modules/MembersView').then(m => ({ default: m.MembersView })));
const ProjectsView = lazy(() => import('../modules/ProjectsView').then(m => ({ default: m.ProjectsView })));
const FlagshipProjectsManagementView = lazy(() => import('../modules/FlagshipProjectsManagementView').then(m => ({ default: m.FlagshipProjectsManagementView })));
const InventoryView = lazy(() => import('../modules/InventoryView').then(m => ({ default: m.InventoryView })));
const BusinessDirectoryView = lazy(() => import('../modules/BusinessDirectoryView').then(m => ({ default: m.BusinessDirectoryView })));
const AutomationStudio = lazy(() => import('../modules/AutomationStudio').then(m => ({ default: m.AutomationStudio })));
const KnowledgeView = lazy(() => import('../modules/KnowledgeView').then(m => ({ default: m.KnowledgeView })));
const CommunicationView = lazy(() => import('../modules/CommunicationView').then(m => ({ default: m.CommunicationView })));
const HobbyClubsView = lazy(() => import('../modules/HobbyClubsView').then(m => ({ default: m.HobbyClubsView })));
const ZoomBookingView = lazy(() => import('../modules/ZoomBookingView').then(m => ({ default: m.ZoomBookingView })));
const SocialMediaView = lazy(() => import('../modules/SocialMediaView').then(m => ({ default: m.SocialMediaView })));
const SurveysView = lazy(() => import('../modules/SurveysView').then(m => ({ default: m.SurveysView })));
const MemberBenefitsView = lazy(() => import('../modules/MemberBenefitsView').then(m => ({ default: m.MemberBenefitsView })));
const DataImportExportView = lazy(() => import('../modules/DataImportExportView').then(m => ({ default: m.DataImportExportView })));
const AdvertisementsView = lazy(() => import('../modules/AdvertisementsView').then(m => ({ default: m.AdvertisementsView })));
const AIInsightsView = lazy(() => import('../modules/AIInsightsView').then(m => ({ default: m.AIInsightsView })));
const TemplatesView = lazy(() => import('../modules/TemplatesView').then(m => ({ default: m.TemplatesView })));
const ActivityPlansView = lazy(() => import('../modules/ActivityPlansView').then(m => ({ default: m.ActivityPlansView })));
const ReportsView = lazy(() => import('../modules/ReportsView').then(m => ({ default: m.ReportsView })));
const BoardDashboard = lazy(() => import('../dashboard/BoardDashboard').then(m => ({ default: m.BoardDashboard })));
const DashboardHome = lazy(() => import('../dashboard/DashboardHome').then(m => ({ default: m.DashboardHome })));
const DeveloperInterface = lazy(() => import('../modules/DeveloperInterface').then(m => ({ default: m.DeveloperInterface })));
const ToyyibView = lazy(() => import('../modules/ToyyibView').then(m => ({ default: m.ToyyibView })));
const SystemConfigView = lazy(() => import('../modules/SystemConfigView').then(m => ({ default: m.SystemConfigView })));
const PublicationsView = lazy(() => import('../modules/PublicationsView').then(m => ({ default: m.PublicationsView })));
const RadarDataImporter = lazy(() => import('../admin/RadarDataImporter').then(m => ({ default: m.RadarDataImporter })));
const SponsorshipView = lazy(() => import('../modules/SponsorshipView').then(m => ({ default: m.SponsorshipView })));

export interface AppViewRenderContext {
  memberRole?: UserRole;
  hasMember: boolean;
  isBoard: boolean;
  isAdmin: boolean;
  isDeveloper: boolean;
  isPlainMember: boolean;
  canAccessWorkspaceModules: boolean;
  canAccessEventsAndPayments: boolean;
  canViewEventsManagement: boolean;
  hasPermission: (permission: string) => boolean;
  showBoardDashboard: boolean;
  searchQuery: string;
  onSearchChange: React.Dispatch<React.SetStateAction<string>>;
  onNavigate: (view: ViewType, selectedId?: string) => void;
  scrollRef?: React.RefObject<HTMLDivElement>;
  initialSelectedMemberId: string | null;
  initialSelectedEventId: string | null;
  initialSelectedProjectId: string | null;
  initialSelectedBusinessId: string | null;
  clearSelectedMember: () => void;
  clearSelectedEvent: () => void;
  clearSelectedProject: () => void;
  clearSelectedBusiness: () => void;
  wrapErrorBoundary: (component: React.ReactNode, moduleName: string) => React.ReactNode;
}

export const renderAppView = (view: ViewType, context: AppViewRenderContext): React.ReactNode => {
  const {
    memberRole,
    hasMember,
    isBoard,
    isAdmin,
    isDeveloper,
    isPlainMember,
    canAccessWorkspaceModules,
    canAccessEventsAndPayments,
    canViewEventsManagement,
    hasPermission,
    showBoardDashboard,
    searchQuery,
    onSearchChange,
    onNavigate,
    scrollRef,
    initialSelectedMemberId,
    initialSelectedEventId,
    initialSelectedProjectId,
    initialSelectedBusinessId,
    clearSelectedMember,
    clearSelectedEvent,
    clearSelectedProject,
    clearSelectedBusiness,
    wrapErrorBoundary,
  } = context;

  const dashboardFallback = (
    <DashboardHome
      userRole={(memberRole as UserRole) || UserRole.MEMBER}
      onNavigate={onNavigate}
      searchQuery={searchQuery}
      onSearchChange={onSearchChange}
      scrollRef={scrollRef}
    />
  );

  switch (view) {
    case 'MEMBERS':
      if (!canAccessWorkspaceModules && !hasMember) return dashboardFallback;
      return wrapErrorBoundary(<MembersView searchQuery={searchQuery} initialSelectedMemberId={initialSelectedMemberId} onClearSelection={clearSelectedMember} onNavigate={onNavigate} />, '会员');
    case 'PROJECTS':
      if (!canViewEventsManagement) return dashboardFallback;
      return wrapErrorBoundary(<ProjectsView onNavigate={onNavigate} searchQuery={searchQuery} initialSelectedProjectId={initialSelectedProjectId} onClearSelection={clearSelectedProject} />, '活动管理');
    case 'FLAGSHIP_PROJECTS_MGT':
      if (!canViewEventsManagement || isPlainMember) return dashboardFallback;
      return wrapErrorBoundary(<FlagshipProjectsManagementView searchQuery={searchQuery} />, '旗舰项目');
    case 'EVENTS':
      if (!canViewEventsManagement) return dashboardFallback;
      return wrapErrorBoundary(<EventsView searchQuery={searchQuery} initialSelectedEventId={initialSelectedEventId} onClearSelection={clearSelectedEvent} />, '活动列表');
    case 'FINANCE':
      if (memberRole === UserRole.GUEST) return dashboardFallback;
      if (!hasPermission('canViewFinance')) return dashboardFallback;
      return wrapErrorBoundary(<FinanceView searchQuery={searchQuery} />, '财务');
    case 'PAYMENT_REQUESTS':
      if (!hasPermission('canViewFinance') && !canAccessEventsAndPayments) return dashboardFallback;
      return wrapErrorBoundary(<PaymentRequestsView searchQuery={searchQuery} />, '付款申请');
    case 'GAMIFICATION':
      if (memberRole === UserRole.GUEST) return dashboardFallback;
      return wrapErrorBoundary(<GamificationView />, '积分系统');
    case 'INVENTORY':
      if (memberRole === UserRole.GUEST) return dashboardFallback;
      if (!hasPermission('canViewFinance')) return dashboardFallback;
      return wrapErrorBoundary(<InventoryView searchQuery={searchQuery} />, '库存');
    case 'DIRECTORY':
      if (!hasMember) return dashboardFallback;
      return wrapErrorBoundary(<BusinessDirectoryView searchQuery={searchQuery} initialSelectedBusinessId={initialSelectedBusinessId} onClearSelection={clearSelectedBusiness} />, '商业目录');
    case 'AUTOMATION':
      if (!isAdmin && !isBoard) return dashboardFallback;
      return wrapErrorBoundary(<AutomationStudio />, '自动化');
    case 'KNOWLEDGE':
      if (!hasMember || memberRole === UserRole.GUEST) return dashboardFallback;
      return wrapErrorBoundary(<KnowledgeView searchQuery={searchQuery} />, '知识库');
    case 'COMMUNICATION':
      if (!canAccessWorkspaceModules) return dashboardFallback;
      return wrapErrorBoundary(<CommunicationView searchQuery={searchQuery} />, '通讯');
    case 'CLUBS':
      if (memberRole === UserRole.INACTIVE) return dashboardFallback;
      return wrapErrorBoundary(<HobbyClubsView searchQuery={searchQuery} />, '兴趣小组');
    case 'ZOOM_BOOKING':
      if (memberRole === UserRole.INACTIVE) return dashboardFallback;
      return wrapErrorBoundary(<ZoomBookingView />, 'Zoom Booking');
    case 'SOCIAL_MEDIA':
      if (memberRole === UserRole.INACTIVE) return dashboardFallback;
      return wrapErrorBoundary(<SocialMediaView />, 'Social Media');
    case 'SURVEYS':
      if (memberRole === UserRole.INACTIVE) return dashboardFallback;
      return wrapErrorBoundary(<SurveysView searchQuery={searchQuery} />, '问卷');
    case 'BENEFITS':
      if (memberRole === UserRole.INACTIVE) return dashboardFallback;
      return wrapErrorBoundary(<MemberBenefitsView searchQuery={searchQuery} />, '会员福利');
    case 'DATA_IMPORT_EXPORT':
      if (memberRole === UserRole.GUEST || isPlainMember) return dashboardFallback;
      return wrapErrorBoundary(<DataImportExportView />, '数据导入导出');
    case 'RADAR_IMPORTER':
      if (memberRole === UserRole.GUEST || isPlainMember) return dashboardFallback;
      return wrapErrorBoundary(<RadarDataImporter />, 'Radar 导入');
    case 'ADVERTISEMENTS':
      if (memberRole === UserRole.GUEST || isPlainMember) return dashboardFallback;
      return wrapErrorBoundary(<AdvertisementsView searchQuery={searchQuery} />, '合作推广');
    case 'AI_INSIGHTS':
      if (!isDeveloper && !isAdmin && !isBoard) return dashboardFallback;
      return wrapErrorBoundary(<AIInsightsView onNavigate={onNavigate} searchQuery={searchQuery} />, 'AI 洞察');
    case 'TEMPLATES':
      if (memberRole === UserRole.GUEST || isPlainMember) return dashboardFallback;
      return wrapErrorBoundary(<TemplatesView searchQuery={searchQuery} />, '模板');
    case 'ACTIVITY_PLANS':
      if (!canAccessWorkspaceModules && !isBoard && !isAdmin) return dashboardFallback;
      return wrapErrorBoundary(<ActivityPlansView searchQuery={searchQuery} />, '活动计划');
    case 'REPORTS':
      if (!(isAdmin || isBoard || isDeveloper)) return dashboardFallback;
      return wrapErrorBoundary(<ReportsView />, '报告');
    case 'DEVELOPER':
      if (!isDeveloper && !isAdmin) return dashboardFallback;
      return wrapErrorBoundary(<DeveloperInterface />, '开发者界面');
    case 'TOYYIB':
      if (!isAdmin && !isBoard && !isDeveloper) return dashboardFallback;
      return wrapErrorBoundary(<ToyyibView />, 'ToyyibPay');
    case 'WHAPI_CONFIG':
      if (!isAdmin && !isBoard && !isDeveloper) return dashboardFallback;
      return wrapErrorBoundary(<SystemConfigView initialTab="whapi" />, '系统配置');
    case 'API_CONFIG':
      if (!isAdmin && !isBoard && !isDeveloper) return dashboardFallback;
      return wrapErrorBoundary(<SystemConfigView initialTab="toyyib" />, '系统配置');
    case 'MEMBERSHIP_CONFIG':
      if (!isAdmin && !isBoard) return dashboardFallback;
      return wrapErrorBoundary(<SystemConfigView initialTab="membership" />, '会籍配置');
    case 'ACCESS_CONFIG':
      if (!isAdmin && !isBoard) return dashboardFallback;
      return wrapErrorBoundary(<SystemConfigView initialTab="access" />, '访问配置');
    case 'SYSTEM_CONFIG':
      if (!isAdmin && !isBoard) return dashboardFallback;
      return wrapErrorBoundary(<SystemConfigView />, '系统配置');
    case 'PUBLICATIONS':
      if (memberRole === UserRole.GUEST || isPlainMember) return dashboardFallback;
      return wrapErrorBoundary(<PublicationsView />, '刊物');
    case 'SPONSORSHIPS':
      if (!isBoard && !isAdmin) return dashboardFallback;
      return wrapErrorBoundary(<SponsorshipView searchQuery={searchQuery} />, '赞助');
    default:
      if ((isBoard || isAdmin) && showBoardDashboard) {
        return wrapErrorBoundary(
          <BoardDashboard
            onNavigate={onNavigate}
            searchQuery={searchQuery}
            onSearchChange={onSearchChange}
            scrollRef={scrollRef}
          />,
          '董事会仪表板'
        );
      }
      return wrapErrorBoundary(dashboardFallback, '仪表板');
  }
};
