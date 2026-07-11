# CODEBASE_ANALYSIS.md — JCI KL Member Portal

_更新于：2026-07-11（全量重构第二轮完成后版本）_

---

## 执行摘要

JCI KL 门户是一个功能完整的生产级 React 19 SPA，覆盖会员、活动、财务、游戏化等 20+ 业务模块。经过两轮共 11 项代码重构，架构质量显著提升：types 按域拆分、UI 原语独立成文件、布局组件提取、测试与生产代码对齐、TanStack Query 落地。

**三个最重要的剩余改进点：**

1. **`withDevMode` 工厂函数仍未落地**：已创建但 62 个 Service 中 46 个仍使用旧的 `if (isDevMode()) return MOCK_X` 内联模式——这是消除最多重复代码的单一最高性价比改进。
2. **MembersView / ProjectsView / FinanceView 超大文件**：三个主模块文件分别达 5571、5335、4679 行，已成为代码审查和 IDE 性能的主要瓶颈，需要按页面/功能块进一步拆分。
3. **21 个 Hook 未迁移 `useFirestoreCollection`**：只有 `useMembers` 完成迁移，其余 21 个 Hook 仍手写 loading/error/useState 样板代码，是下一批重构的明确目标。

---

## 一、项目全景

### 1.1 目录结构（当前状态）

```
项目根目录/
├── App.tsx                    # SPA 路由 + 全局 Hook + 主导航（4,366 行，仍是最大文件）
├── index.tsx                  # React DOM Root（QueryClientProvider + ToastProvider + AuthProvider）
├── types.ts                   # 3 行 barrel re-export → types/ 目录
│
├── types/                     # ✅ 按域拆分的类型文件（11 个文件）
│   ├── index.ts               # 统一 re-export
│   ├── common.ts              # UserRole, MemberTier, SystemRole, RadarStats, Notification
│   ├── views.ts               # ViewType 联合类型（✅ 新增，从 App.tsx 提取）
│   ├── member.ts              # Member + 所有子类型
│   ├── gamification.ts        # AwardDefinition, Badge, PointsRule, IncentiveProgram 等
│   ├── project.ts             # Project, FlagshipProject, GanttTask 等
│   ├── event.ts               # Event, EventRegistration, EventBudget 等
│   ├── finance.ts             # Transaction, BankAccount, PaymentRequest 等
│   ├── automation.ts          # Workflow, AutomationRule, WorkflowNode 等
│   ├── governance.ts          # Election, Survey, Vote 等
│   └── misc.ts                # InventoryItem, HobbyClub, Document 等
│
├── utils/                     # 10 个工具文件（✅ 新增 3 个）
│   ├── devMode.ts             # isDevMode + withDevMode（✅ 新增 withDevMode）
│   ├── boardMembership.ts     # isMemberCurrentBoard（✅ 已简化，单一来源）
│   ├── gamificationUtils.ts   # calculateAwardProgress 纯函数（✅ 新增）
│   ├── rolePermissions.ts     # ROLE_PERMISSIONS + Permission 接口（✅ 新增）
│   ├── dataUtils.ts           # removeUndefined（递归清理 Firestore 写入数据）
│   ├── dateUtils.ts           # 日期格式化工具（12 个导出）
│   ├── formatUtils.ts         # 货币/数字/文本格式化（7 个导出）
│   ├── malaysianIdUtils.ts    # MyKad IC 号码解析（4 个导出）
│   ├── authStorage.ts         # localStorage 认证状态持久化
│   └── administrativeProjectsStorage.ts # 行政项目 ID 持久化
│
├── components/
│   ├── ui/                    # UI 原语层（✅ 已拆分为独立文件）
│   │   ├── Common.tsx         # 10 行 barrel re-export（向后兼容入口）
│   │   ├── Toast.tsx          # ToastContext + useToast（singleton 保护）
│   │   ├── Button.tsx         # Button（6 变体）
│   │   ├── Card.tsx           # Card + StatCard + StatCardsContainer
│   │   ├── Badge.tsx          # Badge + ProgressBar + AvatarGroup + Skeleton
│   │   ├── Tabs.tsx           # Tabs（underline/button 两种风格）
│   │   ├── Modal.tsx          # Modal（Portal + Escape + body scroll lock）
│   │   ├── Drawer.tsx         # Drawer（left/right/bottom）
│   │   ├── Form.tsx           # Input + Select + Textarea + Checkbox + RadioGroup
│   │   ├── Combobox.tsx       # 可搜索下拉（适合大列表）
│   │   ├── DataTable.tsx      # 分页 + 列过滤表格
│   │   ├── Pagination.tsx     # 分页控件
│   │   ├── ErrorBoundary.tsx  # 类组件错误边界
│   │   └── AsyncErrorBoundary.tsx # ✅ 已包裹所有懒加载模块
│   │
│   ├── layout/                # ✅ 新增（从 App.tsx 提取的布局组件）
│   │   ├── GuestHeader.tsx    # 公开页面导航栏（含移动端汉堡菜单）
│   │   ├── GuestFooter.tsx    # 静态页脚
│   │   ├── SidebarItem.tsx    # 侧边栏导航按钮（支持折叠图标模式）
│   │   ├── NotificationDrawer.tsx # 通知抽屉（移动端底部浮层 + 桌面端右侧）
│   │   ├── SearchDropdown.tsx # 全局搜索下拉（跨 4 个 Hook 搜索）
│   │   └── GuestAnalyticsTracker.tsx # 访客页面浏览埋点
│   │
│   ├── modules/               # 30+ 功能页面（全部 React.lazy 懒加载）
│   │   ├── Finance/           # 子目录：10 个财务子组件
│   │   ├── Members/           # 子目录：5 个会员子组件
│   │   ├── AutomationStudio/  # 子目录：6 个自动化工作流组件
│   │   ├── MembersView.tsx    # ⚠️ 5,571 行（最大模块文件）
│   │   ├── ProjectsView.tsx   # ⚠️ 5,335 行
│   │   ├── FinanceView.tsx    # ⚠️ 4,679 行
│   │   └── *.tsx              # 25+ 其他模块视图
│   │
│   ├── shared/                # 跨模块共享业务组件
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
│   └── admin/                 # RadarDataImporter（懒加载）
│
├── hooks/                     # 22 个 Hook
│   ├── useFirestoreCollection.ts  # ✅ 通用基础 Hook
│   ├── useMembers.ts          # ✅ 已迁移使用基础 Hook
│   └── use*.ts                # 20 个域 Hook（仍使用旧手写模式）
│
├── services/                  # 62 个 Service 文件
├── contexts/                  # BatchModeContext, HelpModalContext
├── config/
│   ├── constants.ts           # 60+ Firestore 集合名 + 业务常量
│   ├── firebase.ts            # ✅ 生产环境 env var 缺失时 throw 错误
│   └── nationalities.ts       # 199 个国籍选项
├── functions/src/             # Firebase Cloud Functions（7 个文件）
├── netlify/functions/         # Netlify 无服务器函数（6 个文件）
└── tests/property/            # 8 个属性测试文件（fast-check + Vitest）
```

