# CODEBASE_ANALYSIS.md — JCI KL Member Portal

_更新于：2026-07-11（P0–P2 重构后版本）_

---

## 执行摘要

JCI KL 门户是一个功能完整的生产级 React 19 SPA，覆盖会员、活动、财务、游戏化等 20+ 业务模块，已完成 P0–P2 代码库重组（types 拆分、Common.tsx 拆分、基础 Hook 抽取、TanStack Query 接入）。整体架构清晰，Service → Hook → Component 三层分离良好，但仍存在三个核心改进空间：

1. **测试覆盖率极低**：8 个属性测试文件中，核心计算逻辑（如 `calculateAchievementProgress`）在测试文件内本地重定义，而非从 Service 导入——测试与生产代码可以悄无声息地漂移，这是最高优先级的质量风险。
2. **双轨 Board Membership 一致性隐患**：`member.isCurrentBoardMember` 字段与 `boardMembers` 子集合并行存在，两者可能不同步，影响权限计算的可靠性。
3. **Firebase 环境变量无硬失败**：`config/firebase.ts` 在环境变量缺失时静默回退到硬编码值，生产故障难以发现；应在缺失时抛出明确错误。

---

## 一、项目全景

### 1.1 目录结构（重构后）

```
项目根目录/
├── App.tsx                    # SPA 路由 + 全局 Hook 初始化（~4500 行）
├── index.tsx                  # React DOM Root + Provider 树（QueryClient + ToastProvider + AuthProvider）
├── types.ts                   # 3 行 barrel re-export → types/ 目录
│
├── types/                     # ✅ 新增（P0 重构）— 按域拆分的类型文件
│   ├── index.ts               # 统一 re-export
│   ├── common.ts              # UserRole, MemberTier, SystemRole, RadarStats, DashboardStats
│   ├── member.ts              # Member, MembershipType, BoardMember, PromotionProgress 等
│   ├── gamification.ts        # AwardDefinition, Badge, PointsRule, IncentiveProgram 等
│   ├── project.ts             # Project, Task, GanttTask, ProjectFinancialAccount 等
│   ├── event.ts               # Event, EventRegistration, CalendarEvent, EventBudget 等
│   ├── finance.ts             # Transaction, BankAccount, PaymentRequest, ReconciliationRecord 等
│   ├── automation.ts          # Workflow, WorkflowNode, Rule, RuleExecution 等
│   ├── governance.ts          # Election, Proposal, Survey, Vote 等
│   └── misc.ts                # InventoryItem, HobbyClub, Partnership, DataImport/Export 等
│
├── components/
│   ├── ui/                    # ✅ 重构后的 UI 原语层
│   │   ├── Common.tsx         # 10 行 barrel re-export（向后兼容）
│   │   ├── Toast.tsx          # ToastContext + useToast + ToastProvider
│   │   ├── Button.tsx         # Button（6 变体）
│   │   ├── Card.tsx           # Card + StatCard + StatCardsContainer
│   │   ├── Badge.tsx          # Badge + ProgressBar + AvatarGroup + Skeleton
│   │   ├── Tabs.tsx           # Tabs（underline/button 两种风格）
│   │   ├── Modal.tsx          # Modal（Portal + Escape + body scroll lock）
│   │   ├── Drawer.tsx         # Drawer（left/right/bottom）
│   │   ├── Form.tsx           # Input + Select + Textarea + Checkbox + RadioGroup
│   │   ├── Combobox.tsx       # 可搜索下拉（199 个国籍等大列表）
│   │   ├── DataTable.tsx      # 分页+列过滤表格
│   │   ├── Pagination.tsx     # 分页控件
│   │   ├── MultiSelectDropdown.tsx
│   │   ├── MemberSelector.tsx
│   │   ├── IntroducerSelector.tsx
│   │   ├── LedgerTable.tsx
│   │   ├── Loading.tsx
│   │   ├── Responsive.tsx
│   │   ├── NudgeBanner.tsx
│   │   ├── MembersOnlyOverlay.tsx
│   │   ├── FirstUseBanner.tsx
│   │   ├── ColumnFilterHeader.tsx
│   │   ├── ErrorBoundary.tsx
│   │   └── AsyncErrorBoundary.tsx
│   │
│   ├── modules/               # 功能页面（全部 React.lazy 懒加载）
│   │   ├── Finance/           # 子目录：10 个财务子组件
│   │   ├── Members/           # 子目录：5 个会员子组件/工具
│   │   ├── AutomationStudio/  # 子目录：6 个自动化工作流组件
│   │   ├── PaymentRequests/   # 子目录：付款申请子组件
│   │   ├── Incentive/         # 子目录：激励计划子组件
│   │   ├── Common/            # 子目录：模块间共享组件
│   │   ├── Projects/          # 子目录
│   │   └── *.tsx              # 30+ 顶层模块视图文件
│   │
│   ├── shared/                # 跨模块共享但带业务逻辑的组件
│   │   ├── MembershipTypeDisplay.tsx
│   │   └── batchImport/       # 批量导入基础设施（Finance + Members 共用）
│   │       ├── BatchImportModal.tsx
│   │       ├── batchImportTypes.ts
│   │       ├── batchImportUtils.ts
│   │       ├── validators.ts
│   │       └── stringMatching.ts
│   │
│   ├── auth/                  # LoginModal, RegisterModal
│   ├── dashboard/             # BoardDashboard, DashboardHome（懒加载）
│   ├── admin/                 # RadarDataImporter（懒加载）
│   ├── dev/                   # RoleSimulator（懒加载）
│   ├── accessibility/         # axe-core 扫描组件
│   └── performance/           # 性能监控组件
│
├── hooks/                     # 20 个业务 Hook + 1 个基础 Hook
│   ├── useFirestoreCollection.ts  # ✅ 新增（P1）— 基础 Hook
│   ├── useAuth.tsx            # Firebase Auth 会话（唯一 Context 源）
│   ├── usePermissions.ts      # RBAC 权限计算（静态查找表 + 动态 Board 提升）
│   ├── useMembers.ts          # ✅ 已迁移使用 useFirestoreCollection
│   └── use*.ts                # 19 个域 Hook（useEvents, usePoints, useGamification 等）
│
├── services/                  # 61 个 Service 文件（业务逻辑 + Firestore 查询）
├── contexts/                  # BatchModeContext, HelpModalContext
├── config/
│   ├── constants.ts           # 60+ Firestore 集合名 + 所有业务常量
│   ├── firebase.ts            # Firebase SDK 初始化（⚠️ env var 无硬失败）
│   └── nationalities.ts       # 199 个国籍选项
├── utils/                     # 8 个工具模块
├── functions/src/             # Firebase Cloud Functions（7 个文件）
├── netlify/functions/         # Netlify 无服务器函数（6 个文件）
├── tests/property/            # 8 个属性测试文件（fast-check + Vitest）
└── scripts/                   # 一次性迁移脚本
```

