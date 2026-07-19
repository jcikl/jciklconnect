# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Memory File Protocol (Mandatory)

Every time a memory file is created or deleted, these two steps are **required without exception**:

1. **Update `MEMORY.md` index** — add or remove the corresponding entry (one line: `- [Title](filename.md) — one-line summary`)
2. **Verify no orphan files** — run a mental or literal check: every `.md` file in the memory directory must have a matching entry in `MEMORY.md`, and every entry in `MEMORY.md` must point to a file that exists

If these two steps are skipped, the memory file becomes an orphan — it exists on disk but will never be read, making it permanently invisible.

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

## Skill & Tool Discovery Protocol (Auto-enforced)

**When a recurring development pain point is identified — whether in analysis, code quality, workflow, or delivery — always check if the market has a mature skill, tool, or methodology that addresses it before improvising a solution from scratch.**

### When to trigger this protocol

Trigger automatically when any of these situations arise:

| Situation | Example |
|---|---|
| A type of analysis needs to be repeated across many files or collections | "I need to check all 10 collections for the same class of bug" |
| A development workflow step keeps being described from scratch each time | "Before writing UI, scan existing components, then..." |
| A class of error keeps appearing across different features | "Cache not invalidated after write" appearing in 5 different services |
| A delivery or quality concern has no systematic answer yet | "How do we ensure Firestore rules match service-layer permissions?" |
| A task is complex enough that an ad-hoc approach produces inconsistent results | Multi-collection dependency analysis |

### Step 1 — Search for existing solutions

Look across three sources in order:

1. **Existing project skills** — check `.claude/commands/` first; the problem may already be solved
2. **Claude / AI workflow patterns** — is there a known prompting pattern, agent workflow, or skill structure that addresses this? (e.g., multi-agent parallel analysis, structured output schemas, loop-until-dry patterns)
3. **Industry methodology** — is there a named practice that fits? (e.g., ADR for architecture decisions, contract testing for API boundaries, feature flags for gradual rollout, schema migration protocols)

### Step 2 — Evaluate fit

| Criterion | Question |
|---|---|
| Coverage | Does it address at least 70% of the pain point as-is? |
| Adaptability | Can the remaining 30% be customised without breaking the core approach? |
| Complexity | Is the overhead of adopting it lower than the cost of the recurring pain? |
| Project fit | Does it work within the existing Firebase + React + hook/service architecture? |

### Step 3 — Decision output

- **Adopt and customise** → implement it, strip parts that don't apply, add project-specific steps, save as a new skill in `.claude/commands/` or as a section in `CLAUDE.md`
- **Partial adoption** → take only the relevant parts, document what was kept and why
- **Build from scratch** → only if no existing solution fits; design it to be reusable from the start, not one-off

### What gets saved after adoption

Every adopted skill or methodology must be persisted in one of two places:

- **`.claude/commands/`** — if it's a repeatable task triggered by a slash command (e.g., `/analyze-collection`, `/develop-feature`)
- **`CLAUDE.md`** — if it's a standing protocol that applies automatically to all development (e.g., the cache invalidation rule, the writeBatch rule)

Never leave an adopted practice living only in conversation context — it will be lost when the session ends.

---

## Library vs Self-Build Decision Protocol (Auto-enforced)

**Before implementing any non-trivial feature, evaluate whether a mature library already solves the problem. This is mandatory — do not skip straight to writing code.**

### Step 1 — Identify the nature of the problem

| Problem type | Default decision |
|---|---|
| Complex interaction logic (date picker, drag-and-drop, rich text, virtual scroll) | Evaluate existing libraries first |
| Simple UI components (buttons, cards, forms, badges) | Extend `components/ui/` — do not bring in a library |
| Data processing (charts, Excel export, PDF generation, CSV parsing) | Evaluate bundle size impact before deciding |
| Business logic (membership rules, finance reconciliation, points calculation) | Always self-build — no external library understands the business rules |
| Firebase / auth / routing | Already solved by existing stack — do not replace |

### Step 2 — If a library is a candidate, evaluate on four criteria