### 1.2 技术栈

| 层次 | 技术 | 版本 |
|---|---|---|
| UI 框架 | React + TypeScript (strict) | 19.2 / 5.8 |
| 构建 | Vite + vite-plugin-pwa | 6.2 |
| 样式 | Tailwind CSS + 自定义 `jci-blue` token | 3.4 |
| 路由 | React Router | v7 |
| 数据获取 | useFirestoreCollection（自定义基础 Hook）+ TanStack Query（迁移中）| — |
| 状态管理 | React Context（Auth + Batch + HelpModal）| — |
| 后端 | Firebase（Firestore + Auth + Storage + FCM + App Check）| 10.x |
| 实时更新 | Firestore `onSnapshot`（仅 useGamification 使用）| — |
| 支付 | ToyyibPay（马来西亚本地）| — |
| 图片/文件 | Cloudinary + browser-image-compression | — |
| 导出 | jsPDF、pdf-lib、PapaParse、xlsx | — |
| 图表 | Recharts | 3.x |
| 日历 | react-big-calendar | — |
| 动画 | Framer Motion | 12.x |
| 拖拽 | @dnd-kit | — |
| 移动端 | Capacitor (iOS/Android 壳) | 8.x |
| AI | Gemini API（via `GEMINI_API_KEY`）| — |
| 测试 | Vitest + fast-check（属性测试）| — |
| 部署 | Netlify（主）+ Firebase Hosting（副）| — |

### 1.3 架构层次（当前实际状态）