### 1.2 技术栈

| 层次 | 技术 | 版本 |
|---|---|---|
| UI 框架 | React + TypeScript (strict) | 19.2 / 5.8 |
| 构建 | Vite + vite-plugin-pwa | 6.2 |
| 样式 | Tailwind CSS + 自定义 `jci-blue` token | 3.4 |
| 路由 | React Router | v7 |
| 数据获取 | 自定义 Hook（正迁移至 TanStack Query） | — |
| 状态管理 | React Context（Auth + Batch + HelpModal）| — |
| 后端 | Firebase（Firestore + Auth + Storage + FCM）| 10.x |
| 实时更新 | Firestore `onSnapshot`（选择性使用）| — |
| 支付 | ToyyibPay（马来西亚本地）| — |
| 图片/文件 | Cloudinary + browser-image-compression | — |
| 导出 | jsPDF、pdf-lib、PapaParse、xlsx | — |
| 图表 | Recharts | 3.x |
| 日历 | react-big-calendar | — |
| 动画 | Framer Motion | 12.x |
| 拖拽 | @dnd-kit | — |
| 移动端 | Capacitor (iOS/Android 壳) | 8.x |
| 测试 | Vitest + fast-check（属性测试）| — |
| 部署 | Netlify（主）+ Firebase Hosting（副）| — |
| AI | Gemini API（via `GEMINI_API_KEY`）| — |

