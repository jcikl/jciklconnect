# UI 代码优化计划与任务清单

更新时间：2026-08-25

## 目标

本计划用于分阶段优化 JCI Kuala Lumpur 管理平台的前端 UI 代码，重点降低 `App.tsx` 与大型业务模块的复杂度，提升可维护性、性能稳定性和 UI 一致性。

优化不以一次性大重写为目标，而是采用小步、可验证、可回滚的重构方式。每个阶段都应保持现有功能行为不变，并通过构建或关键页面手工验证。

## 当前观察

- `App.tsx` 约 1600+ 行，集中承担导航、权限判断、视图渲染、桌面侧边栏、移动菜单、搜索、通知、安装提示等职责。
- 多个 UI 文件超过 1000 行，例如 `DashboardHome.tsx`、`BusinessDirectoryView.tsx`、`FinanceView.tsx`、`InventoryView.tsx`、`EventsView.tsx`。
- 项目已有 `components/ui` 基础组件、懒加载和部分 `React.memo`/虚拟列表优化，说明已有可继续沉淀的基础。
- 多个模块仍重复实现 toolbar、filter drawer、empty/loading state、detail drawer、mobile card、表格/列表布局。
- `index.css` 存在影响范围较大的全局规则，例如全局禁止文本选择和全局 transition。

## 优化原则

- 保持业务行为不变，先重构结构，再调整视觉。
- 优先抽离配置和无状态 UI，避免先移动复杂业务逻辑。
- 每次 PR 控制在一个明确边界内，例如只拆 `App.tsx` 的菜单配置，或只抽一个模块的数据 hook。
- 共用组件必须从真实重复场景中提取，不为假想需求提前抽象。
- 每阶段完成后至少运行 `npm run build`，高风险模块再补充关键交互验证。

## 阶段 1：应用壳层瘦身

目标：让 `App.tsx` 从“大型总控组件”变成“应用壳层入口”，把可配置内容移出主文件。

当前状态：

- [x] 已新增 `components/app/viewTitles.ts`，将 document title 映射移出 `App.tsx`。
- [x] 已新增 `components/app/navigationConfig.tsx`，将桌面侧边栏菜单配置移出 `App.tsx`。
- [x] 已新增 `components/app/viewRegistry.tsx`，将主工作区视图懒加载和 `switch(view)` 渲染逻辑移出 `App.tsx`。
- [x] 已新增 `components/app/AppShell.tsx`，将外层布局、移动侧栏遮罩和桌面侧边栏渲染移出 `App.tsx`。
- [x] 已将 document title、无障碍页面标题和顶部栏短标题统一收口到 `components/app/viewTitles.ts`。
- [x] 已新增 `hooks/useAppNavigation.ts`，将 `view`、`viewHistory`、`localStorage`、URL 同步和 Android 返回逻辑移出 `App.tsx`。

### 任务

- [x] 新增 `components/app/viewRegistry.tsx`
  - 定义 `ViewType` 到标题、懒加载组件、权限检查、默认 props 的映射。
  - 替代 `App.tsx` 中的大型 `switch (view)`。
- [x] 新增 `components/app/navigationConfig.tsx`
  - 定义侧边栏分组、菜单项、icon、可见条件、active 条件。
  - 替代重复的 `SidebarItem` JSX。
- [x] 新增 `components/app/AppShell.tsx`
  - 承担桌面侧边栏、顶部栏、移动底栏、移动菜单容器。
  - 当前已承担外层布局、移动侧栏遮罩和桌面侧边栏；顶部栏、移动底栏、移动菜单后续再继续拆分。
- [x] 新增 `hooks/useAppNavigation.ts`
  - 管理 `view`、`viewHistory`、`localStorage`、URL 同步和返回逻辑。
- [x] 将页面标题映射改为配置读取。
  - 删除长三元表达式。

### 验收标准

- [ ] 登录后各主要菜单仍可正常切换。
- [ ] 访客页、会员仪表板、董事会仪表板仍按原权限显示。
- [ ] 刷新页面后仍能恢复最后访问 view。
- [x] `npm run build` 通过。

## 阶段 2：统一页面骨架与导航 UI

目标：减少各模块重复的页面头部、搜索、筛选、操作区、空状态和加载状态。

结论：阶段 2 原始目标为完成共享 UI 骨架试点。目前共享组件已建立，多个低风险模块已迁移并通过构建验证，因此阶段 2 按“试点完成”收口；剩余页面迁移不再阻塞阶段 3，转入阶段 3 过程中的持续改进 backlog。

当前状态：

- [x] 已新增 `components/ui/PageScaffold.tsx`，提供统一页面标题、操作区、tabs、toolbar 和 loading/error/empty 状态入口。
- [x] 已将 `components/modules/ActivityPlansView.tsx` 作为首个试点接入 `PageScaffold`，减少页面头部、tabs 和状态容器重复代码。
- [x] 已将 `ActivityPlansView`、`MembersView`、`InventoryView` 的 `Pagination` 改为直接导入，消除对应 Rollup 循环 re-export 警告。
- [x] 已新增 `components/ui/ModuleToolbar.tsx`，并将 `InventoryView` 的搜索工具条迁移为统一组件。
- [x] 已新增 `components/ui/EmptyState.tsx`，并接入 `LoadingState` 与 `AccessConfigView` 的空状态展示。
- [x] 已新增 `components/ui/LoadingState.tsx`，将页面/列表状态容器从 `Loading.tsx` 中独立出来，并保留旧导入路径兼容。
- [x] 已新增 `components/ui/FilterDrawer.tsx`，并将 `BusinessDirectoryView` 的主筛选抽屉外壳迁移为统一组件。
- [x] 已将 `components/modules/SurveysView.tsx` 接入 `PageScaffold`，继续扩展统一页面骨架的试点覆盖。
- [x] 已将 `components/modules/TemplatesView.tsx` 接入 `PageScaffold`，统一模板管理页的标题、tabs 与 loading/error 外壳。
- [x] 已将 `components/modules/PaymentRequestsView.tsx` 保守接入 `PageScaffold`，统一页面标题和内容骨架，同时保留原有移动端/桌面端 tabs 与审批列表逻辑。
- [x] 已将 `components/modules/ReportsView.tsx` 接入 `PageScaffold`，统一报表页标题、操作按钮、tabs 与生成状态外壳。
- [x] 已将 `components/modules/ZoomBookingView.tsx` 保守接入 `PageScaffold`，统一页面标题和内容骨架，同时保留 list/calendar 切换与预约弹窗逻辑。
- [x] 已将 `components/modules/SponsorshipView.tsx` 接入 `PageScaffold` 与 `ModuleToolbar`，统一赞助页标题、操作按钮、loading/error 外壳和 records 搜索栏。
- [x] 已将 `components/modules/PublicationsView.tsx` 接入 `PageScaffold` 与 `ModuleToolbar`，统一出版物页标题、操作按钮、loading/empty 外壳和搜索/筛选栏。
- [x] 已将 `components/modules/MembersView.tsx` 保守接入 `PageScaffold`，统一成员目录页标题和操作按钮外壳，同时保留原有 tabs、筛选、分页、批量操作与详情弹窗逻辑。
- [x] 已将 `components/modules/DataImportExportView.tsx` 接入 `PageScaffold`，统一数据导入导出页标题与 tabs 外壳，同时保留原有导出、导入和结果展示逻辑。

### 任务

- [x] 新增 `components/ui/PageScaffold.tsx`
  - 支持 title、subtitle、search、actions、tabs、children。
- [x] 新增 `components/ui/ModuleToolbar.tsx`
  - 支持搜索框、筛选按钮、批量操作、主按钮。
- [x] 新增 `components/ui/EmptyState.tsx`
  - 支持 icon、title、description、action。
- [x] 新增 `components/ui/LoadingState.tsx`
  - 统一页面级和列表级 loading。
- [x] 新增 `components/ui/FilterDrawer.tsx`
  - 抽象移动端筛选抽屉常见布局。
- [x] 选择 1 个低风险模块试点迁移，例如 `InventoryView` 或 `SurveysView`。
  - 当前已完成 `ActivityPlansView`、`SurveysView` 与 `TemplatesView` 的 `PageScaffold` 试点，`InventoryView` 已接入 `ModuleToolbar`。
- [x] 扩展第一批页面骨架迁移。
  - 已完成：`PaymentRequestsView`、`ReportsView`、`ZoomBookingView`、`SponsorshipView`、`PublicationsView`、`MembersView`、`DataImportExportView`。
  - 保守迁移原则：只收口页面标题、操作区、tabs/toolbar 和 loading/empty 外壳，不移动复杂业务状态、弹窗或数据 mutation。
- [x] 扩展第一批搜索/筛选工具条迁移。
  - 已完成：`InventoryView`、`SponsorshipView`、`PublicationsView`。
  - 暂缓：`MembersView` 的搜索由应用外层传入，当前更适合先保留现有全局搜索链路。
- [x] 建立第一批共享状态/抽屉组件覆盖。
  - `EmptyState` 已接入 `LoadingState` 和 `AccessConfigView`。
  - `FilterDrawer` 已接入 `BusinessDirectoryView` 主筛选抽屉外壳。

### 持续改进 backlog