```
Firestore ←→ Service（62 个静态类）
                  ↕ isDevMode() 短路 → MOCK_DATA（46/62 仍内联，16 个已重构）
                  ↕ withDevMode() 工厂（✅ 已创建，待迁移）
                  ↕
CacheService（TTL 内存缓存，3–5 min）
                  ↕
useFirestoreCollection（基础 Hook — 仅 useMembers 已迁移）
                  ↕
useXxx Hook（22 个，loading/error/data/mutations）
                  ↕
useQuery（TanStack Query — 仅 useGamification.awards 已迁移）
                  ↕
Component（UI 渲染 + 用户交互）
                  ↕
AsyncErrorBoundary（✅ 包裹所有模块）+ Suspense（懒加载）
```

---

## 二、功能组件清单

### 2.1 UI 原语层（`components/ui/`）

| 组件名称 | 文件路径 | 功能描述 | 复用性 | 依赖项 | 抽取状态 |
|---|---|---|---|---|---|
| Button | `ui/Button.tsx` | 6 变体 + Loading 态 | ★★★★★ | Tailwind | ✅ 已独立 |
| Card | `ui/Card.tsx` | 容器卡片（title/action 插槽）| ★★★★★ | Tailwind | ✅ 已独立 |
| StatCard | `ui/Card.tsx` | KPI 数据卡（值/趋势/图标）| ★★★★☆ | Card | ✅ 已独立 |
| Badge | `ui/Badge.tsx` | 8 种语义变体标签 | ★★★★★ | Tailwind | ✅ 已独立 |
| ProgressBar | `ui/Badge.tsx` | 带标签进度条 | ★★★★★ | Tailwind | ✅ 已独立 |
| Skeleton | `ui/Badge.tsx` | 加载占位动画 | ★★★★★ | Tailwind | ✅ 已独立 |
| Tabs | `ui/Tabs.tsx` | 可滚动 Tab（underline/button）| ★★★★☆ | lucide-react | ✅ 已独立 |
| Modal | `ui/Modal.tsx` | Portal 弹窗（8 尺寸 + 移动端适配）| ★★★★☆ | React Portal | ✅ 已独立 |
| Drawer | `ui/Drawer.tsx` | 三方向侧边栏 | ★★★★☆ | React Portal | ✅ 已独立 |
| Toast/useToast | `ui/Toast.tsx` | 全局消息（HMR-safe singleton）| ★★★★★ | React Context | ✅ 已独立 |
| Input/Select | `ui/Form.tsx` | 带 label/error 的表单控件 | ★★★★★ | Tailwind | 仍在 Form.tsx |
| Combobox | `ui/Combobox.tsx` | 可搜索下拉（大列表）| ★★★★☆ | Tailwind | ✅ 独立文件 |
| DataTable | `ui/DataTable.tsx` | 分页 + 列过滤表格 | ★★★☆☆ | Pagination | 独立但有业务耦合 |
| AsyncErrorBoundary | `ui/AsyncErrorBoundary.tsx` | 异步错误边界 | ★★★★★ | React | ✅ 已包裹所有模块 |

### 2.2 布局组件层（`components/layout/`）— 全部新增

| 组件名称 | 文件路径 | 功能描述 | 复用性 | 抽取前位置 |
|---|---|---|---|---|
| GuestHeader | `layout/GuestHeader.tsx` | 公开导航栏 + 移动端汉堡菜单 | ★★★☆☆ | App.tsx 内联 |
| GuestFooter | `layout/GuestFooter.tsx` | 静态页脚 | ★★★★☆ | App.tsx 内联 |
| SidebarItem | `layout/SidebarItem.tsx` | 侧边栏单个导航按钮 | ★★★★☆ | App.tsx 内联 |
| NotificationDrawer | `layout/NotificationDrawer.tsx` | 通知抽屉（移动底部浮层）| ★★★☆☆ | App.tsx 内联 |
| SearchDropdown | `layout/SearchDropdown.tsx` | 全局搜索（调用 4 个 Hook）| ★★★☆☆ | App.tsx 内联 |
| GuestAnalyticsTracker | `layout/GuestAnalyticsTracker.tsx` | 访客页面埋点（null 渲染）| ★★★★☆ | App.tsx 内联 |

### 2.3 数据 Hook 层（`hooks/`）