### 1.3 架构模式

**分层组件化 SPA（类 MVC）**

```
Firestore ←→ Service（静态类）← isDevMode() 短路 → MOCK_DATA
     ↓
CacheService（TTL 内存缓存，3–5 min）
     ↓
useFirestoreCollection（✅ 新基础 Hook）
     ↓
useXxx Hook（loading/error/data/mutations）
     ↓
Component（UI 渲染 + 用户交互）
     ↓
AsyncErrorBoundary（✅ 新增）+ Suspense（懒加载）
```

**双后端架构：**
```
客户端 → Netlify Functions（CORS 代理、邮件、推送）
       → Firebase Cloud Functions（自动化触发、游戏化、通知）
       → Firestore（主数据库，48+ 集合）
```

---

## 二、功能组件清单

### 2.1 UI 原语层（`components/ui/`）— 已重构

| 组件名称 | 文件路径 | 功能描述 | 复用性 | 依赖项 | 备注 |
|---|---|---|---|---|---|
| Button | `ui/Button.tsx` | 6 变体 + Loading 态 | ★★★★★ | Tailwind | 完全通用 |
| Card | `ui/Card.tsx` | 容器卡片（title/action/description slots）| ★★★★★ | Tailwind | 完全通用 |
| StatCard | `ui/Card.tsx` | KPI 数据卡（值/趋势/图标）| ★★★★☆ | Card | 依赖 Card |
| Badge | `ui/Badge.tsx` | 8 种语义变体标签 | ★★★★★ | Tailwind | 完全通用 |
| ProgressBar | `ui/Badge.tsx` | 带标签的进度条 | ★★★★★ | Tailwind | 完全通用 |
| Skeleton | `ui/Badge.tsx` | 加载占位动画 | ★★★★★ | Tailwind | 完全通用 |
| Tabs | `ui/Tabs.tsx` | 可滚动 Tab（underline/button）| ★★★★☆ | Tailwind, lucide | 通用 |
| Modal | `ui/Modal.tsx` | Portal 弹窗（8 尺寸 + 移动端 drawer）| ★★★★☆ | React Portal | 通用 |
| Drawer | `ui/Drawer.tsx` | 三方向侧边栏 | ★★★★☆ | React Portal | 通用 |
| Toast/useToast | `ui/Toast.tsx` | 全局消息（singleton 防 HMR 重复）| ★★★★★ | React Context | 独特的 `window.__JCI_TOAST_CONTEXT__` 保护 |
| Input | `ui/Form.tsx` | 带 label/error/icon/密码切换 | ★★★★★ | Tailwind | 完全通用 |
| Select | `ui/Form.tsx` | `options[]` 驱动下拉 | ★★★★★ | Tailwind | 完全通用 |
| Combobox | `ui/Combobox.tsx` | 可搜索下拉（适合 100+ 选项）| ★★★★☆ | Tailwind | 通用 |
| MultiSelectDropdown | `ui/MultiSelectDropdown.tsx` | 多选下拉 | ★★★★☆ | Tailwind | 通用 |
| DataTable | `ui/DataTable.tsx` | 分页+列过滤表格 | ★★★☆☆ | Pagination, ColumnFilterHeader | 需解耦业务字段 |
| ErrorBoundary | `ui/ErrorBoundary.tsx` | 类组件错误边界 | ★★★★★ | React | 可直接复用 |
| AsyncErrorBoundary | `ui/AsyncErrorBoundary.tsx` | 异步错误边界 | ★★★★★ | React | ✅ 已包裹所有模块 |
| MemberSelector | `ui/MemberSelector.tsx` | 会员搜索选择器 | ★★☆☆☆ | MembersService | 高度业务耦合 |

### 2.2 数据 Hook 层（`hooks/`）