- [ ] 随阶段 3 拆分继续迁移更多页面到 `PageScaffold`。
  - 下一批候选：`MemberBenefitsView`、`HobbyClubsView`、`CommunicationView`、`AdvertisementsView`。
  - 选择标准：页面已有标题、tabs/filter、loading/error 和列表/卡片内容，且业务状态集中、弹窗逻辑可保持原样。
  - 当前已完成：`PaymentRequestsView` 页面标题和内容骨架保守接入，`ReportsView` 标题、操作按钮、tabs 与状态外壳接入，`ZoomBookingView` 页面标题、视图切换操作区和内容骨架接入，`SponsorshipView`、`PublicationsView`、`MembersView` 与 `DataImportExportView` 标题、操作按钮或 tabs 外壳接入。
- [ ] 随阶段 3 拆分继续迁移搜索与筛选操作区到 `ModuleToolbar`。
  - 下一批候选：`BusinessDirectoryView`、`EventsView`、`PaymentRequestsView`、`HobbyClubsView`。
  - 重点统一 search input、clear button、filter button、批量操作和主操作按钮布局。
  - 当前已完成：`InventoryView`、`SponsorshipView` 与 `PublicationsView` 的搜索栏接入。
- [ ] 扩大 `EmptyState` 覆盖范围。
  - 下一批候选：`TemplatesView`、`SurveysView`、`ReportsView`、`InventoryView`、`MembersView` 筛选无结果状态。
  - 将散落的 `No records found`、`No templates yet`、`No results` 等文案统一为共享空状态组件。
- [ ] 继续迁移移动端筛选抽屉到 `FilterDrawer`。
  - 优先完成 `BusinessDirectoryView` 剩余移动端筛选抽屉。
  - 后续检查其他模块是否存在重复 drawer footer、reset/apply、关闭按钮布局。
- [ ] 评估并抽出统一新增入口组件。
  - 候选名称：`InlineCreateAction` 或 `CreateItemRow`。
  - 适用场景：`MembersView` 的 `Add new`、`New Survey`、`New Event Template`、`New Activity Plan Template`、`New Budget Template`、`Add Item` 等虚线新增入口。
- [ ] 继续整理 UI 组件导入路径，降低 barrel re-export 风险。
  - 已完成 `Pagination` 直接导入试点。
  - 下一批检查 `Tabs`、`PageHeader`、`Modal`、`Drawer`、`Button` 是否适合在高频模块中直接导入。

### 验收标准

- [x] 试点模块 UI 行为不变。
- [x] 重复 Tailwind class 明显减少。
- [x] 新组件 API 简洁，没有绑定特定业务实体。
- [x] `npm run build` 通过。
- [x] 每次新增迁移后更新本阶段“当前状态”和对应任务勾选。
- [x] 新迁移模块保留原有权限、筛选、分页、弹窗和批量操作行为。

## 阶段 3：大型模块分层拆分

目标：把 1000 行以上模块拆成数据 hook、容器组件、展示组件和弹窗/抽屉组件。

当前状态：