1. **Bundle size** — would adding this library keep data load under 2 seconds? Check the minified + gzipped size (via bundlephobia.com mental check). If the library is large but only a small part is needed, look for a lighter alternative or self-build that part only.
2. **Maintenance health** — is it actively maintained? (recent commits, open issues being addressed, compatible with React 19)
3. **Architecture fit** — does it work alongside Tailwind CSS, Firebase, and the existing hook/service layer without conflict?
4. **Usage ratio** — will at least 30% of the library's features be used? If using less, self-build the specific part needed.

### Step 3 — Decision output

- **Use the library** → install it, document why it was chosen in a brief code comment, lazy-load it if it's heavy (`React.lazy` or dynamic `import()`)
- **Self-build** → implement in `components/ui/` (UI) or `services/` (data logic), following the existing layer protocol
- **Uncertain** → default to self-build for now, leave a `// TODO: evaluate [library name] if this grows more complex` comment

### What this protocol is NOT

- It does not apply to libraries already in the stack (React, Firebase, Tailwind, Vite, React Router, etc.)
- It does not require asking the user for approval on every library decision — make the call, state the reasoning in the commit message

---

## UI Component & Data Layer Protocol (Auto-enforced)

**Every development task — whether a new feature, a bug fix, or a refactor — must run this protocol automatically, without waiting for explicit instruction.**

### Before writing any UI code

1. **Read `components/ui/Common.tsx` and `components/ui/Form.tsx`** to inventory what primitives already exist.
   - Available UI primitives: `Button`, `Card`, `Modal`, `Badge`, `Drawer`, `Toast`, `ProgressBar`, `Table`, `Spinner`, `EmptyState`, `ConfirmDialog`
   - Available form primitives: `Input`, `Select`, `Checkbox`, `FormField`, `Textarea`
   - Available search: `components/ui/Combobox.tsx`
   - Scan `components/ui/` for any additional primitives added since this doc was written.

2. **Decision rule — reuse vs. extend vs. create:**
   - If an existing primitive covers the need → use it directly, no changes.
   - If an existing primitive is 80%+ there but missing one prop or variant → **extend it in place** (add the prop, keep backward compat, update the type).
   - If the need is genuinely new and will recur in ≥2 places → **create a new primitive in `components/ui/`** with full prop types and both light/dark theme support.
   - If the need is one-off and local → implement inline in the feature component, do not extract.

3. **Never create a feature-local copy of an existing primitive.** If `Button` doesn't support a needed variant, add the variant to `Button`, not a `MySpecialButton` in the feature folder.

### Before writing any data/hook code

1. **Scan `hooks/` for existing hooks** that already manage the relevant data. Check if the hook already exposes the mutation or query you need.
   - If yes → call the existing hook, do not duplicate the Firestore query.
   - If the hook is missing one method → **add the method to the existing hook**, return it alongside existing methods.
   - If the concern is genuinely separate (different Firestore collection, different lifecycle) → create a new `hooks/useXxx.ts`.

2. **Scan `services/` for existing service methods** before writing new ones.
   - If a service method already does what you need → call it.
   - If it's close but missing a parameter or variant → extend it (add optional param, keep existing callers unbroken).
   - New service methods must follow the mandatory pattern:
     - `static async` method on the service class
     - `isDevMode()` check at the top, returning mock data in dev
     - Cache read before Firestore query (TTL 3–5 min via `cacheService`)
     - `writeBatch` for any multi-document write
     - `invalidateXxxCache()` after every write
     - Errors propagated (never swallowed), logged via `errorLoggingService`

### Iterative improvement rule

When you touch a component or hook for any reason (bug fix, new prop, refactor), also apply these improvements if they are missing and the change is low-risk:

- **Missing loading state** → add `loading` prop/state and show `Spinner` or disable the trigger button.
- **Missing empty state** → add an `EmptyState` (or equivalent) when data array is empty.
- **Missing error state** → surface errors via `useToast` rather than silently swallowing them.
- **Missing mobile layout** → ensure the component doesn't break at < 640px (Tailwind `sm:` breakpoints).
- **Prop types incomplete** → complete the TypeScript interface while you're in the file.

