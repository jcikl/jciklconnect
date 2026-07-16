# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev          # Vite dev server on port 3000
npm run build        # Production build → dist/
npm run preview      # Preview production build locally
npm run dev:a11y     # Dev server with axe-core accessibility scanning enabled
npm test             # Vitest test suite
npm run test:ui      # Vitest with browser UI
```

There is no separate lint script; TypeScript strict-mode compilation (`tsc --noEmit` via build) is the linting gate.

## Architecture Overview

This is a production-grade React 19 + Firebase SPA for managing the JCI Kuala Lumpur chapter — covering members, events, projects, finance, gamification, governance, and AI insights.

**Tech stack:** React 19, TypeScript 5.8 (strict), Vite 6, Tailwind CSS, React Router v7, Firebase (Firestore, Auth, Storage, FCM), Netlify Functions, Cloudinary, ToyyibPay.

### Layer model

```
index.tsx            → providers (AuthContext, Toast, A11y)
App.tsx              → SPA router, lazy-loaded module views, layout shell
components/modules/  → Feature views (lazy-loaded via React.lazy)
hooks/               → Data hooks (wrap service calls, own loading/error state)
services/            → Business logic + all Firestore queries (static classes)
config/firebase.ts   → Firebase SDK init, auth persistence, App Check
config/constants.ts  → Firestore collection names, role constants
types.ts             → All domain TypeScript interfaces (~2000 lines)
```

### Data flow

1. **Auth** — `useAuth` hook (hooks/useAuth.tsx) owns the Firebase Auth session and exposes the current user + role to the whole app via React Context.
2. **Permissions** — `usePermissions` (hooks/usePermissions.ts) drives all conditional rendering and route guards. Roles: `GUEST → MEMBER → BOARD → ADMIN → SUPER_ADMIN / INACTIVE`.
3. **Services** — All Firestore reads/writes live in `services/`. Services are static utility classes; they never hold React state. Key ones: `membersService`, `eventsService`, `projectsService`, `pointsService`, `financeService`, `automationService`.
4. **Hooks** — `hooks/useXxx.ts` files wrap service calls with `useState` + `useEffect`, returning `{ data, loading, error }` plus mutation helpers. Components call hooks, never services directly.
5. **State** — No Redux or Zustand. Global state is AuthContext + Firestore real-time listeners. Local UI state stays in components. `contexts/` holds two lightweight contexts (BatchMode, HelpModal).

### Key patterns

- **Dev mode** (`utils/devMode.ts`) — all services check `isDevMode()` and return mock data, enabling offline development without Firebase credentials.
- **Caching** — `cacheService.ts` provides TTL-based in-memory caching (typically 3–5 min) with prefix-based invalidation; services call it before hitting Firestore.
- **Code splitting** — All module views in `components/modules/` are `React.lazy()`-wrapped in App.tsx. Add new views the same way.
- **UI primitives** — Use `components/ui/Common.tsx` (Button, Card, Modal, Badge, Drawer, Toast, ProgressBar) and `components/ui/Form.tsx` (Input, Select, Checkbox, FormField) before creating new UI. `components/ui/Combobox.tsx` is the searchable-select component.
- **Error handling** — Wrap new async operations with `errorLoggingService` (logs to Firestore). `ErrorBoundary` and `AsyncErrorBoundary` are in `components/ui/`.

### Domain model highlights (types.ts)

- **Member** — nested `general / contact / business / jciCareer` sub-objects; flat aliases exist for backward compatibility.
- **Event / Project** — full lifecycle with committee assignments, financials, and attendance.
- **Points / Award / Badge** — gamification engine with tiers (Bronze → Legendary), milestones, escrow/bounty mechanics, and `IncentiveProgram` (yearly JCI-specific star targets).
- **Transaction / BankAccount** — double-entry finance with `TransactionSplit`, reconciliation, and `ProjectFinancialAccount` budgeting.
- **Workflow / Rule** — automation engine; triggers, conditions, and actions are all stored in Firestore and executed by `automationService` + `workflowExecutionService`.

### Firebase collections

Collection names are all in `config/constants.ts`. There are 48+ collections. The most-touched ones are: `members`, `events`, `projects`, `transactions`, `bankAccounts`, `points`, `pointRules`, `badges`, `achievements`, `incentivePrograms`, `incentiveSubmissions`, `paymentRequests`, `eventRegistrations`, `notifications`, `workflows`, `automationRules`.

Firestore security rules are in `firestore.rules` (34 KB). Composite indexes are in `firestore.indexes.json`.

### Deployment

- **Netlify** — primary hosting; config in `netlify.toml` (build command, redirects, CSP headers, cache-control rules). Serverless functions live in `netlify/functions/`.
- **Firebase Hosting** — secondary; config in `firebase.json` also covers Firestore rules, Storage rules, and Cloud Functions (Node 18).
- **PWA** — `vite-plugin-pwa` generates a service worker; `public/firebase-messaging-sw.js` handles FCM push notifications.

### Path aliases

`tsconfig.json` maps `@/*` → project root, so imports use `@/services/...`, `@/hooks/...`, etc.

---

## Collection Analysis Framework

Use this prompt to perform a full systematic analysis of any single Firestore collection. Execute one collection at a time to avoid context overflow. Output via `show_widget` (six-in-one: overview card + CRUD matrix with variant symmetry + field logic map + key flow diagram + logic error report with 3-layer coverage + fix roadmap).

**v2 framework additions** — reduces multi-round churn:
- **STEP 3B** Variant symmetry check: compares single vs batch variants across permission guards, rollback, side effects, cache invalidation
- **STEP 5** Three-layer coverage: each error is explicitly checked at Service / Firestore rules / UI layers
- **STEP 5.5** Fix ripple analysis: for each error, predicts which adjacent files/variants/collections must change in sync
- **STEP 6⑥** Fix roadmap: dependency-ordered fix sequence, flags which fixes require Firestore rules deployment

```
请对集合 <COLLECTION_NAME> 执行完整的系统性分析，按以下 6 步骤输出：

【STEP 1 — 扫描范围】
列出所有涉及该集合的：
① UI 模块（components/modules/ 中哪些文件渲染了该集合数据）
② Hooks（hooks/ 中哪些 hook 调用了该集合的 service）
③ Service 方法（services/ 中所有读写该集合的方法名 + 大致行号）
④ 外部依赖集合（该集合写入时会联动写入哪些其他集合）

【STEP 2 — 权限矩阵】
对照 firestore.rules，列出该集合的 allow read / write / update / delete 规则，
标注哪些角色可执行哪些操作，以及是否有 resource.data 条件（影响 Admin 批量扫描）。

【STEP 3 — CRUD 操作清单】
每个操作一行，包含：操作名 | 类型(C/R/U/D/Batch) | 触发 UI | 所需权限角色 | Service 方法 | 退回机制（完整/部分/无）| 是否可组件化

【STEP 3.5 — 全字段业务逻辑地图】
这是框架中最容易被忽视、但对复杂集合最重要的一步。
目标：对集合的**所有字段**（平铺字段 + nested 字段路径）逐一梳理其业务含义和联动逻辑，
而不仅仅是 enum 判断字段。每个字段被写入或读取时，整个系统会发生什么？

① 建立全字段清单
   对照 types.ts 中该集合对应的 TypeScript 类型定义，列出所有字段，包括：
   - 平铺字段（如 status、amount、bankAccountId）
   - Nested 对象字段（展开到叶子节点，如 jciCareer.senatorshipValidatedAt、membership.2024.status）
   - 动态 key 的 map 字段（如 membership[year]、scores[eventId]，说明 key 的含义和值的结构）
   每个字段标注：数据类型 | 是否必填 | 是否 enum（列出所有可能值）

② 对每个字段，逐一分析写入时的业务联动
   字段被写入（新建或更新）时：
   - 哪个 Service 方法会写这个字段（代码行号）
   - 写入后会联动写哪些其他集合的哪些字段（例如：写 role → 联动写 boardMembers.displayRole）
   - 写入后会触发哪些 UI 模块的状态变化或重新加载
   - 写入后是否触发 automationService / notificationService / pointsService 等副作用
   - 是否有前置校验（写入前必须满足什么条件）

③ 对每个字段，逐一分析读取时的业务联动
   字段被读取时：
   - 哪些 UI 模块或 Service 方法读取了这个字段（代码行号）
   - 读取结果用于什么决策（显示/隐藏按钮、计算金额、判断权限、过滤列表）
   - 读取结果是否被缓存（缓存 key 是什么，过期多久）

④ 标注字段级缺口与风险
   - 字段有值但没有任何代码读取它（死字段，浪费存储或误导开发者）
   - 字段被多处读取但只有一处写入，其他写入路径遗漏了这个字段导致数据不一致
   - Nested 字段的某个子路径在 TypeScript 类型里存在，但从未被写入（永远是 undefined）
   - enum 字段有某个值在 TypeScript 里定义了，但整个代码库里没有任何处理分支
   - 字段同时存在平铺版和 nested 版（向后兼容冗余），但两者更新逻辑不同步

输出格式：
按字段分组，每个字段一行：
字段路径 | 类型/枚举值 | 写入方法（行号）| 联动写集合 | 联动模块/副作用 | 读取方 | 读取用途 | 缺口标记（⚠️）

【STEP 4 — 退回机制 & 风险评估】
① 哪些操作有完整退回（事务 / writeBatch + 回滚）
② 哪些操作是 fire-and-forget 副作用（失败无通知）
③ 删除该集合文档后，哪些集合会产生孤儿数据（无级联清理）
④ Firestore 规则中是否存在比 service 层更宽松的访问漏洞

【STEP 5 — 逻辑错误扫描 & 修复建议】
结合 STEP 1–4 的发现，逐条检查以下 7 类逻辑错误。

每条错误输出格式：
位置（文件:行号）| 错误类型 | 错误描述 | 修复原因 | 修复建议 | 优先级（P0/P1/P2）

大白话写作要求（修复原因 & 修复建议必须遵守）：
- 修复原因 = 说清楚"不修会发生什么后果"，面向非技术读者，可用类比。
  好例子："不修的话，任何登录用户都能把自己的权限改成管理员，就像银行柜员能自己给自己调薪。"
  坏例子："违反最小权限原则，存在权限提升向量。"
- 修复建议 = 说清楚"改哪里、改成什么样"，说人话，可提供代码方向但不堆砌术语。
  好例子："在 Firebase 规则里加一行'只允许改联系电话/公司名这几个字段'的限制，其他字段一律锁死。"
  坏例子："在 allow update 分支添加 hasOnly() 白名单约束敏感字段写入路径。"
- 禁止直接使用的术语（必须转译成大白话）：原子性、TTL、fire-and-forget、悬挂引用、脏读、race condition、级联删除、幂等。

① Firebase 规则 vs 代码权限不一致
   - 规则比代码更宽松：有人绕过我们写的代码，直接往数据库写危险字段（如自己升级成管理员）
   - 规则比代码更严格：代码调用了某功能，Firebase 直接拒绝，但用户看不到任何错误，操作静默消失
   - 查询规则用了文档内容判断：在批量查询时这条规则永远不成立，管理员的批量操作全部静默失败（需在前置加 isAdmin() ||）

② 操作做到一半失败，没有撤销
   - 要写两个地方的操作（如：改状态 + 挂付款记录）分两步单独发出，中途失败只有一边写成功，数据两边对不上
   - 同时发多个写请求，一个失败了其余已完成的无法一起撤回
   - 数据写完后，"清除旧缓存"这一步放在另一个请求里，中间有一段时间读到的还是写之前的旧值

③ 状态跳跃 / 字段没同步
   - 允许不合理的状态跳跃（如从"已停用"直接跳到"管理员"，跳过了所有中间步骤）
   - 改了主字段，但相关的冗余字段没有跟着同步（如改了角色，但显示名称还是旧的）
   - 按钮根据页面状态显示/隐藏，但点击后代码里没有再校验一次，绕过页面直接调接口也能执行

④ 数据已改，页面还显示旧的
   - 写完数据库后忘了清缓存，下次读到的还是旧数据，最多要等缓存过期（通常 3–5 分钟）才自动刷新
   - 只清了"全部数据"这个缓存键，但按 LO 分组查询有独立的缓存键没清，按 LO 查时还是旧数据
   - 主集合缓存清了，但依赖它的其他集合缓存没清，关联数据仍然过期

⑤ 附带操作失败，主流程毫不知情
   - 有些同步操作（如同步商业目录）失败了，系统不告诉用户，也不重试，主数据和副数据永久不一致
   - 附带操作依赖主操作刚写入的数据，但附带操作先触发了，读到的是写之前的旧值
   - 附带操作失败后，两边数据永久处于不一致状态，没有任何补救手段

⑥ 删了主记录，关联数据变成无人认领的孤儿
   - 直接删掉主文档，但其他集合里还有很多记录指向这个已不存在的 ID（如活动报名记录里还有这个人，但查不到对应会员了）
   - 没有"软删除"或"归档"降级路径，删了就真的没了，历史记录和审计日志都断了
   - 删之前没检查这条记录有没有被别处引用（如项目还在用这个成员 ID，删了项目就出错）

⑦ 前端拦了，但 Firebase 没拦
   - 某些字段只在页面或代码里限制了不能改，但 Firebase 规则没跟着限制，懂技术的人直接调 Firebase SDK 就能绕过（需加 hasOnly([...]) 白名单）
   - 页面上隐藏了某个危险操作的入口，但 Firebase 规则没有封住，直接发请求还是能执行
   - 必填字段只在页面表单上标了必填，Firebase 规则里没有"这个字段必须存在"的检查，直接调接口可以不填（需加 hasAll([...])）

【STEP 6 — show_widget 五合一输出】
① 集合概览卡片：集合名、涉及模块数、外部依赖集合数、退回机制完整度（完整/部分/缺失）、可组件化数量、业务分支数、逻辑错误总数（按类别分布）
② CRUD 矩阵表格：每行一个操作，列 = 操作类型｜触发 UI｜权限角色｜Service 方法｜退回机制｜逻辑错误标记
③ 业务逻辑分支表格：每个判断字段独立一个小表，列 = 字段值｜处理方法（行号）｜联动集合｜联动模块｜有无撤销路径｜缺口标记（⚠️），缺口行橙色高亮
④ 关键链路流程图：选最复杂操作画完整链路（含业务分支判断节点），在逻辑错误或分支缺口节点标注 ⚠️
⑤ 逻辑错误报告表：每行一个错误，列 = 错误类型｜位置｜错误描述｜修复原因（大白话）｜修复建议（大白话）｜优先级（P0紧急/P1重要/P2建议）
```

### 已分析集合（analyze-collection）

| 集合 | 分析日期 | Service方法数 | CRUD操作数 | 逻辑错误数（P0/P1/P2）| 变体不对称数 | 退回完整度 | 相邻风险集合（修复时需同步检查）|
|------|----------|--------------|-----------|----------------------|------------|-----------|-------------------------------|
| `members` | 2026-07-15（v2框架前） | 30 | 20 | 13已修 | 已修 | 部分 | `boardMembers`, `businessDirectory`, `eventRegistrations`, `points` |
| `transactions` | 2026-07-16 | 39 | 30 | 10（1/4/5）| 4 | 部分 | `transactionSplits`, `projectTrx`, `paymentRequests`, `reconciliations`, `members` |
| `transactionSplits` | 2026-07-16 | 11 | 9 | 10（0/8/2）| 3 | 部分 | `transactions`, `members`, `paymentRequests` |
| `projectTrx` | 2026-07-16 | 8 | 10 | 9（0/6/3）| 3 | 部分 | `transactions`, `projects`, `bankAccounts` |
| `paymentRequests` | 2026-07-16 | 18 | 11 | 7（2/3/2）| 1 | 部分 | `transactions`, `members`, `eventRegistrations`, `notifications` |
| `eventRegistrations` | 2026-07-16 | 12 | 15 | 12（2/6/4）| 3 | 部分 | `events`, `members`, `points`, `transactions`, `notifications` |
| `reconciliations` | 2026-07-16 | 11 | 8 | 11（0/7/4）| 2 | 部分 | `transactions`, `bankAccounts`, `members` |
| `inventoryItems` | 2026-07-16 | 37 | 14 | 13（1/6/6）| 5 | 缺失 | `transactions`, `members`, `notifications`, `financeAlerts` |
| `notifications` | 2026-07-16 | 19 | 12 | 8（2/4/2）| 2 | 部分 | `members`, `events`, `points`, `workflows` |
| `financeAlerts` | 2026-07-16 | 2 | 2 | 6（0/3/3）| 0 | 缺失 | `transactions`, `bankAccounts`, `members` |

### 已分析集合（collection-deps）

| 集合 | 分析日期 | 联动集合数 | 强耦合 | 中耦合 | 弱耦合 | P0风险数 | P0风险摘要 |
|------|----------|-----------|-------|-------|-------|---------|-----------|
| `transactions` | 2026-07-16 | 10 | 3（`transactionSplits`, `members`, `projectTrx`）| 4（`paymentRequests`, `inventoryItems`, `notifications`, `reconciliations`）| 2（`financeAlerts`, `eventRegistrations`）+ 1 自引用 | 3 | rules `loId` 判断失效（全 LO 数据泄露）；`revertPaid` 非批次（PR 永久 Paid 但无交易）；删 Membership 交易不清 `members.transactionId[]` |

### Firestore 权限规则注意事项

- `resource.data` **不能**用于 collection-level list/query 规则（仅 document-level get 可用）。批量扫描/迁移规则必须在最前加 `isAdmin() ||` 绕过 resource.data 检查。
- `allow read` 与 `allow update` 是独立的门。迁移操作（scan = read + migrate = update）两条规则都必须独立加 `isAdmin()`。
- `Transaction` 集合无 `loId` 字段，LO 归属通过 `bankAccountId → bankAccounts.loId` 间接表达。
