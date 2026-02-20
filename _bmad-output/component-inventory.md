# 组件清单 — App (Web)

## 概述

基于 exhaustive 扫描的组件目录概览；组件根目录为 `components/`，约 82 个 TSX 文件。

## 按目录分类

| 目录 | 用途 | 示例 |
|------|------|------|
| **auth/** | 认证 UI | LoginModal, RegisterModal |
| **dashboard/** | 仪表盘与总览 | DashboardHome, Analytics, BoardDashboard |
| **modules/** | 业务模块视图 | MembersView, EventsView, FinanceView, GovernanceView, GamificationView, AutomationStudio, SurveysView, ProjectsView, BusinessDirectoryView, InventoryView, KnowledgeView, AdvertisementsView, CommunicationView, HobbyClubsView, ReportsView, MemberBenefitsView, ActivitiesView, ActivityPlansView, AIInsightsView, DataImportExportView, MessagingView, TemplatesView, VotingManagementView, AchievementManagementView, BadgeManagementView 等 |
| **modules/Finance/** | 财务子组件 | TransactionSplitModal, DuesRenewalModal, BankReconciliationModal, MerchandiseReconciliationModal, DuesRenewalDashboard, ProjectFinancialAccount 等 |
| **modules/MemberManagement/** | 会员管理子组件 | BoardOfDirectorsSection, BoardTransitionTools, PromotionTracking, DataImportExport, MentorMatching 等 |
| **modules/ProjectManagement/** | 项目管理子组件 | ProjectGanttChart, ProjectReportGenerator 等 |
| **modules/AutomationStudio/** | 自动化工作流 UI | WorkflowCanvas, RuleTestPanel, WorkflowTestPanel, RuleEngineConfig, WorkflowNodeConfigPanel 等 |
| **ui/** | 通用 UI | Common, Form, DataTable, Pagination, Loading, ErrorBoundary, AsyncErrorBoundary, ErrorRecovery, Responsive, NudgeBanner 等 |
| **accessibility/** | 无障碍 | AccessibleModal, AccessibilityChecker, AccessibleNavigation, AccessibleForm |
| **performance/** | 性能 | LazyRoutes, PerformanceMonitor, VirtualList, OptimizedMembersList |
| **dev/** | 开发工具 | RoleSimulator 等 |

## 设计系统

- **Tailwind**：全局样式；主题色在 `tailwind.config.js`（jci.blue, navy, teal 等）。
- **lucide-react**：图标。
- **recharts**：图表；**react-big-calendar**：日历；**gantt-task-react**：甘特图。

## 说明

- 详细 API 与用法以源码为准；本清单用于文档化与 PRD/架构参考。