Do not apply improvements that require understanding the full feature context or that risk changing behavior. Leave a `// TODO:` comment instead.

### Mandatory checks before any PR / commit

- [ ] No new component duplicates an existing `components/ui/` primitive
- [ ] No new hook duplicates an existing hook's Firestore query
- [ ] Every new service method has a `devMode` path
- [ ] Every write path uses `writeBatch` (if touching >1 document)
- [ ] Every write path calls `invalidateXxxCache()` after commit
- [ ] New UI primitives support both light and dark theme via CSS variables

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

**v3 re-analysis（2026-07-16，修复后残余）— P0×3 P1×47 P2×28 Total×78**

| 集合 | 分析日期 | Service方法数 | CRUD操作数 | 逻辑错误数（P0/P1/P2）| 变体不对称数 | 退回完整度 | 相邻风险集合（修复时需同步检查）|
|------|----------|--------------|-----------|----------------------|------------|-----------|-------------------------------|
| `transactions` | v3 2026-07-16 | 39 | 30 | 9（0/5/4）| 4 | 部分 | `transactionSplits`, `projectTrx`, `paymentRequests`, `reconciliations`, `members` |
| `transactionSplits` | v3 2026-07-16 | 11 | 9 | 8（1/5/2）| 3 | 部分 | `transactions`, `members`, `paymentRequests` |
| `members` | v3 2026-07-16 | 22 | 19 | 8（0/6/2）| 2 | 部分 | `boardMembers`, `businessDirectory`, `eventRegistrations`, `points` |
| `projectTrx` | v3 2026-07-16 | 10 | 10 | 8（0/6/2）| 2 | 部分 | `transactions`, `projects`, `bankAccounts` |
| `paymentRequests` | v3 2026-07-16 | 18 | 12 | 7（0/4/3）| 3 | 部分 | `transactions`, `members`, `eventRegistrations`, `notifications` |
| `eventRegistrations` | v3 2026-07-16 | 12 | 11 | 9（0/5/4）| 3 | 部分 | `events`, `members`, `points`, `transactions`, `notifications` |
| `reconciliations` | v3 2026-07-16 | 11 | 8 | 7（0/4/3）| 2 | 部分 | `transactions`, `bankAccounts`, `members` |
| `inventoryItems` | v3 2026-07-16 | 37 | 14 | 9（0/5/4）| 3 | 部分 | `transactions`, `members`, `notifications`, `financeAlerts` |
| `notifications` | v3 2026-07-16 | 12 | 7 | 8（2/4/2）| 2 | 部分 | `members`, `events`, `points`, `workflows` |
| `financeAlerts` | v3 2026-07-16 | 2 | 3 | 5（0/3/2）| 1 | 缺失 | `transactions`, `bankAccounts`, `members` |

**P0 待修（3条）：** `transactionSplits` E1（allow read loId 字段缺失→跨 LO 数据泄露）；`notifications` E1（allow list resource.data→会员永远看不到自己的通知）；`notifications` E2（_writeNotification type 硬编码→通知静默失败）

**第二批高优先级扫描（2026-07-16）— P0×23 P1×101 P2×71 Total×195**