- [x] 已启动 `InventoryView.tsx` 拆分，先新增 `components/modules/Inventory/inventoryViewConfig.ts`，将库存模块 tabs id/label 和内部 tab 类型移出主组件。
- [x] 已新增 `components/modules/Inventory/InventoryItemsTab.tsx`，将 items tab 的搜索栏、桌面表格、移动卡片和分页展示从 `InventoryView.tsx` 中抽离，父组件继续保留状态和业务操作回调。
- [x] 已新增 `components/modules/Inventory/InventoryStatsStrip.tsx`，将库存 KPI 卡片组从 `InventoryView.tsx` 中抽离，父组件继续负责统计数据计算。
- [x] 已新增 `components/modules/Inventory/InventoryStockCardModal.tsx`，将 stock card 历史弹窗展示从 `InventoryView.tsx` 中抽离，父组件继续负责加载和清理库存流水。
- [x] 已新增 `components/modules/Inventory/InventoryStockAdjustmentModal.tsx`，将库存调整弹窗表单从 `InventoryView.tsx` 中抽离，父组件继续负责提交、刷新和关闭逻辑。
- [x] 已新增 `components/modules/Inventory/InventoryCheckOutModal.tsx`，将出库分配弹窗从 `InventoryView.tsx` 中抽离，父组件继续负责出库提交和状态清理。
- [x] 已新增 `components/modules/Inventory/InventoryItemFormFields.tsx`，将新增/编辑库存物品弹窗中重复的基础字段、variants 管理和折旧字段抽成共享表单字段组件，父组件继续保留新增/编辑 mutation 提交流程。
- [x] 已新增 `components/modules/Inventory/InventoryMaintenanceTab.tsx`，将 maintenance tab 列表展示和完成维护交互从 `InventoryView.tsx` 中抽离，同时移除该 tab props 中未使用的 create/update schedule 回调。
- [x] 已新增 `components/modules/Inventory/InventoryAlertsTab.tsx`，将 alerts tab 的 KPI、扫描按钮、告警列表和确认交互从 `InventoryView.tsx` 中抽离，父组件继续负责传入告警数据和回调。
- [x] 已新增 `components/modules/Inventory/InventoryFinancialHistoryTab.tsx`，将 finance tab 的交易摘要、桌面表格和移动卡片展示从 `InventoryView.tsx` 中抽离，父组件继续负责加载交易数据。
- [x] 已新增 `components/modules/Inventory/InventoryDepreciationTab.tsx`，将 depreciation tab 的本地更新状态、KPI、桌面表格和移动卡片展示从 `InventoryView.tsx` 中抽离，父组件继续负责提供重算回调。
- [x] 已新增 `components/modules/Inventory/InventoryMaintenanceScheduleModal.tsx`，将维护日程新增/编辑弹窗及其局部表单状态从 `InventoryView.tsx` 中抽离，父组件继续负责保存、刷新和 toast。
- [x] 已新增 `components/modules/Inventory/InventoryItemModal.tsx`，将新增/编辑库存物品 modal 外壳从 `InventoryView.tsx` 中抽离，复用 `InventoryItemFormFields.tsx`。
- [x] `InventoryView.tsx` 已从大型内联页面拆到约 496 行，进入本阶段 300-500 行验收范围。
- [x] 已新增 `components/modules/Inventory/useInventoryItemForm.ts`，将库存物品新增/编辑提交、表单解析、折旧初始值计算和 variants 状态从 `InventoryView.tsx` 中抽离。
- [x] `InventoryView.tsx` 进一步降到约 395 行，页面入口更接近纯容器。
- [x] 已新增 `components/modules/Inventory/useInventoryStockActions.ts`，将库存流水加载、库存调整提交、库存流水弹窗状态从 `InventoryView.tsx` 中抽离。
- [x] `InventoryView.tsx` 进一步降到约 367 行，库存模块容器职责更集中。
- [x] 已新增 `components/modules/Inventory/useInventoryMaintenanceActions.ts`，将维护日程弹窗开关、选中日程和新增/编辑保存流程从 `InventoryView.tsx` 中抽离。
- [x] 已修复 `InventoryMaintenanceScheduleModal.tsx` 在切换新增/编辑日程时表单初始值不刷新的隐患。
- [x] `InventoryView.tsx` 进一步降到约 359 行，阶段 3 库存试点继续保持在验收范围内。
- [x] 已新增 `components/modules/Inventory/useInventoryTransactions.ts`，将库存财务历史交易加载从 `InventoryView.tsx` 中抽离。
- [x] `InventoryView.tsx` 进一步降到约 349 行，数据加载逻辑继续向 hook 层收敛。
- [x] 已新增 `components/modules/Inventory/useInventoryCheckOutActions.ts`，将出库弹窗开关、选中出库物品和出库提交流程从 `InventoryView.tsx` 中抽离。
- [x] `InventoryView.tsx` 进一步降到约 333 行，出库状态不再复用页面级 `selectedItem`。
- [x] 已将库存调整 modal 开关和选中调整物品状态并入 `useInventoryStockActions.ts`，库存调整状态不再由 `InventoryView.tsx` 直接持有。
- [x] `InventoryView.tsx` 进一步降到约 329 行，库存试点达到阶段 3 收口条件。
- [x] `InventoryView.tsx` 阶段 3 试点完成；下一步进入 `EventsView.tsx` 拆分。
- [x] 已启动 `EventsView.tsx` 拆分，先新增 `components/modules/Events/EventsListPanel.tsx`，将 Upcoming/Completed tabs、桌面/移动列表、load more 和列表 loading/empty/error 外壳从主文件中抽离。
- [x] `EventsView.tsx` 从约 1493 行降到约 1414 行，保留 `EventDetailModal` 公开导出以兼容 `DashboardHome.tsx`。
- [x] 已新增 `components/modules/Events/useEventsListState.ts`，将活动列表 tab、分页 limit、搜索筛选、初始选中事件和选中事件关闭逻辑从 `EventsView.tsx` 中抽离。
- [x] `EventsView.tsx` 进一步降到约 1390 行，列表区域状态逻辑开始向 hook 层收敛。
- [x] 已新增 `components/modules/Events/EventsHeader.tsx`，将活动页标题和 list/calendar 视图切换按钮从 `EventsView.tsx` 中抽离。
- [x] `EventsView.tsx` 进一步降到约 1370 行，页面头部和视图切换 UI 已独立。
- [x] 已新增 `components/modules/Events/EventRegistrationFormModal.tsx`，将活动详情中的报名表 modal 和 `RegistrationFormData` 类型从 `EventsView.tsx` 中抽离，并保留原类型 re-export。
- [x] `EventsView.tsx` 进一步降到约 1293 行，详情弹窗尾部的报名表 JSX 已独立。
- [x] 已新增 `components/modules/Events/EventMarkPaidModal.tsx`，将活动详情中的付款方式选择 modal 从 `EventsView.tsx` 中抽离。
- [x] `EventsView.tsx` 进一步降到约 1288 行，详情弹窗底部操作 modal 开始独立。
- [x] 已新增 `components/modules/Events/EventCancelRegistrationConfirm.tsx`，将活动详情中的取消报名确认框从 `EventsView.tsx` 中抽离。
- [x] `EventsView.tsx` 进一步降到约 1286 行，详情弹窗底部确认弹窗已独立。
- [x] 已新增 `components/modules/Events/EventQrCheckInModal.tsx`，将活动详情中的 Check-In QR Code modal 从 `EventsView.tsx` 中抽离。
- [x] `EventsView.tsx` 进一步降到约 1284 行，详情弹窗底部 QR 包装 modal 已独立。
- [x] 已新增 `components/modules/Events/useEventRegistrationForm.ts`，将活动报名表 open/close、预填、提交状态和提交处理从 `EventDetailModal` 中抽离。
- [x] `EventsView.tsx` 进一步降到约 1271 行，活动报名表状态逻辑开始向 hook 层收敛。
- [x] 已新增 `components/modules/Events/useEventBoardRoles.ts`，将当前 Board/Commission Director 成员识别、职位缓存和职位缩写逻辑从 `EventDetailModal` 中抽离。
- [x] `EventsView.tsx` 进一步降到约 1233 行，参与者角色展示逻辑已向 hook 层收敛。
- [x] 已新增 `components/modules/Events/eventParticipantUtils.ts`，将参与者头像、姓名首字母和头像配色工具函数从 `EventDetailModal` 中抽离。
- [x] `EventsView.tsx` 进一步降到约 1223 行，参与者展示工具函数已独立。
- [x] 已新增 `components/modules/Events/useEventParticipations.ts`，将参与者报名列表、guest registrations 合并、历史 synthetic entries 补齐和加载错误上报从 `EventDetailModal` 中抽离。
- [x] `EventsView.tsx` 进一步降到约 1184 行，参与者数据加载细节已独立。
- [x] 已新增 `components/modules/Events/useEventFeedbackSummary.ts`，将活动反馈 summary 的加载、loading 状态和刷新回调从 `EventDetailModal` 中抽离。
- [x] `EventsView.tsx` 进一步降到约 1175 行，反馈 tab 数据加载逻辑已独立。
- [x] 已新增 `components/modules/Events/useFreshEvent.ts`，将活动详情打开时刷新 fresh event 副本的逻辑从 `EventDetailModal` 中抽离。
- [x] `EventsView.tsx` 进一步降到约 1167 行，容量和 attendees fresh copy 逻辑已独立。
- [x] 已新增 `components/modules/Events/useEventRegistrationStatus.ts`，将当前用户报名记录读取、乐观报名状态和取消报名权限派生从 `EventDetailModal` 中抽离。
- [x] `EventsView.tsx` 进一步降到约 1165 行，报名状态判断逻辑已独立。
- [x] 已新增 `components/modules/Events/useEventDerivedDetails.ts`，将详情页日期、时间范围、价格范围和容量百分比派生值从 `EventDetailModal` 中抽离。
- [x] `EventsView.tsx` 保持约 1165 行，但详情页派生计算已集中到独立 hook。
- [x] 已新增 `components/modules/Events/EventRegisterButton.tsx`，将活动详情报名/取消报名按钮 UI 从 `EventDetailModal` 中抽离。
- [x] `EventsView.tsx` 进一步降到约 1149 行；剩余主要体量集中在 `EventDetailModal` 的详情区和参与者列表 JSX。继续完成试点需要拆分大块 JSX 或迁移 `EventDetailModal` 公开导出，需单独确认风险边界。
- [x] 已新增 `components/modules/Events/EventParticipantsSubTabs.tsx` 和 `EventAddParticipantForm.tsx`，将参与者 tab 计数切换、QR 入口和手动添加参与者表单从 `EventDetailModal` 中抽离。
- [x] `EventsView.tsx` 进一步降到约 1090 行，参与者 tab 顶部控制区和添加表单已独立。
- [x] 已新增 `components/modules/Events/EventRoleParticipantsList.tsx`，将 Board/Commission Director 参与者列表、职位排序和对应行内操作从 `EventDetailModal` 中抽离。
- [x] 已新增 `components/modules/Events/EventRegistrationsList.tsx`，将普通参与者注册列表、角色标签、展开详情、重新报名和行内操作从 `EventDetailModal` 中抽离。
- [x] `EventsView.tsx` 进一步降到约 850 行，参与者 tab 大块 JSX 已基本独立。
- [x] 已新增 `components/modules/Events/EventDesktopInfoPanel.tsx`，将活动详情桌面右侧价格、报名、日期、地点、容量和分类信息面板从 `EventDetailModal` 中抽离。
- [x] 已新增 `components/modules/Events/EventDetailsTab.tsx`，将详情 tab 的日期/容量信息卡和 About 展示从 `EventDetailModal` 中抽离。
- [x] `EventsView.tsx` 进一步降到约 744 行，活动详情展示区已基本组件化。
- [x] 已新增 `components/modules/Events/EventParticipantsTab.tsx`，将 participants tab 的 loading、角色列表和普通注册列表分派从 `EventDetailModal` 中抽离。
- [x] `EventsView.tsx` 进一步降到约 707 行，参与者 tab 入口已成为单一组件调用。
- [x] 已新增 `components/modules/Events/EventDetailHero.tsx`，将活动详情顶部图片、关闭/分享按钮、类型标签和标题 overlay 从 `EventDetailModal` 中抽离。
- [x] `EventsView.tsx` 进一步降到约 681 行，详情弹窗主体布局继续瘦身。
- [x] 已新增 `components/modules/Events/EventMobileRegistrationFooter.tsx`，将移动端底部价格和报名按钮区域从 `EventDetailModal` 中抽离。
- [x] `EventsView.tsx` 进一步降到约 671 行，详情弹窗的移动端 footer 展示已独立。
- [x] 已新增 `components/modules/Events/EventDetailTabsNav.tsx`，将活动详情 tab id 与内部 active tab 状态映射从 `EventDetailModal` 中抽离。
- [x] 已新增 `components/modules/Events/EventDetailModal.tsx`，将活动详情弹窗整体从 `EventsView.tsx` 迁移到模块目录，并在 `EventsView.tsx` 保留 re-export 兼容既有引用。
- [x] `EventsView.tsx` 已降到约 108 行，成为活动页面列表/日历入口容器；`EventsView.tsx` 阶段 3 试点完成。
- [x] 已启动 `BusinessDirectoryView.tsx` 拆分，先新增 `components/modules/BusinessDirectory/businessDirectoryUtils.ts`，将业务分类常量和 initials SVG 头像工具函数从主文件中抽离。
- [x] `BusinessDirectoryView.tsx` 从约 1689 行降到约 1676 行，目录模块拆分试点开始建立模块目录。
- [x] 已新增 `components/modules/BusinessDirectory/useBusinessDirectoryFilters.ts`，将本地商家筛选选项、active filter count、搜索过滤、deal/国际业务/分类/ideal referral 条件和 bookmark/ideal 排序分数从 `BusinessDirectoryView.tsx` 中抽离。
- [x] `BusinessDirectoryView.tsx` 进一步降到约 1575 行，本地商家筛选派生逻辑已向 hook 层收敛。
- [x] 已新增 `components/modules/BusinessDirectory/useBusinessBookmarks.ts`，将商家收藏状态同步、乐观更新和失败回滚从 `BusinessDirectoryView.tsx` 中抽离。
- [x] `BusinessDirectoryView.tsx` 进一步降到约 1560 行，本地商家收藏 mutation 入口已独立。
- [x] 已新增 `components/modules/BusinessDirectory/useBusinessInquiry.ts`，将商家询盘表单预填、初始选中商家打开、字段校验、提交和 toast 流程从 `BusinessDirectoryView.tsx` 中抽离。
- [x] `BusinessDirectoryView.tsx` 进一步降到约 1466 行，询盘 mutation 和表单状态已向 hook 层收敛。
- [x] 已新增 `components/modules/BusinessDirectory/BusinessDirectoryHeader.tsx`，将 Business Directory 页面标题、副标题和 local/international tab 导航从主文件中抽离。
- [x] `BusinessDirectoryView.tsx` 进一步降到约 1448 行，页面头部展示已独立。
- [x] 已新增 `components/modules/BusinessDirectory/useSisterChapterFilters.ts`，将 sister chapter mock filter 的选项、选中状态和 active filter count 从 `BusinessDirectoryView.tsx` 中抽离。
- [x] `BusinessDirectoryView.tsx` 进一步降到约 1444 行，国际筛选状态开始向 hook 层收敛。
- [x] 已新增 `components/modules/BusinessDirectory/InternationalNetworkTab.tsx`，将 International Network tab 的搜索、筛选、列表、卡片和详情 modal 从 `BusinessDirectoryView.tsx` 中迁出。
- [x] `BusinessDirectoryView.tsx` 进一步降到约 992 行，国际网络 tab 已成为独立模块；下一步主要体量集中在本地商家列表、详情 modal、询盘 modal 和筛选 drawer。
- [x] 已新增 `components/modules/BusinessDirectory/BusinessInquiryModal.tsx`，将商家询盘 modal 的商家摘要、字段表单、错误显示和提交/取消按钮从 `BusinessDirectoryView.tsx` 中抽离。
- [x] `BusinessDirectoryView.tsx` 进一步降到约 804 行，询盘表单展示已独立；本地商家详情 modal 和筛选 drawer 仍是下一批拆分重点。
- [x] 已新增 `components/modules/BusinessDirectory/BusinessDetailModal.tsx`，将本地商家详情 drawer/modal 的商家摘要、标签、描述、ideal referral 和会员优惠展示从 `BusinessDirectoryView.tsx` 中抽离。
- [x] `BusinessDirectoryView.tsx` 进一步降到约 710 行，本地商家详情展示已独立；剩余最大体量集中在本地商家列表和筛选 drawer。
- [x] 已新增 `components/modules/BusinessDirectory/BusinessDirectoryFilterDrawer.tsx`，将 local/sister chapter 两套筛选抽屉 UI、筛选计数、重置和选项按钮从 `BusinessDirectoryView.tsx` 中抽离。
- [x] `BusinessDirectoryView.tsx` 进一步降到约 553 行，筛选抽屉展示已独立。
- [x] 已新增 `components/modules/BusinessDirectory/LocalBusinessTab.tsx`，将本地商家移动列表、桌面侧栏、搜索栏、推荐分隔和卡片网格从 `BusinessDirectoryView.tsx` 中抽离。
- [x] `BusinessDirectoryView.tsx` 进一步降到约 304 行，Business Directory 主文件已接近页面容器形态。
- [x] 已新增 `components/modules/BusinessDirectory/businessDirectoryMocks.ts`，将 sister chapter mock 数据从 `BusinessDirectoryView.tsx` 中抽离。
- [x] `BusinessDirectoryView.tsx` 已降到约 216 行，成为 Business Directory 页面状态编排与子模块组合容器；`BusinessDirectoryView.tsx` 阶段 3 试点完成。
- [x] 已启动 `FinanceView.tsx` 拆分，先新增 `components/modules/Finance/FinanceAlertsPanel.tsx`，将财务告警轮询、告警列表和 resolve 操作从主文件中抽离。
- [x] `FinanceView.tsx` 从约 1732 行降到约 1671 行，Finance 模块拆分试点开始建立更细的 dashboard 子组件。
- [x] 已新增 `components/modules/Finance/FinanceDashboardKpis.tsx`，将 dashboard 顶部 Total Cash、Net Balance 和 Pending Txs KPI strip 从 `FinanceView.tsx` 中抽离。
- [x] `FinanceView.tsx` 进一步降到约 1640 行，Finance dashboard 顶部指标展示已独立。
- [x] 已新增 `components/modules/Finance/FinanceRecentTransactionsCard.tsx`，将 dashboard Recent Transactions 桌面表格、移动卡片和 View All 操作从 `FinanceView.tsx` 中抽离。
- [x] `FinanceView.tsx` 进一步降到约 1578 行，Finance dashboard 最近交易卡片已独立。
- [x] 已新增 `components/modules/Finance/FinanceBankAccountsCard.tsx`，将 dashboard Bank Accounts 卡片的新增入口、移动横向账户卡和桌面账户列表从 `FinanceView.tsx` 中抽离。
- [x] `FinanceView.tsx` 进一步降到约 1520 行，Finance dashboard 账户侧栏已独立。
- [x] 已新增 `components/modules/Finance/FinanceAccountDetailDrawer.tsx`，将 Bank Account Detail Drawer 的月度表现表格、年份选择和年度汇总从 `FinanceView.tsx` 中抽离。
- [x] `FinanceView.tsx` 进一步降到约 1444 行，银行账户详情展示已独立。
- [x] 已新增 `components/modules/Finance/FinanceHeader.tsx`，将 Finance 页面标题、年份选择、Reports/Batch Import/Transaction 操作和模块 tabs 从 `FinanceView.tsx` 中抽离。
- [x] `FinanceView.tsx` 进一步降到约 1417 行，页面头部和 tab 导航已独立。
- [x] 已新增 `components/modules/Finance/FinanceBatchSelectionBar.tsx`，将 Transactions 批量选择底部操作条、进度条和批量设置/删除/清空入口从 `FinanceView.tsx` 中抽离。
- [x] `FinanceView.tsx` 进一步降到约 1370 行，交易批量操作展示条已独立。
- [x] 已新增 `components/modules/Finance/FinanceAddAdminAccountModal.tsx`，将 Add Admin Account 表单 modal 从 `FinanceView.tsx` 中抽离，父组件继续负责新增账户 ID、刷新本地列表和 toast。
- [x] `FinanceView.tsx` 进一步降到约 1350 行，行政账户新增 modal 已独立。
- [x] 已新增 `components/modules/Finance/FinanceProjectTrackerTransactionsModal.tsx`，将 Project Tracker Transactions modal 的项目预算摘要、粘贴导入区、单笔新增表单和交易表格编辑/删除入口从 `FinanceView.tsx` 中抽离。
- [x] `FinanceView.tsx` 进一步降到约 1021 行，项目交易配置 modal 已独立；Finance 试点接近 1000 行以下收口线。
- [x] 已新增 `components/modules/Finance/FinanceDeleteConfirmDialogs.tsx`，将项目交易删除确认和批量删除确认从 `FinanceView.tsx` 中抽离。
- [x] `FinanceView.tsx` 进一步降到约 1017 行，删除确认展示已独立。
- [x] 已新增 `components/modules/Finance/FinanceTransactionFormModals.tsx`，将新增交易与编辑交易 modal 外壳、footer、锁定提示和 `TransactionForm` lazy loading 从 `FinanceView.tsx` 中抽离。
- [x] `FinanceView.tsx` 进一步降到约 970 行，Finance 试点已进入 1000 行以下；下一步可继续拆 Reconciliation 区域或进一步收敛交易/项目账户状态。
- [x] 已新增 `components/modules/Finance/FinanceReconciliationTab.tsx`，将 Reconciliation tab 的 event auto-match、Payment Request 对银行交易匹配、reference number 搜索和结果展示从 `FinanceView.tsx` 中抽离。
- [x] `FinanceView.tsx` 进一步降到约 757 行，Reconciliation 展示区已独立。
- [x] 已清理 `FinanceView.tsx` 中随 Finance 子组件抽离后遗留的 lucide、Common/Form、服务、hook 与类型导入。
- [x] `FinanceView.tsx` 进一步降到约 741 行，Finance 主文件 import 层更接近页面容器。
- [x] 已新增 `components/modules/Finance/FinanceAuxiliaryModals.tsx`，将 Financial Reports、Dues Renewal、Batch Import、Transaction Split、Batch Category、Add Bank Account 和 Bank Matching 辅助弹窗组从 `FinanceView.tsx` 中抽离，并保留重型弹窗 lazy loading。
- [x] `FinanceView.tsx` 进一步降到约 658 行，Finance 主文件的底部弹窗组合已收敛到单一组件入口。
- [x] 已新增 `components/modules/Finance/FinanceDashboardTab.tsx`，将 dashboard 告警、KPI、最近交易和银行账户卡片布局从 `FinanceView.tsx` 中抽离。
- [x] `FinanceView.tsx` 进一步降到约 634 行，Dashboard tab 已成为单一展示组合组件调用。
- [x] 已新增 `components/modules/Finance/FinanceMembershipTab.tsx`，将 Membership tab 的 `DuesRenewalDashboard` lazy loading、格式化函数和编辑交易年份派生从 `FinanceView.tsx` 中抽离。
- [x] 已清理 `FinanceView.tsx` 中不再使用的 `useFinanceData` 解构字段和旧工具函数导入。
- [x] `FinanceView.tsx` 进一步降到约 606 行，Finance 主容器的剩余职责更集中在 tab 编排和弹窗状态衔接。
- [x] 已新增 `components/modules/Finance/FinanceProjectTrackerModalContainer.tsx`，将 Project Tracker Transactions modal 的选中项目条件渲染、金额校验、编辑状态衔接和删除确认入口从 `FinanceView.tsx` 中抽离。
- [x] `FinanceView.tsx` 进一步降到约 595 行，项目交易配置弹窗入口已成为容器组件。
- [x] 已新增 `components/modules/Finance/FinanceBottomOverlays.tsx`，将银行账户详情 drawer、Transactions 批量选择条、删除确认组和行政账户新增 modal 从 `FinanceView.tsx` 中抽离。
- [x] `FinanceView.tsx` 进一步降到约 569 行，底部 overlay 组合已集中到单一组件入口。
- [x] 已新增 `components/modules/Finance/FinanceTabPanels.tsx`，将 Dashboard、Membership、Administrative、Payment Requests、Reconciliation、Project Account 和 Transactions 七个 tab 的条件分派从 `FinanceView.tsx` 中抽离。
- [x] `FinanceView.tsx` 已降到约 407 行，进入阶段 3 的 300-500 行验收范围；`FinanceView.tsx` 阶段 3 试点完成。
- [x] 已启动 `DashboardHome.tsx` 拆分，先新增 `components/dashboard/dashboardHomeUtils.ts`，将会员类型归一化和 profile completeness 派生计算从主文件中抽离。
- [x] `DashboardHome.tsx` 从约 1726 行降到约 1675 行，Dashboard Home 试点开始向工具函数和展示组件分层。
- [x] 已新增 `components/dashboard/DashboardBirthdayBanner.tsx`，将 Dashboard Home 顶部生日横幅从主文件中抽离，并复用 `dashboardHomeUtils.ts` 的 DOB、姓名、initials 和头像渐变工具。
- [x] `DashboardHome.tsx` 进一步降到约 1625 行，生日横幅展示已独立；生日 drawer 仍是下一批拆分重点。
- [x] 已新增 `components/dashboard/DashboardBirthdayDrawer.tsx`，将生日月份 drawer、会员 badges、WhatsApp 状态和复制祝福交互从主文件中抽离。
- [x] `DashboardHome.tsx` 进一步降到约 1494 行，生日相关 UI 已基本移出主文件；下一批重点转向 profile completion sheet。
- [x] 已新增 `components/dashboard/DashboardProfileCompletionSheet.tsx`，将 profile completion sheet 的 tab stepper、缺失字段表单、保存 mutation 和底部操作区从主文件中抽离。
- [x] `dashboardHomeUtils.ts` 继续承接 profile completion labels、缺失项计数和保存 payload 组装。
- [x] `DashboardHome.tsx` 进一步降到约 1190 行，Dashboard Home 的生日和资料补全弹层已组件化；剩余大块集中在会员旅程、推广进度和推荐/活动展示。
- [x] 已新增 `components/dashboard/DashboardProfileCompletionWidget.tsx`，将 profile completion 入口卡片、分段进度条和 CTA 展示从主文件中抽离。
- [x] `DashboardHome.tsx` 进一步降到约 1138 行，profile completion 的入口和 sheet 均已独立。
- [x] 已新增 `components/dashboard/DashboardMembershipJourneyCard.tsx`，将 Membership Journey 入口卡片、阶段进度条和权限入口分支从主文件中抽离。
- [x] `DashboardHome.tsx` 进一步降到约 1050 行，Dashboard Home 的顶部卡片区已基本组件化；剩余最大体量集中在 Membership Journey modal 和 Events/commitments 列表区。
- [x] 已新增 `components/dashboard/DashboardEventsPanel.tsx`，将 Dashboard Home 的 Events 标题、loading/empty 状态、EventRow 列表和 View All 操作从主文件中抽离。
- [x] `DashboardHome.tsx` 进一步降到约 1016 行，Events 列表展示已独立；下一步继续处理 Partners carousel 与 Journey modal。
- [x] 已新增 `components/dashboard/DashboardPartnersCarousel.tsx`，将 Partners 标题、Swiper carousel、会员遮罩和广告曝光/点击记录从主文件中抽离。
- [x] `DashboardHome.tsx` 进一步降到约 945 行，Dashboard Home 不再直接依赖 Swiper；后续可进一步评估将 carousel 懒加载化。
- [x] 已新增 `components/dashboard/DashboardActiveCommitments.tsx`，将 active commitments 卡片、deadline 展示和 staked points 警示从主文件中抽离。
- [x] `DashboardHome.tsx` 进一步降到约 909 行，主内容区 Events 与 commitments 展示已组件化；剩余最大块为 Membership Journey modal。
- [x] 已新增 `components/dashboard/DashboardMembershipJourneyModal.tsx`，将 Membership Journey modal 的 probation、first/second year engagement、leadership/trainer pathway、group tab 和展开状态展示从主文件中抽离。
- [x] `DashboardHome.tsx` 进一步降到约 525 行，Membership Journey 入口卡片与详情 modal 均已组件化；Dashboard Home 试点接近阶段 3 收口线。
- [x] 已新增 `components/dashboard/DashboardUpgradeModal.tsx`，将 guest/member upsell 弹窗从主文件中抽离。
- [x] 已清理 `DashboardHome.tsx` 中随子组件抽离后遗留的未使用 imports、旧状态和推荐 loading setter。
- [x] `DashboardHome.tsx` 已降到约 488 行，进入阶段 3 的 300-500 行验收范围；`DashboardHome.tsx` 阶段 3 试点完成。
- [x] 已启动 `AdvertisementsView.tsx` 拆分，先新增 `components/modules/Advertisements/AdvertisementAnalyticsModal.tsx`，将广告 analytics detail modal 从主文件底部抽离。
- [x] `AdvertisementsView.tsx` 从约 1087 行降到约 951 行，analytics detail modal 已独立；下一步重点拆分 create/edit partnership modal 或 analytics tab。
- [x] 已新增 `components/modules/Advertisements/GuestPageAnalyticsSection.tsx`，将 guest page analytics 的 range、加载状态、汇总卡片和 per-page table 从主文件中抽离。
- [x] `AdvertisementsView.tsx` 进一步降到约 826 行，Guest Analytics tab 的内部数据加载已独立。
- [x] 已新增 `components/modules/Advertisements/AdvertisementAnalyticsTab.tsx`，将 analytics tab 的汇总卡片、filter pills、展开表格和局部展开状态从主文件中抽离。
- [x] `AdvertisementsView.tsx` 进一步降到约 603 行，Advertisements analytics 区域已基本组件化。
- [x] 已新增 `components/modules/Advertisements/AdvertisementFormModal.tsx`，将 create/edit partnership modal 的表单展示、图片预览、status switch、advanced 区域和 footer 从主文件中抽离。
- [x] 已清理 `AdvertisementsView.tsx` 中随表单 modal 抽离后遗留的未使用 imports 和旧 `selectedPlacements` 状态。
- [x] `AdvertisementsView.tsx` 已降到约 446 行，进入阶段 3 的 300-500 行验收范围；`AdvertisementsView.tsx` 阶段 3 试点完成。
- [x] 已启动 `PaymentRequestsView.tsx` 拆分，先新增 `components/modules/PaymentRequests/PaymentRequestPdfPreviewModal.tsx`，将 PDF preview overlay 从主文件底部抽离。
- [x] `PaymentRequestsView.tsx` 从约 1353 行降到约 1326 行，Payment Requests 试点开始收口底部 overlays。
- [x] 已新增 `components/modules/PaymentRequests/PaymentRequestRejectDialog.tsx`，将 rejection reason modal 从主文件底部抽离。
- [x] `PaymentRequestsView.tsx` 进一步降到约 1315 行，底部 overlay 组合继续向子组件收敛。
- [x] 已新增 `components/modules/PaymentRequests/paymentRequestUi.tsx`，将 Payment Request status badge 映射与渲染从主文件中抽离，供后续列表组件复用。
- [x] `PaymentRequestsView.tsx` 进一步降到约 1307 行，状态 badge UI 已独立。
- [x] 已新增 `components/modules/PaymentRequests/MyPaymentRequestsPanel.tsx`，将 My Applications tab 的 loading/error/empty、桌面表格、移动列表、展开详情和行内操作从主文件中抽离。
- [x] `PaymentRequestsView.tsx` 进一步降到约 1114 行，My Applications 展示已独立；剩余最大体量集中在 All Applications 列表和 PDF 生成函数。
- [x] `paymentRequestUi.tsx` 继续承接 `CopyButton` 共享展示逻辑，供 All Applications 银行资料复制操作复用。
- [x] `PaymentRequestsView.tsx` 进一步降到约 1087 行，列表展示辅助组件继续从主文件中移出。
- [x] 已新增 `components/modules/PaymentRequests/FinancePaymentRequestsPanel.tsx`，将 All Applications tab 的 loading/error/empty、桌面审批表格、移动审批列表、展开银行资料、分页与行内操作从主文件中抽离。
- [x] `PaymentRequestsView.tsx` 进一步降到约 844 行，两个 tab 的列表展示均已独立；剩余最大体量集中在 PDF 生成函数、数据加载与审批 mutation。
- [x] 已新增 `components/modules/PaymentRequests/paymentRequestPdf.ts`，将 PDF 生成、JCI header 绘制、claim breakdown、银行资料和附件合并逻辑从主文件中抽离。
- [x] `PaymentRequestsView.tsx` 进一步降到约 540 行，页面主文件已接近阶段 3 验收范围；剩余可通过抽离统计条或筛选栏完成收口。
- [x] 已新增 `components/modules/PaymentRequests/PaymentRequestStatsStrip.tsx` 和 `PaymentRequestSuccessBanner.tsx`，将统计 chips 与提交成功提示从主文件中抽离。
- [x] 已新增 `components/modules/PaymentRequests/PaymentRequestTabsBar.tsx`，将移动/桌面 tabs 与状态筛选控件从主文件中抽离。
- [x] `PaymentRequestsView.tsx` 已降到约 467 行，进入阶段 3 的 300-500 行验收范围；`PaymentRequestsView.tsx` 阶段 3 试点完成。
- [x] 已启动 `SocialMediaView.tsx` 拆分，先新增 `components/modules/SocialMedia/socialMediaUi.tsx`，将 social post status colors、platform icons 和日期格式化工具从主文件中抽离。
- [x] 已新增 `components/modules/SocialMedia/SocialPostCard.tsx`，将列表 post card 从 `SocialMediaView.tsx` 中抽离。
- [x] `SocialMediaView.tsx` 从约 1555 行降到约 1469 行，Social Media 试点开始收口共享展示与列表卡片。
- [x] 已新增 `components/modules/SocialMedia/SocialKanbanView.tsx`，将 Kanban columns、drag/drop 状态、drop target 提示和列内 post cards 从 `SocialMediaView.tsx` 中抽离。
- [x] `SocialMediaView.tsx` 进一步降到约 1349 行，Social Media 看板视图已独立；剩余最大体量集中在 Calendar view、CreatePostModal 和 ReviewDrawer。
- [x] 已新增 `components/modules/SocialMedia/SocialCalendarView.tsx`，将 Calendar view、月份导航、日期网格和选中日期 posts 面板从 `SocialMediaView.tsx` 中抽离。
- [x] `SocialMediaView.tsx` 进一步降到约 1167 行，Social Media 三种主视图中的 Kanban 和 Calendar 已独立；剩余最大体量集中在 CreatePostModal、ReviewDrawer 和表单/预览辅助组件。
- [x] 已新增 `components/modules/SocialMedia/socialPostFormParts.tsx`，将 reference material parse/build、Key Information 字段、只读字段和 mockup preview 从 `SocialMediaView.tsx` 中抽离。
- [x] `SocialMediaView.tsx` 进一步降到约 1046 行，CreatePostModal 与 ReviewDrawer 的共享表单/预览辅助件已独立。
- [x] 已新增 `components/modules/SocialMedia/CreatePostModal.tsx`，将 New Post modal 的 tabs、draft 表单状态、platform 选择和保存 draft 流程从 `SocialMediaView.tsx` 中抽离。
- [x] `SocialMediaView.tsx` 进一步降到约 887 行，Social Media 新建 post 流程已独立；剩余最大体量集中在 ReviewDrawer。
- [x] 已新增 `components/modules/SocialMedia/ReviewDrawer.tsx`，将 Review/Edit drawer 的 draft 编辑、AI rewrite/generate all、approve/reject/schedule/publish 操作 UI 和局部状态从 `SocialMediaView.tsx` 中抽离。
- [x] `SocialMediaView.tsx` 已降到约 299 行，进入阶段 3 的 300-500 行验收范围；`SocialMediaView.tsx` 阶段 3 试点完成。
- [x] 已启动 `ToyyibView.tsx` 拆分，先新增 `components/modules/Toyyib/toyyibUi.tsx`，将 bill status badge 和 category linked label 展示派生 helper 从主文件中抽离。
- [x] `ToyyibView.tsx` 从约 1470 行降到约 1457 行，Toyyib 试点开始建立模块目录。
- [x] 已新增 `components/modules/Toyyib/ToyyibCategoriesTab.tsx`，将 Categories tab 的移动卡片、桌面表格、inline create row、refresh/import/link/details/remove 展示从 `ToyyibView.tsx` 中抽离。
- [x] `ToyyibView.tsx` 进一步降到约 1233 行，Toyyib category 管理展示已独立；下一步重点拆分 Bills tab 和 Settings/Test Payment 面板。
- [x] 已新增 `components/modules/Toyyib/ToyyibBillsTab.tsx`，将 Bills tab 的统计条、Manual Bill 折叠表单、状态筛选 chips、移动 bills cards 和桌面 bills table 从 `ToyyibView.tsx` 中抽离。
- [x] `ToyyibView.tsx` 进一步降到约 963 行，Toyyib bills 展示和手动 bill 创建入口已独立；下一步重点拆分 Settings/Test Payment 面板和底部 category/link/import modals。
- [x] 已新增 `components/modules/Toyyib/ToyyibCategoryModals.tsx`，将 Import Existing Category、Category Details 和 Link Category 三个底部弹窗从 `ToyyibView.tsx` 中抽离。
- [x] `ToyyibView.tsx` 进一步降到约 885 行，Toyyib category 相关弹窗展示已独立；剩余主要体量集中在 Settings/Test Payment 面板。
- [x] 已新增 `components/modules/Toyyib/ToyyibSettingsPanel.tsx`，将 Settings、Webhook Setup 和 Test Payment 面板从 `ToyyibView.tsx` 中整体抽离，父组件继续保留 Toyyib 模式、测试会员和确认弹窗状态编排。
- [x] `ToyyibView.tsx` 已降到约 380 行，进入阶段 3 的 300-500 行验收范围；`ToyyibView.tsx` 阶段 3 试点完成。
- [x] 已启动 `ProjectsView.tsx` 拆分，先新增 `components/modules/Projects/ProjectsTemplatesTab.tsx`，将 Templates tab 的搜索筛选、移动/桌面模板列表和模板行内操作从 `ProjectsView.tsx` 中抽离。
- [x] `ProjectsView.tsx` 从约 1141 行降到约 1032 行，Projects 试点开始收口重复模板列表展示。
- [x] 已新增 `components/modules/Projects/ProjectsBatchActions.tsx`，将浮动批量操作条和 Batch Update Status modal 从 `ProjectsView.tsx` 中抽离。
- [x] `ProjectsView.tsx` 进一步降到约 961 行，批量操作展示已独立；下一步重点拆分新建活动 drawer 或模板编辑 modal。
- [x] 已新增 `components/modules/Projects/ProjectsCreateDrawer.tsx`，将新建活动两步 drawer、Roadmap Sync 字段、媒体预览、分类和日程字段从 `ProjectsView.tsx` 中抽离。
- [x] `ProjectsView.tsx` 进一步降到约 850 行，新建活动表单展示已独立；下一步拆分模板编辑 modal 和页面列表外壳。
- [x] 已新增 `components/modules/Projects/ProjectsTemplateModal.tsx`，将 Create/Edit Event Template modal 表单从 `ProjectsView.tsx` 中抽离。
- [x] `ProjectsView.tsx` 进一步降到约 827 行，模板列表和模板编辑弹窗均已独立；下一步拆分项目详情顶部状态操作区和页面列表外壳。
- [x] 已新增 `components/modules/Projects/ProjectsDetailHeader.tsx`，将项目详情返回链接、标题和桌面/移动状态工作流按钮从 `ProjectsView.tsx` 中抽离。
- [x] `ProjectsView.tsx` 进一步降到约 749 行，项目详情顶部状态操作区已独立；下一步重点拆分项目列表页外壳。
- [x] 已新增 `components/modules/Projects/ProjectsListShell.tsx`，将移动/桌面 tabs、年份筛选、Projects/Templates 内容分派和列表错误边界从 `ProjectsView.tsx` 中抽离。
- [x] `ProjectsView.tsx` 进一步降到约 631 行，列表页外壳已独立；下一步重点抽离新建项目表单状态与提交逻辑。
- [x] 已新增 `components/modules/Projects/useProjectCreateForm.ts`，将新建活动 drawer 的打开/关闭、step 流转、Roadmap 同步、字段状态和 create submit payload 从 `ProjectsView.tsx` 中抽离。
- [x] `ProjectsView.tsx` 已降到约 438 行，进入阶段 3 的 300-500 行验收范围；`ProjectsView.tsx` 阶段 3 试点完成。