| Hook | 文件 | 功能 | 迁移状态 |
|---|---|---|---|
| **useFirestoreCollection** | `hooks/useFirestoreCollection.ts` | 通用数据加载基础 Hook | ✅ 已完成 |
| **useMembers** | `hooks/useMembers.ts` | 会员 CRUD | ✅ 已迁移 |
| **useGamification** | `hooks/useGamification.ts` | 奖项 + onSnapshot 实时订阅 | ✅ awards 迁移至 useQuery |
| useEvents | `hooks/useEvents.ts` | 活动 CRUD + 报名/签到 | 🔴 仍手写模式 |
| usePoints | `hooks/usePoints.ts` | 积分历史 + 排行榜 | 🔴 仍手写模式 |
| useProjects | `hooks/useProjects.ts` | 项目 CRUD | 🔴 仍手写模式 |
| useAuth | `hooks/useAuth.tsx` | Firebase Auth 会话 | N/A（特殊） |
| usePermissions | `hooks/usePermissions.ts` | RBAC（导入自 utils/rolePermissions）| ✅ 已重构 |
| 其余 16 个 | `hooks/use*.ts` | 各类数据 Hook | 🔴 仍手写模式 |

### 2.4 工具函数层（`utils/`）

| 工具 | 文件 | 导出内容 | 复用性 | 现状 |
|---|---|---|---|---|
| withDevMode | `utils/devMode.ts` | `withDevMode<T>(mockFn, realFn)` | ★★★★★ | ✅ 已创建，**零实际使用** |
| calculateAwardProgress | `utils/gamificationUtils.ts` | 纯函数，里程碑/线性进度 | ★★★★★ | ✅ 服务 + 测试共用 |
| ROLE_PERMISSIONS | `utils/rolePermissions.ts` | 每角色权限基准表 | ★★★★★ | ✅ usePermissions + 测试共用 |
| removeUndefined | `utils/dataUtils.ts` | 递归清理 undefined | ★★★★★ | 已存在，未统一使用 |
| formatCurrency | `utils/formatUtils.ts` | MYR 货币格式化 | ★★★★★ | 通用 |
| parseIC | `utils/malaysianIdUtils.ts` | MyKad 号码解析 | ★★★★☆ | 马来西亚特定 |
| dateUtils | `utils/dateUtils.ts` | 12 个日期工具 | ★★★★★ | 通用 |
| isMemberCurrentBoard | `utils/boardMembership.ts` | 仅检查 isCurrentBoardMember | ★★★☆☆ | ✅ 已简化双轨 |

### 2.5 Service 层（`services/`，62 个文件）

| 类别 | 代表 Service | 职责 | dev mock 状态 |
|---|---|---|---|
| 基础设施 | `cacheService.ts` | TTL 内存缓存（支持 localStorage）| 不需要 mock |
| 基础设施 | `errorLoggingService.ts` | 双轨日志（console + Firestore）| 不需要 mock |
| 基础设施 | `cloudinaryService.ts` | 图片上传/变换 | 不需要 mock |
| 核心 CRUD | `membersService.ts` | 会员读写（约 800 行）| 🔴 内联 isDevMode |
| 核心 CRUD | `eventsService.ts` | 活动读写 | 🔴 内联 isDevMode |
| 财务 | `financeService.ts` | 交易读写（⚠️ 3661 行）| 🔴 内联 isDevMode + localStorage mock |
| 游戏化 | `gamificationService.ts` | 奖项 CRUD（委托 gamificationUtils）| ✅ 委托工具函数 |
| 游戏化 | `pointsService.ts` | 积分授予（重载签名）| 🔴 内联 isDevMode |
| 自动化 | `automationService.ts` | 工作流 CRUD | 🔴 内联 isDevMode |
| AI | `aiPredictionService.ts` | 流失预测（Gemini API）| 🔴 内联 isDevMode |

### 2.6 共享基础设施（`components/shared/`）

| 模块 | 路径 | 复用场景 |
|---|---|---|
| BatchImportModal | `shared/batchImport/BatchImportModal.tsx` | Finance + Members 共用 |
| FieldDefinition | `shared/batchImport/batchImportTypes.ts` | 所有批量导入功能 |
| 模糊列头匹配 | `shared/batchImport/stringMatching.ts` | 批量导入列映射 |

---

## 三、编程习惯与模式分析

### 3.1 命名规范 ✓ 优秀且一致