| 集合 | 分析日期 | 逻辑错误数（P0/P1/P2）| 变体不对称数 | 退回完整度 | 关键P0摘要 |
|------|----------|-----------------------|------------|-----------|-----------|
| `workflows` | 2026-07-16 | 13（1/8/4）| 4 | 缺失 | 重复触发无防护→数据重复写入 |
| `elections` | 2026-07-16 | 12（2/6/4）| 2 | 缺失 | 服务层为零（空壳）；双重投票无防护 |
| `toyyibBills` | 2026-07-16 | 12（2/6/4）| 3 | 部分 | webhook 重复回调二次创建交易；账单创建失败不回滚members字段 |
| `events` | 2026-07-16 | 11（2/7/2）| 4 | 部分 | 任意登录用户可删改任意活动；公开活动页永远空列表 |
| `points` | 2026-07-16 | 11（2/6/3）| 3 | 部分 | 任意用户可刷积分；审批通过积分从不发放 |
| `mentorMatches` | 2026-07-16 | 11（1/6/4）| 4 | 部分 | acceptMentorship 两步写入非批次 |
| `incentiveSubmissions` | 2026-07-16 | 10（2/6/2）| 3 | 缺失 | 直接updateDoc不触发loStarProgress更新；allow list resource.data失效 |
| `automationRules` | 2026-07-16 | 10（1/5/4）| 2 | 部分 | 规则触发自身→无限循环 |
| `tasks` | 2026-07-16 | 10（0/5/5）| 2 | 缺失 | — |
| `toyyibCategories` | 2026-07-16 | 10（0/5/5）| 2 | 缺失 | — |
| `contracts` | 2026-07-16 | 10（1/4/5）| 2 | 部分 | signContract 三步非批次→积分锁定但合约不存在 |
| `projects` | 2026-07-16 | 10（0/5/5）| 3 | 部分 | — |
| `pointEscrow` | 2026-07-16 | 9（2/4/3）| 4 | 部分 | 任意用户可创建/修改托管记录；signContract三步非批次 |
| `loStarProgress` | 2026-07-16 | 9（0/6/3）| 2 | 部分 | — |
| `achievements` | 2026-07-16 | 8（1/6/1）| 2 | 缺失 | awardAward三步无批次→永久数据不一致 |
| `incentivePrograms` | 2026-07-16 | 8（1/4/3）| 3 | 部分 | 多个program同时isActive=true |
| `votes` | 2026-07-16 | 8（2/3/3）| 2 | 缺失 | 重复投票无防护；选票明文存储 |
| `bounties` | 2026-07-16 | 8（2/4/2）| 0 | 缺失 | 服务层为零（空壳）；Firestore规则全开放 |
| `badges` | 2026-07-16 | 7（1/2/4）| 2 | 部分 | ruleExecutionService.awardBadge返回假成功→自动化颁奖全部静默失败 |
| `bankAccounts` | 2026-07-16 | 7（0/3/4）| 1 | 部分 | — |

**第三批扫描（2026-07-17）— P0×35 P1×123 P2×77 Total×235**