### 推荐顺序

1. `InventoryView.tsx`
2. `EventsView.tsx`
3. `BusinessDirectoryView.tsx`
4. `FinanceView.tsx`
5. `DashboardHome.tsx`
6. `AdvertisementsView.tsx`
7. `PaymentRequestsView.tsx`
8. `SocialMediaView.tsx`
9. `ToyyibView.tsx`
10. `ProjectsView.tsx`

### 每个模块的拆分模板

- [ ] `useXxxData.ts`
  - 数据加载、派生数据、筛选、分页、mutation。
  - `useInventoryItemForm.ts` 已先行抽离库存物品表单提交与 variants 局部状态。
  - `useInventoryStockActions.ts` 已先行抽离库存流水加载与库存调整 mutation。
  - `useInventoryMaintenanceActions.ts` 已先行抽离维护日程新增/编辑 mutation 与弹窗状态。
  - `useInventoryTransactions.ts` 已先行抽离库存财务历史交易加载。
  - `useInventoryCheckOutActions.ts` 已先行抽离出库 mutation 与弹窗状态。
  - `useInventoryStockActions.ts` 已进一步接管库存调整 modal 状态。
  - `useEventsListState.ts` 已先行抽离活动列表筛选、分页 limit 和选中事件状态。
  - `useEventRegistrationForm.ts` 已先行抽离活动报名表状态和提交处理。
  - `useEventBoardRoles.ts` 已先行抽离活动参与者 Board/Commission Director 角色识别与职位缩写。
  - `useEventParticipations.ts` 已先行抽离活动参与者数据加载、guest registrations 合并和 synthetic entries 补齐。
  - `useEventFeedbackSummary.ts` 已先行抽离活动反馈 summary 加载和刷新状态。
  - `useFreshEvent.ts` 已先行抽离活动详情 fresh event 副本刷新。
  - `useEventRegistrationStatus.ts` 已先行抽离当前用户报名状态读取和派生状态。
  - `useEventDerivedDetails.ts` 已先行抽离活动详情日期、时间、价格和容量派生值。
  - `businessDirectoryUtils.ts` 已先行抽离 Business Directory 的业务分类常量和 initials SVG 工具。
  - `businessDirectoryMocks.ts` 已先行抽离 Business Directory sister chapter mock 数据。
  - `useBusinessDirectoryFilters.ts` 已先行抽离 Business Directory 本地商家筛选与排序派生逻辑。
  - `useBusinessBookmarks.ts` 已先行抽离 Business Directory 商家收藏状态和乐观更新逻辑。
  - `useBusinessInquiry.ts` 已先行抽离 Business Directory 商家询盘表单状态和提交逻辑。
  - `useSisterChapterFilters.ts` 已先行抽离 Business Directory sister chapter 筛选状态和计数。
  - `useProjectCreateForm.ts` 已先行抽离 Projects 新建活动 drawer 的字段状态、Roadmap 同步和提交逻辑。