| 类型 | 规范 | 例子 |
|---|---|---|
| 文件 | PascalCase（组件）、camelCase（其他）| `MembersView.tsx`、`useMembers.ts`、`membersService.ts` |
| 枚举 | SCREAMING_SNAKE_CASE | `UserRole.SUPER_ADMIN`、`COLLECTIONS.MEMBERS` |
| Hook 返回接口 | `UseXxxResult` | `UseMembersResult` |
| 三层对应 | `useXxx` ↔ `XxxService` ↔ `XxxView` | 完全可预测 |
| 常量 | UPPER_SNAKE | `DEFAULT_LO_ID`、`POINT_CATEGORIES` |
| 工具函数 | camelCase 动词短语 | `calculateAwardProgress`、`removeUndefined` |

**可改进：**
- `financeService.ts` 的 `localMockTransactions` vs 其他 Service 的 `MOCK_XXX` 命名不一致
- `pointsService.ts` 的 `awardPoints` 重载签名参数顺序混乱（兼容性负债）

### 3.2 代码组织方式

**整体趋势：先大文件积累功能，被复杂度逼迫后再拆分**

| 状态 | 文件 | 规模 | 处置方式 |
|---|---|---|---|
| ✅ 已拆分 | `types.ts`（原 2143 行）| → 9 个域文件 | 分域 |
| ✅ 已拆分 | `Common.tsx`（原 688 行）| → 7 个独立文件 | 按组件 |
| ✅ 已拆分 | `App.tsx` 布局组件 | 提取 6 个到 `layout/` | 按职责 |
| 🔴 待拆分 | `MembersView.tsx` | 5,571 行 | 急需 |
| 🔴 待拆分 | `ProjectsView.tsx` | 5,335 行 | 急需 |
| 🔴 待拆分 | `FinanceView.tsx` | 4,679 行 | 急需 |
| 🔴 待拆分 | `App.tsx` 访客页面 | ~2,000 行仍内联 | 下一步 |
| 🔴 待拆分 | `financeService.ts` | 3,661 行 | 建议按功能组拆分 |

**结论**：组织习惯是"功能内聚高于文件大小约束"——同一业务的代码倾向于放在一起，直到不可维护为止。这是务实但有技术债的做法。

### 3.3 状态管理偏好

```
层级         工具                        作用范围
─────────────────────────────────────────────────────────────
全局          AuthContext                 Firebase 会话，单例
UI-only       BatchModeContext            批量操作模式
UI-only       HelpModalContext            帮助弹窗
模块级        useXxx Hook（useState）     每模块独立，无跨模块共享
服务层        CacheService（内存 TTL）    替代跨组件数据共享
正在迁移      TanStack Query             awards 已迁移，其余待迁移
```

- **零 Redux / Zustand**：完全 React 原生，简单但导致重复 fetch
- mutation 后 `await reload()` 全量重拉（正确但无乐观更新）
- TanStack Query 已安装，仅 1 个 Hook 的 1 部分完成迁移

### 3.4 错误处理模式

**已统一的路径（useFirestoreCollection 之后）：**
```typescript
try {
  setLoading(true); setError(null);
  setData(await loader());
} catch (err) {
  const msg = err instanceof Error ? err.message : 'Failed to load data';
  setError(msg); showToast(msg, 'error'); throw err;
} finally { setLoading(false); }
```

**仍不一致的地方：**

| 位置 | 问题 | 严重程度 |
|---|---|---|
| `useEvents.markAttendance` | 不 re-throw（有注释说明原因）| 🟡 中 |
| `useEvents` publicMode | `console.warn` 而非 `showToast` | 🟡 中 |
| `financeService` dev mock | localStorage 持久化，其他 Service 用内存 mock | 🟡 中 |
| 62 个 Service | try-catch 密度不均匀 | 🟡 中 |

**优秀实践：**
- `errorLoggingService` 用 dynamic import 避免循环依赖
- `deleteMember` 对 `permission-denied` 有专门用户友好提示
- `firebase.ts` 生产环境 env var 缺失时 throw（✅ 已修复）
- 全局 `window.error` + `unhandledrejection` 监听

### 3.5 异步处理方式

- **100% async/await**，无 Promise chain
- fire-and-forget 用 `.catch(() => {})` 显式标注
- Firestore 批量写用 `writeBatch`（非串行 await）
- `useTransition`（React 18）用于 FinanceView 非阻塞更新
- `useGamification` 是唯一使用 `onSnapshot` 实时订阅的 Hook