| Hook | 文件 | 功能 | 复用性 | 特殊说明 |
|---|---|---|---|---|
| **useFirestoreCollection** | `hooks/useFirestoreCollection.ts` | 通用数据加载基础 Hook | ★★★★★ | ✅ 新增；已被 useMembers 使用 |
| useAuth | `hooks/useAuth.tsx` | Firebase Auth 会话 + Member 对象 | ★★☆☆☆ | 核心依赖，JCI 专属 |
| usePermissions | `hooks/usePermissions.ts` | RBAC 权限 + 开发者模拟 | ★★☆☆☆ | 静态查找表 + 动态 Board 提升 |
| useMembers | `hooks/useMembers.ts` | 会员 CRUD + 批量操作 | ★★★☆☆ | ✅ 已迁移使用基础 Hook |
| useEvents | `hooks/useEvents.ts` | 活动 CRUD + 报名/签到 | ★★★☆☆ | `publicMode` 路径静默失败；`markAttendance` 不 re-throw |
| useGamification | `hooks/useGamification.ts` | 奖项 + Firestore `onSnapshot` | ★★☆☆☆ | 混合模式：一次性 fetch + 实时订阅 |
| usePoints | `hooks/usePoints.ts` | 积分历史 + 排行榜 | ★★☆☆☆ | 仅 MEMBER+ 角色可访问 |
| useProjects | `hooks/useProjects.ts` | 项目 CRUD | ★★★☆☆ | 模式通用 |
| useCommunication | `hooks/useCommunication.ts` | 消息/公告 | ★★★☆☆ | 模式通用 |

### 2.3 Service 层（`services/`，61 个文件）

| 类别 | 代表文件 | 职责 | 复用性 | 特殊说明 |
|---|---|---|---|---|
| 基础设施 | `cacheService.ts` | TTL 内存缓存（含 localStorage 选项）| ★★★★☆ | 最具复用价值 |
| 基础设施 | `errorLoggingService.ts` | 双轨日志（console + Firestore）| ★★★★☆ | dynamic import 避免循环依赖 |
| 基础设施 | `cloudinaryService.ts` | 图片上传/变换 | ★★★★☆ | 通用 |
| 核心 CRUD | `membersService.ts` | 会员读写 + 缓存 + dev mock | ★★☆☆☆ | 模式通用，数据专属 |
| 核心 CRUD | `eventsService.ts` | 活动读写 | ★★☆☆☆ | 同上 |
| 财务 | `financeService.ts` | 交易读写（dev mock 用 localStorage）| ★★☆☆☆ | localStorage mock 与其他 Service 不一致 |
| 财务 | `reconciliationService.ts` | 银行对账逻辑 | ★★☆☆☆ | 复杂业务逻辑 |
| 游戏化 | `pointsService.ts` | 积分授予（支持新旧两种调用签名）| ★★☆☆☆ | 重载签名复杂 |
| 游戏化 | `gamificationService.ts` | 奖项 CRUD（依赖 PointsService）| ★★☆☆☆ | 服务间耦合 |
| 自动化 | `automationService.ts` | 工作流 CRUD | ★★☆☆☆ | 依赖 PointsService + CommunicationService |
| AI/分析 | `aiPredictionService.ts` | 流失预测 | ★★★☆☆ | Gemini API 集成 |
| 支付 | `toyyibService.ts` | ToyyibPay 集成 | ★★☆☆☆ | 马来西亚专属 |

### 2.4 模块视图层（`components/modules/`）

| 模块 | 主文件 | 子目录 | 复杂度 | 说明 |
|---|---|---|---|---|
| Finance | `FinanceView.tsx` | `Finance/`（10 个子组件）| ★★★★★ | 使用 `useTransition`；内部再次懒加载子组件 |
| Members | `MembersView.tsx` | `Members/`（5 个）| ★★★★☆ | 批量导入 + 重复检测 + IC 回填工具 |
| AutomationStudio | `AutomationStudio.tsx` | `AutomationStudio/`（6 个）| ★★★★☆ | 可视化工作流设计器 |
| Events | `EventsView.tsx` | — | ★★★★☆ | 最完整的 CRUD 模块 |
| Gamification | `GamificationView.tsx` | — | ★★★★☆ | 奖项/积分/排行榜 |
| Projects | `ProjectsView.tsx` | `Projects/`、`ProjectManagement/` | ★★★★☆ | 包含 Gantt 图 |

