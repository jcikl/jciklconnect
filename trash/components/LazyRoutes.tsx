import React, { lazy, Suspense } from 'react';
import { Routes, Route } from 'react-router-dom';

// 加载占位符组件
const LoadingFallback = () => (
  <div className="flex items-center justify-center min-h-screen">
    <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-jci-blue"></div>
  </div>
);

// 简单的占位符组件，避免导入错误
const PlaceholderComponent = ({ title }: { title: string }) => (
  <div className="p-4">
    <h1 className="text-2xl font-bold text-slate-900 mb-4">{title}</h1>
    <p className="text-slate-600">此模块正在开发中...</p>
  </div>
);

// 懒加载路由组件 - 使用占位符避免导入错误
const DashboardHome = lazy(() => Promise.resolve({ default: () => <PlaceholderComponent title="仪表板" /> }));
const MembersView = lazy(() => Promise.resolve({ default: () => <PlaceholderComponent title="会员管理" /> }));
const EventsView = lazy(() => Promise.resolve({ default: () => <PlaceholderComponent title="活动管理" /> }));
const ProjectsView = lazy(() => Promise.resolve({ default: () => <PlaceholderComponent title="项目管理" /> }));
const ActivitiesView = lazy(() => Promise.resolve({ default: () => <PlaceholderComponent title="活动视图" /> }));
const FinanceView = lazy(() => Promise.resolve({ default: () => <PlaceholderComponent title="财务管理" /> }));
const GamificationView = lazy(() => Promise.resolve({ default: () => <PlaceholderComponent title="游戏化系统" /> }));
const InventoryView = lazy(() => Promise.resolve({ default: () => <PlaceholderComponent title="库存管理" /> }));
const BusinessDirectoryView = lazy(() => Promise.resolve({ default: () => <PlaceholderComponent title="商业目录" /> }));
const AutomationStudio = lazy(() => Promise.resolve({ default: () => <PlaceholderComponent title="自动化工作室" /> }));
const KnowledgeView = lazy(() => Promise.resolve({ default: () => <PlaceholderComponent title="知识库" /> }));
const CommunicationView = lazy(() => Promise.resolve({ default: () => <PlaceholderComponent title="通讯管理" /> }));
const HobbyClubsView = lazy(() => Promise.resolve({ default: () => <PlaceholderComponent title="兴趣俱乐部" /> }));
const SurveysView = lazy(() => Promise.resolve({ default: () => <PlaceholderComponent title="调查问卷" /> }));
const MemberBenefitsView = lazy(() => Promise.resolve({ default: () => <PlaceholderComponent title="会员福利" /> }));
const DataImportExportView = lazy(() => Promise.resolve({ default: () => <PlaceholderComponent title="数据导入导出" /> }));
const AdvertisementsView = lazy(() => Promise.resolve({ default: () => <PlaceholderComponent title="广告管理" /> }));
const AIInsightsView = lazy(() => Promise.resolve({ default: () => <PlaceholderComponent title="AI 洞察" /> }));
const TemplatesView = lazy(() => Promise.resolve({ default: () => <PlaceholderComponent title="模板管理" /> }));
const ActivityPlansView = lazy(() => Promise.resolve({ default: () => <PlaceholderComponent title="活动计划" /> }));
const ReportsView = lazy(() => Promise.resolve({ default: () => <PlaceholderComponent title="报告中心" /> }));
const DeveloperInterface = lazy(() => Promise.resolve({ default: () => <PlaceholderComponent title="开发者接口" /> }));

/**
 * 懒加载路由组件
 * Lazy-loaded routes component for performance optimization
 */
export const LazyRoutes: React.FC = () => {
  return (
    <Suspense fallback={<LoadingFallback />}>
      <Routes>
        <Route path="/" element={<DashboardHome />} />
        <Route path="/dashboard" element={<DashboardHome />} />
        <Route path="/members" element={<MembersView />} />
        <Route path="/events" element={<EventsView />} />
        <Route path="/projects" element={<ProjectsView />} />
        <Route path="/activities" element={<ActivitiesView />} />
        <Route path="/finance" element={<FinanceView />} />
        <Route path="/gamification" element={<GamificationView />} />
        <Route path="/inventory" element={<InventoryView />} />
        <Route path="/business-directory" element={<BusinessDirectoryView />} />
        <Route path="/automation" element={<AutomationStudio />} />
        <Route path="/knowledge" element={<KnowledgeView />} />
        <Route path="/communication" element={<CommunicationView />} />
        <Route path="/hobby-clubs" element={<HobbyClubsView />} />
        <Route path="/surveys" element={<SurveysView />} />
        <Route path="/member-benefits" element={<MemberBenefitsView />} />
        <Route path="/data-import-export" element={<DataImportExportView />} />
        <Route path="/advertisements" element={<AdvertisementsView />} />
        <Route path="/ai-insights" element={<AIInsightsView />} />
        <Route path="/templates" element={<TemplatesView />} />
        <Route path="/activity-plans" element={<ActivityPlansView />} />
        <Route path="/reports" element={<ReportsView />} />
        <Route path="/developer" element={<DeveloperInterface />} />
      </Routes>
    </Suspense>
  );
};

export default LazyRoutes;