### 3.6 常用技术组合（技术指纹）

```
读取链路：Firestore
           ↕ isDevMode() 短路（46/62 仍内联）
           ↕ withDevMode()（已提供，待迁移）
           ↕ CacheService.get/set(key, data, ttl)
           ↕ useFirestoreCollection({ loader, enabled, deps })
           ↕ useXxx Hook（CRUD mutations + toast）
```

```
写入链路：removeUndefined(data) → Firestore.updateDoc/addDoc
```

```
批量导入：stringMatching（模糊列头匹配）
         → validators（字段校验）
         → BatchImportModal（进度 UI）
         → Service.batchCreate()
```

### 3.7 注释与文档习惯

- **稀疏但精准**：注释只在"非显而易见"处出现
- `@deprecated` JSDoc 用于向后兼容字段（Member 接口的 flat 字段）
- `boardMembership.ts` 新加了详细注释说明"为什么只检查 isCurrentBoardMember"——这是理想的注释样本
- 没有 API 文档生成工具

### 3.8 重复代码模式现状

| 模式 | 出现次数 | 状态 |
|---|---|---|
| `if (isDevMode()) return MOCK_X` | **46 次**（62 个 Service 中）| 🔴 待迁移 `withDevMode()` |
| Hook 的 loading/error/useState 骨架 | 20 次 | 🟡 1/22 已迁移 |
| `err instanceof Error ? err.message : '...'` | 20+ 次 | 🟡 mutation 中仍重复 |
| `removeUndefined(data)` 写入前调用 | 多处 | 🟡 存在但覆盖不全 |
| `serverTimestamp() + removeUndefined()` | 多处 | 🔴 可抽取 `prepareFirestoreUpdate()` |

---

## 四、组件化改造建议

### 4.1 最高优先级：落地 `withDevMode` 工厂函数

**已创建未使用** — 这是最高性价比的下一步。

```typescript
// 当前模式（46 处）
static async getAllMembers() {
  if (isDevMode()) return MOCK_MEMBERS;
  const snap = await getDocs(collection(db, COLLECTIONS.MEMBERS));
  return snap.docs.map(d => ({ id: d.id, ...d.data() }) as Member);
}

// 目标模式（使用 withDevMode）
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

**迁移策略**：每次改动某个 Service 时顺手迁移（不需要专门一次性迁移）。

### 4.2 P1：迁移剩余 Hook 使用 `useFirestoreCollection`

已有模板（`useMembers.ts`），可以机械化迁移。建议顺序：

```
第 1 批（最简单）：useInventory, useHobbyClubs, useTemplates, useSurveys
第 2 批：usePoints, useKnowledge, useAdvertisements, useLearningPaths
第 3 批：useEvents, useProjects（有复杂 deps 依赖）
第 4 批（最复杂）：useAuth（特殊，不适用）
```

### 4.3 P1：添加 `prepareFirestoreUpdate` 工具函数

```typescript
// 新增到 utils/dataUtils.ts
export const prepareFirestoreUpdate = (data: Record<string, any>) =>
  removeUndefined({ ...data, updatedAt: serverTimestamp() });

export const prepareFirestoreCreate = (data: Record<string, any>) =>
  removeUndefined({ ...data, createdAt: serverTimestamp(), updatedAt: serverTimestamp() });