### 2.5 共享基础设施（`components/shared/`）

| 组件/模块 | 路径 | 功能 | 复用场景 |
|---|---|---|---|
| BatchImportModal | `shared/batchImport/BatchImportModal.tsx` | 通用批量导入弹窗 | Finance + Members 共用 |
| batchImportTypes | `shared/batchImport/batchImportTypes.ts` | `FieldDefinition`（含 aliases/validators/preprocessor）| 所有批量导入功能 |
| stringMatching | `shared/batchImport/stringMatching.ts` | 模糊列头匹配 | 批量导入列映射 |
| MembershipTypeDisplay | `shared/MembershipTypeDisplay.tsx` | 会员类型计算展示 | 多处会员信息展示 |

---

## 三、编程习惯与模式分析

### 3.1 命名规范 ✓ 优秀

| 类型 | 规范 | 例子 |
|---|---|---|
| 文件 | PascalCase（组件）、camelCase（其他）| `MembersView.tsx`、`useMembers.ts`、`membersService.ts` |
| 枚举值 | SCREAMING_SNAKE_CASE | `UserRole.SUPER_ADMIN`、`COLLECTIONS.MEMBERS` |
| Hook 返回接口 | `UseXxxResult` | `UseMembersResult` |
| 常量 | UPPER_SNAKE | `DEFAULT_LO_ID`、`POINT_CATEGORIES` |
| Service 类 | `XxxService` | `MembersService`、`FinanceService` |
| 三层对应关系 | `useXxx` ↔ `XxxService` ↔ `XxxView` | 完全一致，可预测 |

**可改进之处：**
- `pointsService.ts` 的 `awardPoints` 方法使用重载签名，参数顺序因兼容性混乱
- `financeService.ts` 中 `localMockTransactions` 与其他 Service 的 `MOCK_XXX` 常量命名不一致
- `boardMembership.ts` 中同时维护 `isCurrentBoardMember` 标志位和 `boardMembers` 集合，两路径命名无法体现这个二元性

### 3.2 代码组织方式

**趋势：先大文件，后按需拆分**
- 原 `types.ts`（2143 行）→ 9 个域文件（已完成）
- 原 `Common.tsx`（688 行，9 个组件）→ 7 个独立文件（已完成）
- `App.tsx` 仍约 4500 行——包含路由、导航、全局 Hook、通知逻辑等，是当前最大的未拆分文件
- 复杂模块自发建立子目录（`Finance/`、`AutomationStudio/`）
- `FinanceView.tsx` 内部对自己的子组件再次使用 `lazy()` 懒加载——两层懒加载是成熟的大型模块实践

### 3.3 状态管理偏好

```
层级       工具                        说明
─────────  ──────────────────────────  ─────────────────────────────
全局        AuthContext                 Firebase Auth 会话，单例
UI-only     BatchModeContext            批量操作模式开关，轻量
UI-only     HelpModalContext            帮助弹窗，轻量
模块级      useXxx Hook（useState）     每模块独立，无跨模块共享
服务层      CacheService（内存 TTL）    替代数据共享，避免重复 fetch
```

- **无 Redux / Zustand**，完全 React 原生
- mutation 后调用 `loadXxx()` 重新拉取（正确但无乐观更新）
- TanStack Query 已安装但尚未有 Hook 迁移使用它

### 3.4 错误处理模式

**标准模式（useFirestoreCollection 后统一）：**
```typescript
try {
  setLoading(true); setError(null);
  setData(await loader());
} catch (err) {
  const msg = err instanceof Error ? err.message : 'Failed to load data';
  setError(msg); showToast(msg, 'error'); throw err;
} finally { setLoading(false); }
```

**已知不一致点：**