| 集合 | 分析日期 | 逻辑错误数（P0/P1/P2）| 变体不对称数 | 退回完整度 | 关键P0摘要 |
|------|----------|-----------------------|------------|-----------|-----------|
| `pointsRules` | 2026-07-17 | 10（4/4/2）| 2 | 缺失 | 集合无Firestore规则→全部静默失败；两套积分规则集合并存互不知晓；executeRules从不发放积分 |
| `conversations+messages` | 2026-07-17 | 9（2/4/3）| 2 | 缺失 | 任意用户可读所有私信；resource.data in list→对话列表永远为空 |
| `activityPlans` | 2026-07-17 | 10（2/6/2）| 3 | 缺失 | 任意登录用户可删改计划；8个方法查询PROJECTS而非ACTIVITY_PLANS集合 |
| `surveys+surveyResponses` | 2026-07-17 | 9（2/5/2）| 1 | 缺失 | resource.data in list→成员看不到自己的回复；无重复提交防护 |
| `documents+documentVersions` | 2026-07-17 | 10（2/5/3）| 2 | 缺失 | documentVersions无Firestore规则→版本历史全失败；任意用户可删治理文件 |
| `workflow_executions` | 2026-07-17 | 8（2/4/2）| 2 | 部分 | 任意用户可伪造执行记录；所有执行记录对所有登录用户可读 |
| `eventFeedback` | 2026-07-17 | 8（2/4/2）| 0 | 缺失 | 反馈含memberId对所有人可读；无重复提交防护 |
| `opportunityDrops` | 2026-07-17 | 5（2/2/1）| 0 | 缺失 | 完全无service层/类型/UI入口（死代码）；SUPER_ADMIN被硬编码排除写权限 |
| `inquiries` | 2026-07-17 | 7（2/3/2）| 0 | 缺失 | Inquiry类型导入但不存在→编译失败；API token存localStorage |
| `webhooks+systemLogs` | 2026-07-17 | 10（2/5/3）| 2 | 缺失 | 任意用户可写systemLogs伪造审计；webhook_logs同样无角色限制 |
| `certificates` | 2026-07-17 | 8（1/4/3）| 1 | 缺失 | 任意用户可直接SDK自颁证书，绕过课程完成校验 |
| `learningPaths+Progress` | 2026-07-17 | 9（1/5/3）| 4 | 缺失 | resource.data in list→成员无法列出自己学习进度 |
| `hobbyClubs` | 2026-07-17 | 9（1/5/3）| 2 | 缺失 | 任意登录用户可删改任何社团，无角色和归属权校验 |
| `sponsorships` | 2026-07-17 | 9（1/5/3）| 1 | 缺失 | financeService硬编码sponsorships:0→赞助收入完全隐形 |
| `advertisements` | 2026-07-17 | 9（1/5/3）| 2 | 缺失 | allow update无isAuthenticated→匿名用户可刷广告数据 |
| `publications+partnerships` | 2026-07-17 | 10（1/5/4）| 1 | 缺失 | partnerships读advertisements写partnerships→管理后台创建的记录用户端不可见 |
| `nudgeRules` | 2026-07-17 | 9（1/5/3）| 1 | 缺失 | nonMemberLeads allow create if true→匿名机器人可写任意内容 |
| `stock_movements` | 2026-07-17 | 7（1/4/2）| 2 | 部分 | BOARD可覆盖库存移动记录→审计日志可被篡改 |
| `guestRegistrations` | 2026-07-17 | 7（1/4/2）| 0 | 缺失 | 读后写无事务→并发双重报名 |
| `memberBenefits+benefitUsage` | 2026-07-17 | 6（1/3/2）| 2 | 缺失 | 写入路径service被移入trash→权益兑换完全无效 |
| `projectReports` | 2026-07-17 | 5（1/2/2）| 0 | 缺失 | 服务层完全缺失（空壳）；报告只在内存生成后丢弃 |
| `achievementAwards` | 2026-07-17 | 6（1/3/2）| 0 | 缺失 | achievementProgress无Firestore规则→未登录用户可读所有成就进度 |
| `badgeAwards` | 2026-07-17 | 9（1/5/3）| 2 | 部分 | ruleExecutionService捕获所有错误返回false→自动化徽章静默失败 |
| `trainingModules` | 2026-07-17 | 8（0/5/3）| 2 | 缺失 | — |
| `incentiveStandards` | 2026-07-17 | 8（0/5/3）| 2 | 部分 | — |
| `templates` | 2026-07-17 | 7（0/3/4）| 4 | 缺失 | — |
| `publicBusinessListings` | 2026-07-17 | 7（0/4/3）| 1 | 缺失 | — |
| `boardTermSettings` | 2026-07-17 | 5（0/3/2）| 0 | 完整 | — |
| `pointRules` | 2026-07-17 | 5（0/3/2）| 1 | 部分 | — |
| `businessProfiles` | 2026-07-17 | 6（0/3/3）| 1 | 缺失 | allow update检查new data.memberId而非existing owner→任意用户可冒充覆写 |

**第四批扫描（2026-07-17，system-scan-round2）— P0×14 P1×42 P2×23 Total×79**