```

### 4.4 P1：拆分超大模块文件

**MembersView.tsx（5,571 行）建议拆分：**

```
components/modules/Members/
├── MembersView.tsx          # 入口（路由 + Tab 导航，~200 行）
├── MemberList.tsx           # 会员列表 + 筛选
├── MemberDetailPanel.tsx    # 侧边详情面板
├── MemberForm.tsx           # 新增/编辑表单
├── BoardManagementTab.tsx   # 理事会管理
├── MembershipDuesTab.tsx    # 会费管理
├── MentorshipTab.tsx        # 导师制度
└── ProbationTrackingTab.tsx # 试用期追踪
```

**ProjectsView.tsx（5,335 行）建议拆分：**

```
components/modules/Projects/
├── ProjectsView.tsx         # 入口（Tab 导航，~150 行）
├── ProjectList.tsx          # 项目列表 + 筛选
├── ProjectDetailPanel.tsx   # 项目详情侧面板
├── ProjectForm.tsx          # 新增/编辑表单
├── ProjectFinanceTab.tsx    # 项目财务管理
├── ProjectCommitteeTab.tsx  # 委员会分配
└── GanttChartView.tsx       # 甘特图（已引入 react-big-calendar）
```

### 4.5 P2：继续提取 App.tsx 访客页面

仍内联在 App.tsx 的访客页面（约 2,000 行）：

```
components/modules/guest/
├── GuestLandingPage.tsx     # 首页（约 516 行）
├── GuestEventsPage.tsx      # 活动页（约 348 行）
├── FlagshipProjectsPage.tsx # 旗舰项目页（约 400 行）
├── GuestAboutPage.tsx       # 关于页（约 658 行）
├── GuestEnewslettersPage.tsx # 电子报页（约 427 行）
├── GuestDirectoryPage.tsx   # 目录页（约 79 行）
└── GuestPartnershipPage.tsx # 合作伙伴页（约 276 行）
```

### 4.6 建议最终目录结构

```
components/
├── ui/              # ✅ 完成 — 无业务逻辑的通用原语
├── layout/          # ✅ 完成 — 从 App.tsx 提取的布局组件
├── shared/          # 有少量业务知识但跨模块复用
├── modules/         # 功能页面（模块 + 子目录）
└── modules/guest/   # 🆕 待创建 — 访客页面