| 位置 | 问题 | 影响 |
|---|---|---|
| `useEvents.markAttendance` | 不 re-throw（有注释说明原因）| 调用方无法感知失败 |
| `useEvents` publicMode 路径 | 用 `console.warn` 而非 `showToast` | 用户无反馈 |
| `financeService` dev mock | 用 localStorage 持久化 mock，其他 Service 不这样 | 行为不一致 |
| `config/firebase.ts` | env var 缺失时静默回退硬编码值 | 生产故障难发现 |

**优秀实践：**
- `errorLoggingService` 用 dynamic import 避免与 firebase 的循环依赖
- Firestore `permission-denied` 在 `deleteMember` 中有专门的用户友好提示
- 全局 `window.error` + `unhandledrejection` 监听（`index.tsx`）

### 3.5 异步处理方式

- **100% async/await**，无 Promise chain
- fire-and-forget 用 `.catch(() => {})` 显式静默
- Firestore 批量写用 `writeBatch`（非串行 await）
- `useTransition`（React 18）用于 FinanceView 的非阻塞状态更新
- `useGamification` 是唯一使用 `onSnapshot` 实时订阅的 Hook（其他都是一次性 fetch）

### 3.6 常用技术组合（技术指纹）

```
核心链路：Firestore ← isDevMode() 短路 → MOCK_DATA
                ↓
         CacheService.set(key, data, ttl)
                ↓
         useFirestoreCollection({ loader, enabled, deps })
                ↓
         useXxx Hook（CRUD mutations）
                ↓
         showToast() + 重新 loadXxx()
```

```
写入链路：removeUndefined(data) → Firestore.updateDoc/addDoc
```

```
Batch Import：stringMatching（列头模糊匹配）
           → validators（字段校验）
           → BatchImportModal（进度 UI）
           → Service.batchCreate()
```

### 3.7 注释与文档习惯

- **稀疏但精准**：只在"非显而易见"处写注释
- `@deprecated` JSDoc 标签用于向后兼容字段（`Member` 接口的 flat 字段）
- 边界情况会加单行注释（`useEvents` 的不 re-throw 有原因说明）
- 一次性脚本和测试中有少量说明性注释
- `MEMBER_IMPORT_GUIDE.md` 存在于 `Members/` 子目录，说明有维护内部文档的意识

### 3.8 重复代码模式（已识别）

| 模式 | 出现频率 | 状态 |
|---|---|---|
| Hook 的 loading/error/useState 骨架 | 20 次 | ✅ 已抽取 `useFirestoreCollection` |
| Service 的 `isDevMode()` 分支 | 61 次 | 🔴 仍重复，可抽取 `withDevMode(loader, mockData)` 工具 |
| Firestore 写入前 `removeUndefined()` | 多处 | 🟡 已有工具函数，但需检查覆盖率 |
| `err instanceof Error ? err.message : '...'` | 20+ 次 | 🟡 基础 Hook 已统一，mutation 中仍重复 |
| `serverTimestamp()` + `removeUndefined()` 组合 | 多处 | 🔴 可抽取 `prepareFirestoreUpdate(data)` |

---

## 四、组件化改造建议

### 4.1 优先级一：`withDevMode` 工厂函数（消除 61 次重复）

```typescript
// utils/devMode.ts 新增
export function withDevMode<T>(
  mockFn: () => T | Promise<T>,
  realFn: () => Promise<T>
): Promise<T> {
  if (isDevMode()) return Promise.resolve(mockFn());
  return realFn();
}

// Service 使用示例
static async getAllMembers() {
  return withDevMode(
    () => MOCK_MEMBERS,
    async () => {
      const snap = await getDocs(collection(db, COLLECTIONS.MEMBERS));
      return snap.docs.map(d => ({ id: d.id, ...d.data() }) as Member);
    }
  );
}
```

### 4.2 优先级二：`prepareFirestoreUpdate` 工具函数

```typescript
// utils/dataUtils.ts 新增
export const prepareFirestoreUpdate = (data: Record<string, any>) =>
  removeUndefined({ ...data, updatedAt: serverTimestamp() });

export const prepareFirestoreCreate = (data: Record<string, any>) =>
  removeUndefined({ ...data, createdAt: serverTimestamp(), updatedAt: serverTimestamp() });
```