| 集合 | 分析日期 | 逻辑错误数（P0/P1/P2）| 变体不对称数 | 退回完整度 | 关键P0摘要 |
|------|----------|-----------------------|------------|-----------|-----------|
| `flagship_projects` | 2026-07-17 | 7（1/4/2）| 0 | 缺失 | getAllProjects catch 回退 mock 数据→公开页显示假项目 |
| `promotionPackages` | 2026-07-17 | 5（0/3/2）| 1 | 缺失 | — |
| `maintenance_schedules` | 2026-07-17 | 7（1/4/2）| 1 | 部分 | createMaintenanceSchedule 单步 addDoc 不同步 inventoryItems.nextMaintenanceDate→两表日期永久不一致 |
| `inventory_alerts` | 2026-07-17 | 6（1/3/2）| 1 | 部分 | createAlert 写入 acknowledged 字段被 Firestore hasOnly 白名单拒绝→手动创建告警全部静默失败 |
| `pointsRuleExecutions` | 2026-07-17 | 7（3/2/2）| 1 | 部分 | 执行记录写入与积分发放非原子无回滚；allow create if isAuthenticated→任意用户污染统计；getDoc→setDoc 竞态→双倍积分 |
| `emailLogs` | 2026-07-17 | 7（1/4/2）| 0 | 缺失 | 无实际写入者（空壳）→集合永远为空，邮件发送无审计记录 |
| `guestPageStats` | 2026-07-17 | 7（0/4/3）| 0 | 缺失 | — |
| `promotionHistory` | 2026-07-17 | 7（2/4/1）| 0 | 缺失 | promoteToOfficialMember 三步非批次→会员角色已变但无历史记录；Firestore 规则不允许 MEMBER 读自己晋级记录 |
| `manualPromotionRequests` | 2026-07-17 | 9（2/5/2）| 1 | 缺失 | overrideRequirements 硬编码 true→提交即晋升绕过审批；两步写入非批次→申请记录与成员晋升状态永久不一致 |
| `auditLog` | 2026-07-17 | 8（2/4/2）| 1 | 缺失 | AuditLogService 从未调用（死代码）；无 Firestore 规则→所有审计写入全部静默失败 |
| `communication` | 2026-07-17 | 9（1/5/3）| 2 | 部分 | author.id 从未写入文档→会员永远无法自删自己的帖子 |

**第五批扫描（2026-07-19，remaining-collections）— P0×7 P1×23 P2×9 Total×39**

| 集合 | 分析日期 | 逻辑错误数（P0/P1/P2）| 变体不对称数 | 退回完整度 | 关键P0摘要 |
|------|----------|-----------------------|------------|-----------|-----------|
| `eventBudgets` | 2026-07-19 | 9（0/7/2）| 1 | 部分 | — |
| `achievementProgress` | 2026-07-19 | 9（2/5/2）| 1 | 缺失 | calculateAchievementProgress仅处理participation类型→所有其他成就永远current=0；allow read无所有者过滤→任意会员可读所有人进度 |
| `memberEmails` | 2026-07-19 | 8（1/5/2）| 0 | 部分 | updateMember允许修改邮箱但不更新memberEmails槽位→邮箱唯一性保障在编辑后彻底失效 |
| `toyyibpay_webhooks` | 2026-07-19 | 12（3/6/3）| 0 | 部分 | firestore.rules无规则块→任意登录用户可读幂等记录；webhook失败.catch(warn)静默→membership更新失败但标为processed；集合名硬编码非常量 |
| `birthdayNotificationsSent` | 2026-07-19 | 8（2/4/2）| 0 | 缺失 | 三套并行生日系统（Netlify+CF+客户端）互不协调→每位会员最多收3条重复通知；客户端每15分钟全量触发 |

**v4 全库重分析（2026-07-19，修复5集合后）— P0×90 P1×312 P2×191 Total×593（vs v3: 616，净减23）**

本次修复：callback.js P0×3、membersService.ts P0×1、App.tsx P0×1、eventsService.ts P1、firestore.rules 5集合。
Top P0集合：transactions×3、pointsRuleExecutions×3、conversations×3；退回完整度：完整1个（guestPageStats）、部分60个、缺失13个。
Firestore rules 5项修复已写入文件，**待执行 `firebase deploy --only firestore:rules` 生效**。

### 已分析集合（collection-deps）