- [ ] `XxxToolbar.tsx`
  - 搜索、筛选、导入导出、主操作。
  - `EventsHeader.tsx` 已先行抽离活动页标题和 list/calendar 视图切换操作区。
  - `BusinessDirectoryHeader.tsx` 已先行抽离 Business Directory 页面标题和 tab 导航。
  - `FinanceHeader.tsx` 已先行抽离 Finance 页面标题、年份选择、主操作和 tab 导航。
  - `FinanceBatchSelectionBar.tsx` 已先行抽离 Finance 交易批量选择底部操作条。
  - `PaymentRequestTabsBar.tsx` 已先行抽离 Payment Requests tabs 与状态筛选控件。
  - `CreatePostModal.tsx` 已先行抽离 Social Media New Post modal 的 tabbed draft 表单。
- [ ] `XxxList.tsx` 或 `XxxGrid.tsx`
  - 列表和卡片展示。
  - `InventoryItemsTab.tsx` 已先行抽离库存 items tab 的列表/卡片展示。
  - `InventoryMaintenanceTab.tsx` 已先行抽离维护日程列表与维护操作展示。
  - `InventoryAlertsTab.tsx` 已先行抽离库存告警 KPI 与列表展示。
  - `InventoryFinancialHistoryTab.tsx` 已先行抽离库存财务交易摘要、列表与移动卡片展示。
  - `InventoryDepreciationTab.tsx` 已先行抽离折旧 KPI、桌面表格与移动卡片展示。
  - `EventsListPanel.tsx` 已先行抽离活动列表页的 tabs、列表网格和 load more 展示。
  - `InternationalNetworkTab.tsx` 已先行抽离 Business Directory 国际网络 tab 的列表、筛选和详情展示。
  - `LocalBusinessTab.tsx` 已先行抽离 Business Directory 本地商家移动列表、桌面侧栏和卡片网格。
  - `FinanceRecentTransactionsCard.tsx` 已先行抽离 Finance dashboard 最近交易列表。
  - `FinanceBankAccountsCard.tsx` 已先行抽离 Finance dashboard 银行账户列表卡片。
  - `FinanceReconciliationTab.tsx` 已先行抽离 Finance Reconciliation tab 的匹配与搜索结果列表。
  - `FinanceDashboardTab.tsx` 已先行抽离 Finance dashboard 的告警、KPI、最近交易和账户卡片组合布局。
  - `FinanceMembershipTab.tsx` 已先行抽离 Finance Membership tab 的会费续期 dashboard 包装与编辑入口衔接。
  - `FinanceTabPanels.tsx` 已先行抽离 Finance 主内容 tab 分派层。
  - `GuestPageAnalyticsSection.tsx` 已先行抽离 Advertisements guest page analytics section。
  - `AdvertisementAnalyticsTab.tsx` 已先行抽离 Advertisements analytics tab 展示与局部展开状态。
  - `dashboardHomeUtils.ts` 已先行抽离 Dashboard Home 的会员类型归一化和 profile completeness 派生计算。
  - `dashboardHomeUtils.ts` 继续承接 Dashboard Home 生日 DOB、姓名、initials 和头像渐变工具。
  - `dashboardHomeUtils.ts` 继续承接 Dashboard Home profile completion labels、缺失项计数和保存 payload 组装。
  - `DashboardEventsPanel.tsx` 已先行抽离 Dashboard Home Events 列表面板。
  - `DashboardPartnersCarousel.tsx` 已先行抽离 Dashboard Home Partners carousel。
  - `DashboardActiveCommitments.tsx` 已先行抽离 Dashboard Home active commitments 列表卡片。
  - `MyPaymentRequestsPanel.tsx` 已先行抽离 Payment Requests My Applications 列表。
  - `FinancePaymentRequestsPanel.tsx` 已先行抽离 Payment Requests All Applications 列表。
  - `SocialPostCard.tsx` 已先行抽离 Social Media 列表 post card。
  - `SocialKanbanView.tsx` 已先行抽离 Social Media Kanban 列表视图。
  - `SocialCalendarView.tsx` 已先行抽离 Social Media Calendar 列表视图。
  - `ToyyibCategoriesTab.tsx` 已先行抽离 Toyyib Categories tab 的移动卡片、桌面表格和 inline create row。
  - `ToyyibBillsTab.tsx` 已先行抽离 Toyyib Bills tab 的统计、筛选和列表/表格展示。
  - `ToyyibCategoryModals.tsx` 已先行抽离 Toyyib category import、details 和 link 弹窗展示。
  - `ToyyibSettingsPanel.tsx` 已先行抽离 Toyyib Settings、Webhook Setup 和 Test Payment 面板展示。
  - `ProjectsTemplatesTab.tsx` 已先行抽离 Projects Templates tab 的搜索筛选、移动/桌面模板列表和模板操作。
  - `ProjectsBatchActions.tsx` 已先行抽离 Projects 浮动批量操作条和批量状态更新 modal。
  - `ProjectsCreateDrawer.tsx` 已先行抽离 Projects 新建活动 drawer 的 stepper、媒体同步字段和分类/日程表单展示。
  - `ProjectsTemplateModal.tsx` 已先行抽离 Projects Create/Edit Event Template modal 表单展示。
  - `ProjectsDetailHeader.tsx` 已先行抽离 Projects 详情页标题和状态工作流操作区。
  - `ProjectsListShell.tsx` 已先行抽离 Projects 列表页移动/桌面 tabs、年份筛选和内容分派外壳。