### 4.3 优先级三：拆分 `App.tsx`（~4500 行）

建议提取：

```
components/layout/
├── AppShell.tsx          # 侧边栏 + 主内容区 Layout
├── TopNav.tsx            # 顶部搜索栏 + 通知铃 + 角色切换
├── Sidebar.tsx           # 左侧导航菜单
├── NotificationDrawer.tsx # 通知侧边栏
└── MobileBottomNav.tsx   # 移动端底部导航
```

### 4.4 优先级四：统一 TanStack Query 迁移路径

按模块风险从低到高迁移：

```
第 1 批（最安全）：useGamification — 已有 onSnapshot，useQuery + queryClient.invalidateQueries 直接替换
第 2 批：usePoints, useHobbyClubs, useInventory — 无副作用依赖
第 3 批：useEvents, useProjects — 有跨 Hook 数据依赖
第 4 批（最复杂）：useMembers — 有批量操作和权限守卫
```

### 4.5 优先级五：修复 firebase.ts 的静默回退

```typescript
// config/firebase.ts — 替换
const apiKey = import.meta.env.VITE_FIREBASE_API_KEY;
if (!apiKey) throw new Error('[firebase] VITE_FIREBASE_API_KEY is not set');
```

### 4.6 建议最终目录结构

```
components/
├── ui/              # 完全无业务逻辑的通用原语（已完成拆分）
├── shared/          # 有少量业务知识但跨模块复用
├── layout/          # ✨ 新增 — 从 App.tsx 拆出的布局组件
└── modules/         # 功能页面（模块 + 子目录）

types/               # ✅ 已完成域拆分
hooks/               # useFirestoreCollection + 20 个域 Hook
services/            # 61 个 Service（建议按域分子目录）
utils/               # 工具函数（建议新增 withDevMode + prepareFirestoreUpdate）
```

---

## 五、个人技能体系化

### 5.1 擅长领域（代码证据支撑）

| 技术领域 | 证据 |
|---|---|
| **Firestore 数据建模** | 48+ 集合、复杂嵌套 Member 文档、writeBatch、compound queries、34KB security rules、composite indexes |
| **React 状态管理（原生）** | 20 个自定义 Hook，AuthContext，`useTransition`，HMR-safe singleton Toast |
| **权限/RBAC 系统** | 静态查找表 + 动态 Board 提升 + Simulation 模式的多维权限计算 |
| **大型模块代码拆分** | 两层懒加载（App 级 + FinanceView 内部），vite manualChunks 6 个 vendor 包 |
| **批量数据处理** | 通用 batchImport 基础设施（模糊列头匹配 + 字段验证 + 进度 UI）|
| **Malaysia 本地化** | ToyyibPay 支付集成、MYR 格式化、马来西亚身份证工具 |
| **双后端架构** | Firebase Cloud Functions + Netlify Functions 协同，职责合理分工 |
| **PWA + 移动端** | Service Worker + FCM 推送 + Capacitor iOS/Android 壳 |
| **属性测试（Property-Based Testing）** | fast-check + Vitest，8 个测试文件覆盖核心业务规则 |

### 5.2 解决问题的思路模式

1. **先定义 TypeScript 类型，再写 Service，最后写 UI**——`types/` 的中心地位和完整性证明了这一点
2. **先建立 Mock 层实现离线开发**——所有 Service 的 `isDevMode()` 短路是第一步，不是后加的
3. **遇到复杂功能就新建 Service 文件**，而非扩展现有（61 个 Service 是习惯，不是偶然）
4. **共享逻辑抽到 `shared/` 而非 copy-paste**——`batchImport/` 基础设施被 Finance 和 Members 共用
5. **测试用属性测试而非手写 case**——体现了对边界条件的系统性思维

### 5.3 技术盲点与可提升方向