types/               # ✅ 完成 — 按域拆分
hooks/               # 22 个（1/22 已迁移，21/22 待迁移）
services/            # 62 个（建议按域分子目录：finance/, member/, gamification/...）
utils/               # 10 个（withDevMode 待在服务层落地，prepareFirestoreUpdate 待创建）
```

---

## 五、个人技能体系化

### 5.1 擅长领域（代码证据支撑）

| 技术领域 | 代码证据 |
|---|---|
| **Firestore 数据建模** | 48+ 集合、复杂嵌套 Member 文档、writeBatch、34KB security rules、composite indexes |
| **React 状态管理（原生）** | 22 个自定义 Hook，AuthContext，`useTransition`，HMR-safe singleton Toast |
| **RBAC 权限系统** | 静态查找表（ROLE_PERMISSIONS）+ 动态 Board 提升 + Simulation 模式 |
| **大型模块代码拆分** | 两层懒加载（App 级 + FinanceView 内部），vite manualChunks 6 个 vendor 包 |
| **批量数据处理** | 通用 batchImport 基础设施（模糊列头匹配 + 字段验证 + 进度 UI）|
| **Malaysia 本地化** | ToyyibPay 支付、MYR 格式化、MyKad IC 工具（州码 + 世纪逻辑）|
| **双后端架构** | Firebase Cloud Functions + Netlify Functions 协同，职责合理分工 |
| **PWA + 移动端** | Service Worker + FCM 推送 + Capacitor iOS/Android 壳 |
| **属性测试** | fast-check + Vitest，8 个测试文件，测试现已 import 生产工具函数 |

### 5.2 解决问题的思路模式

1. **先定义 TypeScript 类型，再写 Service，最后写 UI** — 类型文件的中心地位和完整性证明
2. **先建立 Mock 层实现离线开发** — `isDevMode()` 短路是第一步，不是事后添加
3. **遇到复杂功能就新建 Service 文件**，而非扩展现有（62 个 Service 是习惯的结果）
4. **共享逻辑抽到 `shared/` 而非 copy-paste** — `batchImport/` 被 Finance 和 Members 共用
5. **被复杂度逼迫时才重构** — types 拆分、Common.tsx 拆分都是在文件达到临界大小后发生的
6. **测试用属性测试而非手写 case** — 体现了对边界条件的系统性思维

### 5.3 技术盲点与可提升方向

| 盲点 | 现象 | 严重程度 |
|---|---|---|
| **withDevMode 创建即停用** | 创建了工厂函数但 0 个 Service 使用，说明重构 vs. 使用之间存在"最后一公里"问题 | 🔴 高 |
| **Hook 迁移速度慢** | 1/22 已迁移，其余等待下一轮驱动力 | 🔴 高 |
| **大文件边界模糊** | MembersView 5571 行积累到 IDE 明显卡顿才会拆分 | 🟡 中 |
| **Service 层测试缺失** | 62 个 Service 承载所有业务逻辑，几乎无集成测试 | 🟡 中 |
| **乐观更新缺失** | mutation 后全量 reload，高频操作（签到、积分）延迟明显 | 🟡 中 |
| **TanStack Query 未系统落地** | 安装并配置，但仅 1 个 Hook 局部使用 | 🟡 中 |
| **列表无虚拟化** | 大会员列表全量渲染 | 🟢 低（暂时）|

### 5.4 下一步学习建议

| 建议 | 原因 | 具体行动 |
|---|---|---|
| **实际落地 `withDevMode`** | 创建即放弃是最常见的"半成品抽象"陷阱 | 在下一个要改的 Service 里直接用 withDevMode，而不是等"一次性迁移全部" |
| **TanStack Query 系统迁移** | 已有配置，迁移第一批简单 Hook（useInventory, useHobbyClubs）建立模式 | `useQuery` + `queryClient.invalidateQueries`，对比现有 Hook 行为验证 |
| **Zod 运行时校验** | Firestore 数据 schema 漂移时无运行时保护 | 在 Service 层对 Firestore read 数据做 `z.parse()`，边界拦截 |
| **Firebase Emulator Suite** | 替代 `isDevMode()` mock，获得更接近生产的本地开发体验 | 配置 `firebase.json` emulator，让 `withDevMode` 在 dev 时指向 emulator |
| **大文件拆分触发条件制度化** | 避免等到 5000 行才拆 | 超过 800 行自动在 PR 中提示，超过 1500 行必须拆分才合并 |

---

## 六、改进路线图（完整版）

| 优先级 | 改进项 | 主要收益 | 难度 | 状态 |
|---|---|---|---|---|
| ✅ P0 | 拆分 `types.ts` | IDE 性能、可维护性 | 低 | **已完成** |
| ✅ P0 | 拆分 `Common.tsx` | 可读性、按需 import | 低 | **已完成** |
| ✅ P1 | 抽取 `useFirestoreCollection` | 消除 Hook 样板 | 中 | **已完成** |
| ✅ P1 | 添加 `AsyncErrorBoundary` | 稳健性 | 低 | **已完成** |
| ✅ P1 | 安装并配置 TanStack Query | 为性能升级铺路 | 低 | **已完成** |
| ✅ P1 | 修复测试与生产代码漂移 | 测试真实可信 | 中 | **已完成** |
| ✅ P1 | Board Membership 单一来源 | 权限一致性 | 中 | **已完成** |
| ✅ P1 | `withDevMode` 工厂函数（创建）| 消除重复基础 | 低 | **已完成** |
| ✅ P1 | `firebase.ts` fail-fast | 生产故障可见性 | 低 | **已完成** |
| ✅ P1 | 提取 `ROLE_PERMISSIONS` | 权限测试对齐 | 低 | **已完成** |
| ✅ P2 | 提取 layout/ 组件 | App.tsx 可读性 | 中 | **已完成** |
| ✅ P2 | TanStack Query 迁移第一个 Hook | 验证迁移模式 | 中 | **已完成（useGamification.awards）** |
| 🔴 **立即** | **落地 `withDevMode`**（46 个 Service）| 消除最多重复代码 | 低（渐进）| **待办** |
| 🔴 **立即** | 迁移 Hook 使用 `useFirestoreCollection` | 消除 21 个 Hook 样板 | 低（机械化）| **待办** |
| 🟡 P1 | `prepareFirestoreUpdate` 工具函数 | 写入一致性 | 低 | **待办** |
| 🟡 P1 | 拆分 MembersView.tsx（5571 行）| IDE 性能、PR 可审性 | 高 | **待办** |
| 🟡 P1 | 拆分 ProjectsView.tsx（5335 行）| 同上 | 高 | **待办** |
| 🟡 P1 | 拆分 FinanceView.tsx（4679 行）| 同上 | 高 | **待办** |
| 🟡 P2 | 提取 App.tsx 访客页面（~2000 行）| App.tsx 继续缩减 | 中 | **待办** |
| 🟡 P2 | TanStack Query 系统迁移全部 Hook | 性能、去重 | 中 | **待办** |
| 🟢 P3 | Service 层集成测试 | 回归安全 | 高 | **待办** |
| 🟢 P3 | 乐观更新（高频操作）| 用户体验 | 高 | **待办** |
| 🟢 P3 | Zod 运行时校验 | 数据安全 | 中 | **待办** |
| 🟢 P3 | 列表虚拟化 | 大数据集性能 | 中 | **待办** |
