# JCI KL 当前系统架构

生成时间：2026-08-24。来源：对当前代码库进行只读扫描。

## 范围

本文描述当前代码库的实际实现状态，而不只是早期 BMAD 规划文档。该项目是一个棕地系统：JCI Kuala Lumpur 管理应用，包含 React/Vite 前端、Firebase/Firestore 数据层、Netlify Functions、Firebase Cloud Functions、Capacitor 移动端壳，以及 BMAD 流程资料。

## 技术栈

- 前端：React 19、TypeScript、Vite 6、Tailwind CSS、lucide-react、React Router、React Query。
- 数据与认证：Firebase Auth、Firestore、Firebase Storage、Firestore Security Rules。
- 服务端执行：`netlify/functions/` 下的 Netlify Functions，以及 `functions/src/` 下的 Firebase Cloud Functions。
- 移动端壳：`android/` 与 `capacitor.config.ts`。
- 测试：Vitest，部分测试使用 fast-check 做属性测试。
- 流程与文档：`_bmad/`、`_bmad-output/`、`docs/`。

## 仓库结构

- `App.tsx`：主应用壳，负责导航状态、懒加载模块注册、访客/登录布局切换、角色模拟 UI。
- `index.tsx`：React 挂载入口、Provider 组合、全局错误处理、Service Worker 注册。
- `components/`：功能视图、UI 组件、布局、访客页面、Dashboard、管理员工具。
- `hooks/`：React 侧数据与状态 hooks，大多包装 service 或 Firestore 集合流程。
- `services/`：应用服务层。多数业务模块直接从浏览器访问 Firestore，部分调用 Netlify Functions 处理特权操作或第三方 API。
- `types/`：共享 TypeScript 领域类型与视图 key。
- `utils/`：权限、日期、财务、board membership、验证、dev mode 等通用工具。
- `config/`：Firebase 配置、常量、国籍、集合名。
- `netlify/functions/`：Zoom、ToyyibPay、Cloudinary、Auth 管理、Lark 同步、社媒 AI 改写、邮件、邀请、推送测试、审计日志、生日通知等 HTTP 函数。
- `functions/src/`：会员、财务、自动化、游戏化、通知等 Firebase Cloud Functions。
- `firestore.rules`、`firestore.indexes.json`、`storage.rules`：Firebase 安全和索引边界。
- `scripts/`：迁移、Lark、Firebase 权限种子/审计脚本。
- `tests/`：工具和属性测试。

只读扫描估算文件量：`components` 194、`services` 69、`hooks` 39、`utils` 18、`types` 15、`netlify/functions` 23、`functions/src` 7、`tests` 8、`scripts` 15。

## 运行入口

### 浏览器应用

`index.tsx` 挂载 React 应用，并组合：

- `HelmetProvider`
- `QueryClientProvider`
- `ToastProvider`
- `AuthProvider`
- `App`

同时通过 `errorLoggingService` 注册全局 `error` 与 `unhandledrejection` 处理，并注册 `/firebase-messaging-sw.js`。

### 应用壳

`App.tsx` 是当前最核心的导航与布局壳。它将 `ViewType` 保存到 `localStorage` 的 `jc_last_view`，并在访客路由与登录后 workspace 模块之间切换。懒加载模块包括：

- Dashboard、Board Dashboard、Members
- Events、Projects、Flagship Projects、Activity Plans
- Finance、Payment Requests、ToyyibPay
- Inventory、Sponsorships、Publications、Advertisements
- Communication、Surveys、Social Media、Zoom Booking
- Automation Studio、Workflow Designer、System/Config/Developer 工具

访客路由包括 `/`、`/events`、`/projects`、`/about`、`/enewsletters`、`/partnerships`。

### Serverless Functions

当前有两套服务端执行模型：

- Netlify Functions：浏览器调用的特权 HTTP 操作和第三方集成。
- Firebase Cloud Functions：Firebase 原生函数、触发器和后台流程。

这点对维护很重要：以后新增功能前必须先决定该能力归属哪个运行时。

## 数据与领域模型

集合名集中在 `config/constants.ts` 的 `COLLECTIONS`。当前业务域包括：