| 集合 | 分析日期 | 联动集合数 | 强耦合 | 中耦合 | 弱耦合 | P0风险数 | P0风险摘要 |
|------|----------|-----------|-------|-------|-------|---------|-----------|
| `transactions` | 2026-07-16 | 10 | 3（`transactionSplits`, `members`, `projectTrx`）| 4（`paymentRequests`, `inventoryItems`, `notifications`, `reconciliations`）| 2（`financeAlerts`, `eventRegistrations`）+ 1 自引用 | 3 | rules `loId` 判断失效（全 LO 数据泄露）；`revertPaid` 非批次（PR 永久 Paid 但无交易）；删 Membership 交易不清 `members.transactionId[]` |

---

## CRUD 操作开发前置检查协议（Auto-enforced）

**每次新增或修改任何 Firestore 读写操作（Create / Read / Update / Delete），必须在动笔写代码前，逐项回答以下四组问题。这是强制步骤，不能跳过。**

### 写入前（Create / Update）

**联动写：**
- 这个操作写入集合 A 时，其他哪些集合需要同步写入？（例：创建 paymentRequest → 要不要同时写 notifications？）
- 这些联动写是否放在同一个 `writeBatch` 里？如果不是，中途失败会导致什么数据不一致？

**冗余字段同步：**
- 被更新的字段，在其他集合里有没有冗余副本？（例：更新 member.name → eventRegistrations.memberName 是否跟着改？）
- 如果有冗余副本，同步逻辑写在哪里？遗漏了会怎样？

**缓存清理：**
- 写完之后，必须调用哪些 `invalidateXxxCache()`？
- 有没有按 LO / 按状态分组的独立缓存键也需要一起清？（只清主键、漏清分组键 = 分组查询读到旧数据）

**前置校验：**
- 写入前是否需要验证状态合法性？（例：paymentRequest 必须是 `pending` 才能 approve，不能从 `rejected` 直接跳）
- Firestore 规则里有没有对应的字段白名单（`hasOnly([])`）或必填校验（`hasAll([])`）？

### 删除前（Delete）

**孤儿风险：**
- 删除这条记录后，哪些其他集合里还有指向它 ID 的字段？（在 `types.ts` 里搜本集合的 `xxxId` 字段出现在哪些其他类型里）
- 这些关联记录应该：级联删除 / 软标记为已删除 / 保留但断开引用？
- 删除前是否需要先检查"这条记录是否仍被引用"？（例：删除 bankAccount 前先查是否有未结算 transactions 指向它）

**退回路径：**
- 删除操作可以撤回吗？（软删 vs 硬删）
- 如果用软删（`isDeleted: true`），所有读取这个集合的查询是否都过滤了软删记录？

### 任何写操作的通用规则

| 规则 | 要求 |
|------|------|
| 多文档写入 | 必须用 `writeBatch`，绝不分开发送 |
| 缓存清理 | 每个写路径（包括 batch 变体）都必须调用 `invalidateXxxCache()` |
| 错误处理 | 失败必须通过 `errorLoggingService` 记录，不能静默吞掉 |
| 副作用顺序 | 主文档写入成功后再触发副作用（通知、积分、同步），不能先触副作用再写主文档 |
| Firestore 规则同步 | Service 层的权限判断改了，对应的 `firestore.rules` 必须同步改 |
| Dev 模式路径 | 新增的 service 方法必须有 `isDevMode()` 检查和 mock 数据返回 |

### 变体对称检查

如果这个操作有"单个版"和"批量版"（或多个入口），两者必须对称：
- 权限守卫相同？
- 退回机制相同？
- 联动写相同？
- 缓存清理相同？

不对称 = 修好了一个入口，另一个入口还有洞。

---

### Firestore 权限规则注意事项

- `resource.data` **不能**用于 collection-level list/query 规则（仅 document-level get 可用）。批量扫描/迁移规则必须在最前加 `isAdmin() ||` 绕过 resource.data 检查。
- `allow read` 与 `allow update` 是独立的门。迁移操作（scan = read + migrate = update）两条规则都必须独立加 `isAdmin()`。
- `Transaction` 集合无 `loId` 字段，LO 归属通过 `bankAccountId → bankAccounts.loId` 间接表达。