- [x] 模块内纯展示组件
  - `socialPostFormParts.tsx` 已先行抽离 Social Media 表单字段、只读字段、mockup preview 和 reference material 工具。
  - `InventoryStatsStrip.tsx` 已先行抽离库存 KPI 展示。
  - `eventParticipantUtils.ts` 已先行抽离活动参与者头像、姓名首字母和配色工具函数。
  - `EventRegisterButton.tsx` 已先行抽离活动详情报名/取消报名按钮。
  - `EventDesktopInfoPanel.tsx` 已先行抽离活动详情桌面侧栏信息展示。
  - `EventDetailsTab.tsx` 已先行抽离活动详情 tab 信息和描述展示。
  - `EventParticipantsTab.tsx` 已先行抽离活动详情 participants tab 的展示分派。
  - `EventDetailHero.tsx` 已先行抽离活动详情顶部 hero 展示。
  - `EventMobileRegistrationFooter.tsx` 已先行抽离活动详情移动端报名 footer。
  - `EventDetailTabsNav.tsx` 已先行抽离活动详情 tab 导航映射。
  - `FinanceAlertsPanel.tsx` 已先行抽离 Finance dashboard 财务告警面板。
  - `FinanceDashboardKpis.tsx` 已先行抽离 Finance dashboard 顶部 KPI strip。
  - `FinanceBankAccountsCard.tsx` 已先行抽离 Finance dashboard 银行账户卡片展示。
  - `DashboardBirthdayBanner.tsx` 已先行抽离 Dashboard Home 顶部生日横幅。
  - `DashboardProfileCompletionWidget.tsx` 已先行抽离 Dashboard Home profile completion 入口卡片。
  - `DashboardMembershipJourneyCard.tsx` 已先行抽离 Dashboard Home Membership Journey 入口卡片。
  - `paymentRequestUi.tsx` 已先行抽离 Payment Requests status badge 展示。
  - `paymentRequestUi.tsx` 继续承接 Payment Requests copy button 展示。
  - `PaymentRequestStatsStrip.tsx` 已先行抽离 Payment Requests 统计 chips。
  - `PaymentRequestSuccessBanner.tsx` 已先行抽离 Payment Requests 提交成功提示。
  - `socialMediaUi.tsx` 已先行抽离 Social Media status colors、platform icons 和日期格式化展示工具。
  - `toyyibUi.tsx` 已先行抽离 Toyyib bill status badge 和 category linked label 展示派生 helper。