| 盲点 | 现象 | 严重程度 |
|---|---|---|
| **测试与生产代码脱节** | `calculateAchievementProgress` 在测试文件里本地定义，与 Service 逻辑可以无声漂移 | 🔴 高 |
| **Board Membership 双轨一致性** | `member.isCurrentBoardMember` 与 `boardMembers` 集合两路并行，可能不同步 | 🔴 高 |
| **App.tsx 超大文件** | ~4500 行，路由 + 布局 + 导航 + 通知全混在一起 | 🟡 中 |
| **TanStack Query 未落地** | 已安装配置但无任何 Hook 迁移，仍是"半成品"状态 | 🟡 中 |
| **Service 层测试缺失** | 61 个 Service 承载所有业务逻辑，几乎无集成测试 | 🟡 中 |
| **乐观更新缺失** | mutation 后全量 reload，高频操作（签到、积分）有明显延迟 | 🟡 中 |
| **firebase.ts 静默回退** | env var 缺失不报错，生产故障难排查 | 🟡 中 |
| **列表无虚拟化** | 大会员列表全量渲染 | 🟢 低（暂时）|

### 5.4 下一步学习建议

| 建议 | 原因 | 具体行动 |
|---|---|---|
| **修复测试与生产漂移** | 当前属性测试测的是本地定义的函数，不是生产代码 | 将 `calculateAchievementProgress` 等纯函数从 Service 中提取到 `utils/`，测试文件直接 import |
| **TanStack Query 实战迁移** | 已有配置，迁移第一个 Hook（建议 `useGamification`）以验证模式 | 从 `useQuery` + `queryClient.invalidateQueries` 开始，对比现有 Hook 行为 |
| **Firebase Emulator Suite** | 替代 `isDevMode()` mock，获得更接近生产的本地开发体验 | 配置 `firebase.json` 的 emulator，让 `isDevMode()` 指向 emulator 而非 mock 数据 |
| **Zod 运行时校验** | Firestore 数据 schema 漂移时，当前无任何运行时保护 | 在 Service 层对 Firestore read 的数据做 `z.parse()`，将错误在边界拦截 |
| **App.tsx 拆分** | 4500 行已超过单文件合理上限，影响 IDE 性能和 Code Review 质量 | 提取 `AppShell`、`Sidebar`、`TopNav`、`NotificationDrawer` 到 `components/layout/` |

---

## 六、改进路线图（更新后）

| 优先级 | 改进项 | 主要收益 | 难度 | 状态 |
|---|---|---|---|---|
| ✅ P0 | 拆分 `types.ts` | IDE 性能、可维护性 | 低 | **已完成** |
| ✅ P0 | 拆分 `Common.tsx` | 可读性、按需 import | 低 | **已完成** |
| ✅ P1 | 抽取 `useFirestoreCollection` | 消除 Hook 样板 | 中 | **已完成** |
| ✅ P1 | 添加 `AsyncErrorBoundary` | 稳健性 | 低 | **已完成** |
| ✅ P2 | 安装 TanStack Query | 为性能升级铺路 | 低 | **已完成（配置）** |
| 🔴 **最高** | 修复测试与生产代码漂移 | 测试真实可信 | 中 | 待办 |
| 🔴 **最高** | 修复 Board Membership 双轨 | 权限一致性 | 中 | 待办 |
| 🟡 P1 | `withDevMode` 工厂函数 | 消除 61 处重复 | 低 | 待办 |
| 🟡 P1 | `prepareFirestoreUpdate` 工具函数 | 写入一致性 | 低 | 待办 |
| 🟡 P1 | 修复 `firebase.ts` 静默回退 | 生产故障可见性 | 低 | 待办 |
| 🟡 P1 | TanStack Query 迁移第一个 Hook | 验证迁移模式 | 中 | 待办 |
| 🟡 P2 | 拆分 `App.tsx` | 可维护性 | 高 | 待办 |
| 🟢 P3 | Service 层集成测试 | 回归安全 | 高 | 待办 |
| 🟢 P3 | 乐观更新（高频操作）| 用户体验 | 高 | 待办 |
| 🟢 P3 | 列表虚拟化 | 大数据集性能 | 中 | 待办 |