- 会员身份与资料：`members`、`memberEmails`、`promotionHistory`、`manualPromotionRequests`、`mentorMatches`。
- 活动与参与：`events`、`eventRegistrations`、`eventBudgets`、`eventFeedback`。
- 财务：`transactions`、`projectTrx`、`bankAccounts`、`paymentRequests`、`reconciliations`、`transactionSplits`、`finance_alerts`、`counters`。
- 项目：`projects`、`tasks`、`projectReports`、`activityPlans`、`flagship_projects`。
- 参与度/游戏化：`points`、`pointsRules`、`badges`、`achievements`、`incentivePrograms`、`loStarProgress`。
- 自动化：`automationRules`、`workflows`、`workflow_executions`、`webhooks`、`webhook_logs`。
- 内容/公开页面：`communication`、`documents`、`publications`、`advertisements`、`partnerships`、`guestPageStats`。
- 集成：`zoomBookings`、`toyyibBills`、`toyyibpay_webhooks`、Lark 相关脚本与配置。

系统目前主要是单 LO，`DEFAULT_LO_ID = 'jcikl'`，但注释和规则中已有未来多 LO 的设计意图。

## 权限模型

当前授权分为三层：

1. `hooks/usePermissions.ts` 中的 UI 权限。
2. `utils/rolePermissions.ts` 中的静态角色基线。
3. `firestore.rules` 中的最终数据访问控制。

角色包括 `GUEST`、`MEMBER`、`BOARD`、`ADMIN`、`SUPER_ADMIN`、`INACTIVE`。动态 board 权限依赖当前 board member 字段；开发模式和角色模拟可在本地放大权限。

重要区别：UI 权限和 Firestore Rules 在部分语义上是刻意不同的。Firestore 的 `isBoard()` 把 admin 作为 board 访问的超集；UI 的 board elevation 则排除 admin，因为 admin 已通过静态权限获得完整权限。

## 主要操作流程

### 认证

`useAuth.tsx` 负责 Firebase Auth 状态、member 文档加载、Google 登录、邮箱密码登录、自助注册、密码重置、资料更新、dev mode 登录、角色模拟和会员 impersonation。系统要求 Auth 用户必须有或能链接到 `members/{uid}` 文档后，才进入登录后的应用。

### 会员管理

`MembersService` 是会员资料主要服务。它处理会员读写、资料同步、membership type 计算、email dedup 模式、board 字段同步、promotion/dues 逻辑，以及关联清理。

### 财务与支付

财务能力分布在 `financeService`、`paymentRequestService`、`toyyibService`、`reconciliationService`、`projectFinancialService`、ToyyibPay Netlify endpoints 和 ToyyibPay callback handler。部分关键操作已使用 transaction 或 batch 处理幂等与回滚。

### 自动化与 Workflow

当前至少存在两套重叠实现：`automationService.ts` 与 `workflowService.ts`，再加上 `functions/src/automation.ts`。它们都包含 workflow execution、idempotency、step execution、webhook-like action 等概念。

### 外部集成

- Zoom：`zoomBookingService.ts`、`zoom-create-meeting`、`zoom-cancel-meeting`、`zoom-webhook`。
- ToyyibPay：`toyyibService.ts`、`toyyibpay-api`、`toyyibpay-callback`。
- Cloudinary：`cloudinaryService.ts`、`cloudinary-delete`。
- Lark：`larkSyncService.ts`、`lark-sync`、`scripts/lark/`。
- 邮件/邀请：`emailService.ts`、`send-email`、`send-invite`、`auto-invite`。
- 社媒 AI 改写：`socialPostService.ts`、`social-ai-rewrite`。

## 测试与质量门槛

可用脚本：

- `npm run build`
- `npm run test`
- `npm run dev`
- `npm run dev:netlify`

现有测试主要集中在 `tests/property/` 和少数 `utils/` 测试。相对项目规模，UI 流程、Firestore Rules、Netlify Functions、端到端流程的覆盖仍偏少。

## 当前架构约束

- 服务层很宽，并且多数在浏览器端直接访问 Firestore，因此 Firestore Rules 是真正安全边界。
- `App.tsx` 仍是大型编排文件，导航和权限变更影响面较大。
- 同时存在两套服务端运行时，部分领域逻辑在客户端 service 与 server function 中重复。
- 多个文件存在中文乱码/编码损坏。
- 既有 BMAD 架构文档有历史价值，但应作为意图和背景，不应直接视为当前实现真相。