- [ ] `XxxDetailDrawer.tsx`
  - 详情抽屉或详情面板。
  - `EventDetailModal.tsx` 已先行从 `EventsView.tsx` 中拆出，保持公开导出兼容。
  - `BusinessDetailModal.tsx` 已先行抽离 Business Directory 本地商家详情 drawer/modal。
  - `FinanceAccountDetailDrawer.tsx` 已先行抽离 Finance 银行账户详情 drawer。
  - `DashboardBirthdayDrawer.tsx` 已先行抽离 Dashboard Home 生日月份 drawer。
  - `ReviewDrawer.tsx` 已先行抽离 Social Media review/edit drawer 的内容编辑、AI 生成和审批操作。
- [ ] `XxxModals.tsx`
  - 新增、编辑、删除确认、批量操作等弹窗。
  - `InventoryStockCardModal.tsx` 已先行抽离库存流水历史弹窗。
  - `InventoryStockAdjustmentModal.tsx` 已先行抽离库存调整弹窗表单。
  - `InventoryCheckOutModal.tsx` 已先行抽离出库分配弹窗表单。
  - `InventoryMaintenanceScheduleModal.tsx` 已先行抽离维护日程新增/编辑弹窗表单。
  - `InventoryItemModal.tsx` 已先行抽离库存物品新增/编辑 modal 外壳。
  - `EventRegistrationFormModal.tsx` 已先行抽离活动报名表 modal。
  - `EventMarkPaidModal.tsx` 已先行抽离活动付款方式选择 modal。
  - `EventCancelRegistrationConfirm.tsx` 已先行抽离活动取消报名确认框。
  - `EventQrCheckInModal.tsx` 已先行抽离活动 Check-In QR Code modal。
  - `EventAddParticipantForm.tsx` 已先行抽离活动手动添加参与者表单。
  - `BusinessInquiryModal.tsx` 已先行抽离 Business Directory 商家询盘 modal。
  - `FinanceAddAdminAccountModal.tsx` 已先行抽离 Finance 行政账户新增 modal。
  - `FinanceProjectTrackerTransactionsModal.tsx` 已先行抽离 Finance 项目交易配置 modal。
  - `FinanceProjectTrackerModalContainer.tsx` 已先行抽离 Finance 项目交易配置 modal 的容器衔接和金额校验。
  - `FinanceDeleteConfirmDialogs.tsx` 已先行抽离 Finance 删除确认弹窗组。
  - `FinanceTransactionFormModals.tsx` 已先行抽离 Finance 新增/编辑交易 modal。
  - `FinanceAuxiliaryModals.tsx` 已先行抽离 Finance 报表、会费续期、导入、拆分、批量分类、新增账户和银行匹配辅助弹窗组。
  - `FinanceBottomOverlays.tsx` 已先行抽离 Finance 底部详情 drawer、批量条、确认框和行政账户新增 modal 组合。
  - `DashboardProfileCompletionSheet.tsx` 已先行抽离 Dashboard Home profile completion sheet。
  - `DashboardMembershipJourneyModal.tsx` 已先行抽离 Dashboard Home Membership Journey modal。
  - `DashboardUpgradeModal.tsx` 已先行抽离 Dashboard Home guest/member upsell modal。
  - `AdvertisementAnalyticsModal.tsx` 已先行抽离 Advertisements analytics detail modal。
  - `AdvertisementFormModal.tsx` 已先行抽离 Advertisements create/edit partnership modal。
  - `PaymentRequestPdfPreviewModal.tsx` 已先行抽离 Payment Requests PDF preview modal。
  - `PaymentRequestRejectDialog.tsx` 已先行抽离 Payment Requests rejection reason modal。
- [ ] `XxxFilterDrawer.tsx`
  - 移动端或跨端筛选抽屉。
  - `BusinessDirectoryFilterDrawer.tsx` 已先行抽离 Business Directory local/sister chapter 筛选抽屉。
  - `EventRoleParticipantsList.tsx` 已先行抽离活动 Board/Commission Director 参与者列表。
  - `EventRegistrationsList.tsx` 已先行抽离活动普通注册列表。
- [x] `XxxFormFields.tsx`
  - 新增/编辑共用表单字段、局部 form section 和重复 options。
  - `InventoryItemFormFields.tsx` 已先行抽离库存物品新增/编辑共用字段。
- [x] `types.ts` / 模块配置
  - 模块内部 UI 类型，避免把临时视图类型塞进全局 `types`。
  - 已在 `Inventory/inventoryViewConfig.ts` 中先行抽出 `InventoryTabId` 和 `INVENTORY_TAB_ITEMS`。

### 验收标准

- [x] 原模块入口文件控制在 300-500 行以内。
- [x] 数据加载逻辑和 JSX 展示逻辑分离。
- [x] 子组件 props 明确，不透传大量无关状态。
- [x] 每次只迁移一个模块，迁移后构建通过。

## 阶段 4：表格、列表与虚拟化沉淀

目标：统一数据展示体验，并把已有的虚拟列表能力沉淀到通用层。

### 任务

- [ ] 增强 `components/ui/DataTable.tsx`
  - column 支持 `accessor`，减少 `any` 索引。
  - 支持 `emptyState` ReactNode。
  - 支持 row actions、bulk selection、sticky header。
  - 支持外部排序和分页状态，方便服务端分页。
- [ ] 新增 `components/ui/VirtualizedTable.tsx` 或扩展 `DataTable`
  - 基于 `@tanstack/react-virtual`。
  - 优先复用 `Members/MemberTable.tsx` 和 `Finance/TransactionsTab.tsx` 的成熟实现经验。
- [ ] 将 1-2 个重复表格迁移到统一组件。

### 验收标准

- [ ] 大数据列表滚动无明显卡顿。
- [ ] 空状态、加载状态、分页样式统一。
- [ ] 表格键盘可访问性不退化。

## 阶段 5：表单组件与交互基础设施整理

目标：让表单控件更容易维护，并减少隐藏副作用。

### 任务

- [ ] 拆分 `components/ui/Form.tsx`
  - `Input.tsx`
  - `Select.tsx`
  - `Textarea.tsx`
  - `Checkbox.tsx`
  - `RadioGroup.tsx`
  - `useDropdownPosition.ts`
- [ ] 将 email 输入过滤提取为 `EmailInput` 或 `normalizeEmailInput`。
- [ ] 避免直接修改 `e.target.value` 的受控输入模式。
- [ ] 为 `Select` 明确 ARIA role、键盘导航和 portal 行为。
- [ ] 为复杂表单建立 `FormSection`、`FieldGrid`、`FormActions`。

### 验收标准

- [ ] 登录、注册、会员编辑、活动报名等关键表单行为不变。
- [ ] 输入法组合输入、粘贴、键盘导航正常。
- [ ] 表单组件拆分后可独立阅读和复用。

## 阶段 6：全局样式收敛

目标：减少全局 CSS 对所有元素的隐性影响。

### 任务

- [ ] 将 `index.css` 中全局 `* { user-select: none; }` 改为按需 class。
- [ ] 保留输入框、文本域、正文内容的文本选择能力。
- [ ] 将全局 `*` transition 改为显式工具类，例如 `interactive-transition`。
- [ ] 检查 `styles/accessibility.css` 是否被正确引入，修复乱码注释时保持 UTF-8。
- [ ] 建立常用设计 token：
  - spacing
  - radius
  - shadows
  - focus ring
  - status colors

### 验收标准

- [ ] 文本内容可正常选择复制。
- [ ] 页面切换和滚动无异常动画。
- [ ] 按钮、菜单、卡片仍保留必要交互反馈。
- [ ] 无障碍焦点样式清晰可见。

## 阶段 7：性能与质量验证

目标：把优化效果变成可观察、可回归验证的结果。

### 任务

- [ ] 建立前端重构检查清单。
- [ ] 为关键页面记录基准：
  - 首次加载 bundle 大小。
  - 进入 Members、Finance、Events 的交互耗时。
  - 大列表滚动体感。
- [ ] 保留并扩展 `PerfMonitor` 的使用范围。
- [ ] 对核心模块增加 smoke test 或轻量组件测试。
- [ ] 每个阶段完成后记录变更摘要和风险。

### 验收标准

- [ ] `npm run build` 稳定通过。
- [ ] 核心导航和权限路径手工验证通过。
- [ ] 大型模块拆分后没有明显新增渲染卡顿。

## 建议执行节奏

### 第 1 周

- 完成阶段 1：`App.tsx` 瘦身。
- 输出第一个 PR，重点验证导航、权限和刷新恢复。

### 第 2 周

- 完成阶段 2：页面骨架组件。
- 选择一个低风险模块作为试点。

### 第 3-4 周

- 完成阶段 3 的前两个模块：`InventoryView`、`EventsView`。
- 每个模块独立 PR。

### 第 5 周

- 完成阶段 4：表格能力沉淀。
- 迁移 1-2 个高重复表格。

### 第 6 周

- 完成阶段 5 和阶段 6 的低风险部分。
- 聚焦表单拆分和全局 CSS 收敛。

## 风险与缓解

| 风险 | 影响 | 缓解方式 |
| --- | --- | --- |
| 权限逻辑迁移出错 | 用户看到不该访问的模块，或被错误拦截 | 先把现有条件复制到配置，不同时改业务规则 |
| 大模块拆分引入状态不同步 | 弹窗、筛选、详情面板行为异常 | 每次只拆一个局部状态组，保留原有 props 流 |
| 通用组件过度抽象 | 后续使用反而更复杂 | 只从 2-3 个真实重复场景中提取 |
| 全局 CSS 调整影响视觉 | 页面动画或点击区域变化 | 先新增 class，再逐步替换，最后移除全局规则 |
| 构建产物或自动生成文件混入 PR | diff 难审查 | 每次提交前检查 `git status --short` |

## 每次任务完成定义

- [ ] 代码通过 TypeScript/Vite 构建。
- [ ] 改动范围有清晰边界。
- [ ] 相关页面完成手工 smoke test。
- [ ] 没有回滚或覆盖无关用户改动。
- [ ] 文档或任务清单同步更新。

## 首个推荐任务

从阶段 1 开始，先实现 `viewRegistry.tsx` 和 `navigationConfig.tsx`。这是收益最高、风险相对可控的入口重构，能立刻降低 `App.tsx` 的阅读成本，并为后续模块拆分提供清晰边界。
