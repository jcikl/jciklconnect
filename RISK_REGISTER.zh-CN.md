# JCI KL 风险清单

生成时间：2026-08-24。来源：对当前代码库进行只读扫描。

2026-10-12 更新：根据 `CAPABILITIES.md` 扫描结果（commit `9f36b73`）新增 R-018 至 R-024，原有条目未改动。

2026-10-12 更新：新增 R-025 至 R-027。

2026-10-18 更新：第一轮核实（权限与规则）新增 R-028 至 R-041，见文末。

严重级别：P0 严重，P1 高，P2 中，P3 低。

## P0 风险

### R-001 仓库中存在潜在敏感文件

证据：根目录存在 `.env` 和 `serviceAccountKey.json`；`netlify.toml` 也提示 Firebase 和第三方密钥必须放在服务端环境变量。后续只读检查显示 `.env` 和 `serviceAccountKey.json` 当前被 `.gitignore` 忽略，并且没有出现在 `git ls-files` 中；但尚未检查 Git 历史和外部分享记录。

风险：如果这些文件曾被提交、复制、上传或截图外泄，可能导致 Firebase Admin、第三方 API 或生产数据被攻破。

建议行动：

- 检查 `.env` 和 `serviceAccountKey.json` 是否曾出现在 Git 历史。
- 如有外泄可能，立即轮换相关凭据。
- 在 CI 中加入 secret scanning。
- 生产和本地密钥统一通过 Netlify/Firebase 环境变量或被 ignore 的本地文件管理。

### R-002 授权逻辑分散在 UI、Firestore Rules 和 Functions

证据：`usePermissions.ts`、`rolePermissions.ts`、`firestore.rules`、Netlify Functions 都实现了角色判断。

风险：某个角色变更可能在 UI 允许、Rules 拒绝，或 Rules 允许、Function 拒绝/过度放行。对会员 PII、财务、支付、导入导出、管理员函数尤其危险。

建议行动：

- 建立权限矩阵：每个模块对应 UI 权限、Firestore Rule、Function 授权。
- 为 PII、财务、会员编辑、导入导出、webhook、system config 增加 Firestore Rules 测试。
- 所有特权 Netlify Function 必须验证 Firebase ID token，并在服务端检查角色。

### R-003 `members` 根集合读取面偏宽

证据：`firestore.rules` 允许 active member 读取 `members`；注释中也提到 PII 和 loId 过滤限制。

风险：Active member 可能读到超过预期的会员资料。客户端过滤不是安全边界。

建议行动：

- 将公开会员目录字段与敏感会员资料拆分，或通过服务端读取敏感数据。
- 重新审查 `members` rule 与实际 PII 字段。
- 添加测试证明 `GUEST`、`MEMBER`、`BOARD`、`ADMIN`、`INACTIVE` 只能读写预期数据。

## P1 风险

### R-004 Workflow/Automation 引擎重复

证据：`automationService.ts`、`workflowService.ts`、`functions/src/automation.ts` 都有 workflow execution 概念。

风险：多套实现会逐渐漂移，导致幂等、重试、状态、webhook、权限行为不一致。

建议行动：

- 选择唯一 canonical workflow engine。
- 其他实现标记为 deprecated 或 adapter-only。
- 特权 step execution 移到服务端。
- 增加 workflow 状态机测试：重复触发、卡住执行、取消、重试、嵌套深度。

### R-005 浏览器端 Webhook 执行已知不完整

证据：`webhookService.ts` 明确说明浏览器端 HTTP 会受 CORS 阻挡，服务端签名尚未实现。

风险：Webhook 可能失败、静默失败或没有签名。如果未来用于生产自动化，会不可靠且不安全。

建议行动：

- 将 outbound webhook delivery 和 HMAC signing 移到 Netlify Function。
- Webhook secret 只保存在服务端。
- 增加投递日志、保留期限和重试上限。

### R-006 两套服务端运行时造成运维漂移

证据：同时存在 Netlify Functions 与 Firebase Cloud Functions，两者都使用 Firebase Admin。

风险：部署、环境变量、授权 helper、日志、重试行为、依赖版本可能不一致。

建议行动：

- 按领域决定运行时归属。
- 抽取或规范化 shared auth/env helper。
- 维护 `SERVER_FUNCTIONS.md`，记录 endpoint、授权要求、环境变量、owner、写入数据。

### R-007 源码和文档存在编码损坏

证据：多个中文注释和字符串显示为 `å®...`、`â†’` 等乱码。

风险：用户文案、错误消息、注释和文档不可信；AI 工具可能误解并继续传播错误文本。

建议行动：

- 统一文件为 UTF-8。
- 先确认是终端显示问题还是文件内容实际损坏。
- 优先修复用户可见字符串。
- 在 CI 中加入新增/修改文件编码检查。

### R-008 `App.tsx` 过大，影响面高

证据：`App.tsx` 超过 100 KB，负责路由、模块注册、布局状态、角色模拟、搜索、通知、访客/登录切换和视图渲染。

风险：小的导航或权限修改可能影响大量无关模块。

建议行动：

- 拆出 module registry、authenticated shell、guest shell、sidebar config、route/view mapping。
- 增加访客路由和登录后模块访问 smoke tests。
- 在拆分前，将 `App.tsx` 修改视为高风险。

### R-009 Firestore Rules 大且集中

证据：`firestore.rules` 约 78 KB。

风险：规则变更难 review，字段级规则容易与 TypeScript service 写入形状漂移。

建议行动：

- 增加 Firestore emulator tests。
- 按领域组织规则注释和 collection inventory。
- 每个写入密集型 service 都维护 service-to-rule 字段白名单清单。

### R-010 客户端直写 Firestore 强依赖 Rules 正确性

证据：`services/` 下多数服务直接调用 Firestore。

风险：如果 Rules 放得过宽，业务不变量可能被绕过。

建议行动：

- 将每个写操作分类为 client-safe 或 server-only。
- 财务审批、角色变更、批量导入导出、webhook delivery、不可逆删除优先迁移到服务端 command。
- 规则简单的读/list 可以继续客户端执行。

### R-018 两套互不兼容的结构写入同一个 `pointsRules` 集合

证据：`services/pointsService.ts`（`PointRule`：`category`、`basePoints`、`active`、`priority`；方法 `getPointRules` / `savePointRule`，约 L653–819）与 `services/pointsRuleService.ts`（`types/gamification.ts` 的 `PointsRule`：`trigger`、`pointValue`、`enabled`、`weight`）都读写 `COLLECTIONS.POINTS_RULES`（`pointsRules`）。`pointsRuleService` 目前没有任何地方引用。

风险：同一集合可能存在两种结构的文档。如果有人（或 AI 搜索时"找到"它）重新接上 `pointsRuleService`，会读到缺字段的文档，并写入现行引擎无法评估的规则，导致积分静默算错。

建议行动：

- 先确认正式环境的文档是哪一种结构。
- 指定一个标准 service 与类型；另一个在文件头标记 `@deprecated`。
- 确认数据前不要删除；补一个用真实结构规则文档的测试。

### R-019 银行对账 / 交易配对有三套重叠实现

证据：`financeService.ts`（`reconcileBankAccount`、`getUnmatchedForReconciliation`、`matchTransactions`、`unmatchTransactions`，约 L3810–4222）、`eventPaymentMatchingService.ts`（`runAutoMatch`、`applyMatch`、`removeMatch`）、`reconciliationService.ts`（861 行，`executeAutoMatch`、`manualMatch`、`unlinkMatch`；无人引用）。

风险：与 R-004 同一模式。配对状态会因为走不同 UI 入口而按不同规则写入；修好一条路径，其他路径照旧。新的财务需求很可能再写出第四套。

建议行动：

- 画出哪个 UI 入口调用哪一套实现。
- 选定一个标准配对引擎，并把决定写进 `ARCHITECTURE.md`。
- 将 `reconciliationService.ts` 标记为 deprecated 或 planned；决定之前不要开发新的配对功能。

## P2 风险

### R-011 测试覆盖与业务规模不匹配

证据：只发现 8 个测试文件，主要是属性测试和工具测试。

风险：登录、会员晋升、财务审批、ToyyibPay callback、Zoom booking、自动化执行等高价值流程可能回归而未被发现。

建议行动：

- 为纯业务规则增加单元测试。
- 增加 Firebase emulator/rules tests。
- 为 Netlify Functions 增加 integration tests，并 mock Firebase Admin 与第三方 API。
- 增加 Playwright smoke tests。

### R-012 集合常量中存在死亡或半成品功能

证据：`BUSINESS_PROFILES` 明确标记为 dead code；多个 feature collection 注释显示 TODO 或 partial implementation。

风险：AI 工具可能基于废弃概念继续开发，制造重复模块。

建议行动：

- 建立 feature inventory，状态包括 active、partial、deprecated、planned、dead。
- 确认没有生产数据依赖后，删除或隔离 dead constants。

### R-013 Data Import/Export 存在已知 enforcement TODO

证据：`dataImportExportService.ts` 注释提到 bulk import 会跳过 memberEmails dedup slots，且角色 enforcement 需要服务端处理。

风险：批量导入可能绕过正常会员创建约束、去重槽或权限检查。

建议行动：

- 将 bulk import 写入移到服务端 function。
- 复用 canonical member write path。
- 增加 dry-run validation 和 audit logs。

### R-014 多 LO 只完成部分设计，未完全强制

证据：`DEFAULT_LO_ID = 'jcikl'`；注释提到多 LO 与 loId 过滤限制。

风险：未来扩展多 LO 时，可能因单租户假设造成跨 LO 数据泄露。

建议行动：

- 增加 multi-LO readiness checklist。
- 新集合必须定义 tenant fields 与 rule filters。
- 启用多 LO 前，用至少两个 LO ID 写测试。

### R-015 源码和生成文件混在一起

证据：`functions/lib/*.js` 与 `.map` 和 `functions/src/*.ts` 同时存在；git status 显示 source 和 generated output 都有修改。

风险：review 噪音增加，生成文件可能与源码漂移。

建议行动：

- 决定 `functions/lib` 是否作为提交产物。
- 如果提交，则 commit 前必须 build 验证。
- 如果不提交，则 ignore 生成产物并从构建结果部署。

### R-020 工具函数在元件内被重复实现

证据：`getInitialsSvg` 被定义了 10 次，默认尺寸有 5 种（36/44/48/64/200），分布在 Members、Communication、HobbyClubs、BusinessDirectory、`components/ui/AvatarUploader.tsx`、`components/layout/SearchDropdown.tsx`。`formatCurrency`、`formatDate`、`formatDateTime`、`isFuture` 已存在于 `utils/formatUtils.ts` / `utils/dateUtils.ts`，却在 6 处被重写。见 `CAPABILITIES.md` §1.1–1.2。

风险：头像和日期显示不一致；每个 bug 要修 N 次；AI 会照抄它最先打开的那份本地版本。

建议行动：

- 在 `utils/` 建立唯一的 `getInitialsSvg(name, size)`，并附单元测试。
- 每个文件作为一个小任务逐一替换（外科手术式），不要一次大扫除。
- 由 CLAUDE.md 的复用闸门把关。

进度（2026-10-12）：已建立 `utils/avatarUtils.ts` 的 `getInitialsSvg` 并附测试；`components/ui/AvatarUploader.tsx` 已替换。使用 `btoa` 的副本遇到非拉丁字符（例如中文名）会抛出 `InvalidCharacterError`；标准版改用 `encodeURIComponent`。剩余 9 份副本。

### R-021 未被使用的模块看起来像真实功能

证据：以下文件没有任何引用：`services/pointsRuleService.ts`、`services/projectAccountsService.ts`、`services/reconciliationService.ts`、`services/workflowService.ts`（见 R-004）、`hooks/useGuestAnalytics.ts`、`hooks/useMemberBenefits.ts`、`hooks/useMemberMutations.ts`、`hooks/useNotifications.ts`。注意：`hooks/useCommunication.ts:10` 有一条 `TODO (P2-DEDUP)`，说明它与 `useNotifications` 重复抓取通知。

风险：开发者和 AI 不是从零再造一次，就是在不知道状态的情况下接上过时代码。

建议行动：

- 每个文件加状态头：`@status active | deprecated | planned | dead`（延伸 R-012 的功能清单）。
- 处理 `useCommunication` / `useNotifications` 的 TODO：改为复用 `useNotifications`。
- 每次状态变更后重新生成 `CAPABILITIES.md`。

### R-022 元件绕过 service 层

证据：10 个元件文件直接 import `firebase/firestore`，包括 `MembersView.tsx`、`Members/MemberDetail.tsx`、`Finance/TransactionSplitModal.tsx`、`ProjectManagement/ProjectFinancialAccount.tsx`、`Toyyib/ToyyibSettingsPanel.tsx`。见 `CAPABILITIES.md` §1.3。

风险：这些读写绕过了 `isDevMode`、缓存、缓存清理、`writeBatch` 和错误记录规则；在 `services/` 里搜索也看不到它们。加重 R-010 的风险。

建议行动：

- 不再新增直接 import（CLAUDE.md §5.1）。
- 每个文件单独作为一个任务迁移到现有 service / hook，从财务与会员写入开始。

### R-025 类型检查不在构建流程内

证据：`npm run build` 只执行 `vite build`；`tsc --noEmit`（`npm run typecheck`）报告现有类型错误。当前数量：见 CLAUDE.md §3 第 ⑤ 步的基线。

风险：类型错误会悄悄累积；旧指引声称 build 就是类型检查关卡，AI 因此把 build 通过当成类型安全。

建议行动：

- 错误数不得高于基线（CLAUDE.md §3 ⑤）；修掉错误后同步调低基线。
- 错误数归零后，把 `typecheck` 纳入 build 或 CI。

## P3 风险

### R-016 既有架构文档有价值但陈旧/乱码

证据：`_bmad-output/architecture.md` 存在，但较旧且编码损坏。

风险：未来 AI 工具可能把旧规划当作当前实现。

建议行动：

- 根目录 `ARCHITECTURE.md` 作为当前实现地图。
- 历史规划文档明确标记为 planning/history。
- 所有架构文档加入日期和状态头。

### R-017 Codegraph 尚未初始化

证据：Codegraph 工具报告项目未初始化。

风险：未来架构分析和影响面分析会更慢、更不精准。

建议行动：

- 准备好后运行 `codegraph init -i`。
- 高风险重构前使用 Codegraph 做 impact analysis。

### R-023 本机过程文件被提交到仓库根目录

证据：根目录有一个名为 `C:UsersUser...scratchpadtsc_errors.txt` 的文件（Windows 本机暂存路径被压平成文件名）。

风险：泄露本机路径、增加噪音，也说明 AI 的输出没有被约束边界。与 R-015 相关。

建议行动：

- 删除该文件。
- 在 `.gitignore` 加入 `*tsc_errors*.txt` 与 scratchpad 相关规则。

### R-024 AI 指引与代码脱节

证据：旧版 `CLAUDE.md` 提到不存在的 `workflowExecutionService`，并把 `types.ts` 描述为约 2000 行（现在只是 `types/` 的 barrel 文件）。52 个 service / hook / util 没有文件头说明，因此 `CAPABILITIES.md` 中显示为「⚠️ 无说明」。

风险：AI 会自信地照着过时指引做事。与 R-016 相关。

建议行动：

- 事实只放一处（见 CLAUDE.md §6）；每个改动 export 的 PR 都重新生成 `CAPABILITIES.md`。
- 逐步为这 52 个文件补上一行 `/** 职责 */` 文件头。

### R-026 Pagination 重新导出造成循环 chunk 依赖

证据：`vite build` 警告：`components/ui/Pagination.tsx` 的 `Pagination` 经由 `components/ui/Common.tsx` 重新导出，两个模块互相依赖却被分到不同 chunk，形成 chunk 之间的循环依赖。警告指出应修改的引用方是 `components/modules/Projects/ProjectsListShell.tsx`。

风险：Rollup 提示这"很可能导致执行顺序错误"；加载顺序问题只会在生产环境的 chunk 中出现。

建议行动：

- 把 `ProjectsListShell.tsx` 改为直接从 `components/ui/Pagination` import `Pagination`。
- 确认 `vite build` 不再出现该警告。

### R-027 getInitialsSvg 未对首字母做 XML 转义

证据：所有 `getInitialsSvg` 副本（包括标准版 `utils/avatarUtils.ts`）都把首字母直接插入 SVG 标记。

风险：名字以 `&` 或 `<` 开头时会生成无效 SVG，备用头像静默显示失败（不会报错）。

建议行动：

- 在标准版 `utils/avatarUtils.ts` 中转义 `&`、`<`、`>` 并补单元测试；其余副本按 R-020 迁移后自动获得修正。

## 2026-10-18 第一轮核实新增（权限与规则）

来源：对仓库内 `firestore.rules` 与代码的只读核对。线上规则已于同日由用户从控制台提供，经指纹比对确认为 commit `d8282b0`（2026-09-10）的版本：其后的 `b83d671`（允许代他人提交付款申请）和 `65599ca`（删除 certificates / nudgeRules 规则）尚未部署。以下各项涉及的规则段落线上与仓库一致，因此在线上同样存在；「被拒绝」类问题修复前仍须在模拟器里复现。

### R-028 规则与代码的数据结构脱节，关键写入可能被拒（P0）

证据：

- 对账：`transactions` 的 update 白名单（`firestore.rules` 约 L349–360）没有 `reconciliation` 字段，而 `services/financeService.ts:4198–4213` 等处写入 `reconciliation.*`；规则注释 L343 说管理员可绕过，但代码里已没有这个绕过。
- 新用户自助注册：`hooks/useAuth.tsx:486–518` 写入 `others`、`tier`、`points`、`jciCareer`、`skills` 等字段，超出 `members` create 白名单（L162–166）。
- 会员自改资料：规则 L178 要求顶层有 `name`、`email`，但资料现在存在 `general` / `contact` 里。

风险：对账配对、自助注册、会员改资料（含开启推送）会被拒绝。

2026-10-18 模拟器复现（Firestore 模拟器加载线上同版规则 `d8282b0`，按代码实际写法写入；脚本在会话临时目录，未入库）：

- 自助注册：代码实际写入的字段 → 被拒绝；只写白名单字段 → 通过。
- 对账配对：财政（当届 Treasurer）和 ADMIN 都被拒绝；改用规则认可的旧字段名 → 通过。
- 会员改电话：资料只有 general / contact 嵌套结构 → 被拒绝；资料另有顶层 name / email → 通过。线上会员资料是哪种结构尚未确认。

进展（2026-10-18，规则已改，待用户部署）：(1) `transactions` 白名单加入 `reconciliation` 和作废字段（`voidedAt` / `voidedBy` / `voidReason`；作废此前对所有交易都失败）；新增「解锁」规则，财政 / 管理员可把已对账交易改回未对账，但只能动对账相关字段，金额等业务字段仍锁死；已对账交易只有管理员可作废。(2) 自助注册允许注册表单写入的字段，但积分、等级、徽章等只能是默认值，`jciCareer` 只能有 `joinDate`，防止访客把自己写成理事或财政。(3) 会员自改资料时，name / email 在顶层或 `general` / `contact` 里都认。模拟器测试 27 项全部通过（含 12 项安全检查），R-034 的 21 项回归测试照样通过；同一套测试用线上现行规则（`047b450`）跑，11 项本该通过的操作全部被拒，证明测试有效。未处理：被邀请的导入会员首次登录时复制资料仍会被拒，改由「导入时直接建 Auth 账号」新功能解决（见 TODO）。

建议行动：先确认线上规则版本；在模拟器里复现三条写入；再一次性修正白名单。

### R-029 任何登录用户都能改写 counters（P0）

证据：`firestore.rules` L1163–1168 只要求登录、字段为整数 `value`；`services/paymentRequestService.ts:66` 用它生成付款申请编号。

风险：把计数器改小会让两张付款申请拿到同一编号。

建议行动：限制只能递增（`request.resource.data.value == resource.data.value + 1`），或改由服务端生成编号。

### R-030 访客或普通会员可整批读取、伪造敏感记录（P1）

证据：

- GUEST 可列出全部 `toyyibBills`（L1237）、`paymentRequests`（L458）；会员可列出全部 `eventRegistrations`（L523）、`inquiries`（L726）、`surveyResponses`（L617）。
- `toyyibBills`、`eventRegistrations` 的 create 没有字段白名单，可自带「已付款」状态。
- GUEST 可给任何会员创建通知（L569–576）；会员可整份改写活动 / 项目的出席名单（L251–254、L269–272）。
- `events` / `projects` 列表对未登录者开放，包括草稿（L245、L263）。

风险：缴费、报销、问卷等个人资料外泄；付款状态和通知可被伪造。

建议行动：列表规则改为「只能查自己的」（`resource.data.memberId == request.auth.uid`，查询带同样条件即可通过）；create 加白名单。

### R-031 任何理事都能批准付款申请，包括自己的（P1）

证据：`firestore.rules` L482–485。

风险：职责不分离，理事可以自己批准自己的报销。

建议行动：批准限财务操作员，并禁止 `approvedBy == applicantId`。

### R-032 会员自助缴费的批次写入会被拒（P1）

证据：`services/toyyibService.ts:215–223` 在同一批次里写账单和更新 `toyyibCategories`，而后者只允许理事写（L1226）；调用方是 `hooks/useToyyibPayment.ts:70`、`:123`。

风险：会员已在 ToyyibPay 付款成功，系统里却没有账单记录。

建议行动：把类别更新移到服务端，或从会员流程中拿掉。

### R-033 手机推送发不出去（P1）

证据：令牌写在 `members`（`services/notificationService.ts:51`），服务端却到 `users/{id}` 找（`functions/src/notifications.ts:321`、`netlify/functions/birthday-notifications.mjs:35`）。

风险：生日、活动等推送全部失效且没有报错。

建议行动：统一令牌存放位置；与 R-028 的会员自改资料问题一起验证。

进展（2026-10-18，代码已改，待部署）：新增 `netlify/lib/firebaseAdmin.mjs`，`birthday-notifications.mjs` 和 `send-push-test.mjs` 改为从 `members` 读令牌。同时修正生日推送的收件人条件：原查询用 `status == 'active'`，但现在的会员资料没有顶层 `status`，新会员永远查不到；改为按角色筛选（MEMBER / BOARD / ADMIN / SUPER_ADMIN，排除已删除和旧数据中 `status: inactive`），名字改读 `general.name`。模拟器验证：无密钥调用返回 401；访客、停用、已删除会员被排除；令牌取自 `members`；同一天重复运行不重复发送。注意：会员要能保存令牌，还取决于 R-028 的会员自改资料问题。

### R-034 规则漏掉了 SUPER_ADMIN（P1）

证据：`canReadOrgMembers`（L94–102）只列 ADMIN、BOARD；多处写死 `role in ['BOARD','ADMIN']`（notifications、inquiries、webhooks、benefitUsage、mentorMatches、`storage.rules` L22、L28）；`resourceInMyLo` 在没有 `loId` 时返回 false（L115–118、L208）。

风险：最高管理员（非当届理事时）不能新增会员、删除报名或会员。

建议行动：统一改用 `isAdmin()`，并补规则测试。

进展（2026-10-18，规则已改，待用户部署）：`canReadOrgMembers()` 和 11 处写死的 `['BOARD','ADMIN']` 都补上 SUPER_ADMIN（只加 SUPER_ADMIN，不扩大到其他角色）；删除会员时 SUPER_ADMIN 不受分会限制；`storage.rules` 的 `isBoard` / `isAdmin` 同步补上。模拟器测试 21 项全部通过：SUPER_ADMIN（含没有分会的）可以给他人签到、代报名、取消报名、删除报名、读写他人通知、读会员邮箱占位、删除会员；MEMBER 仍全部被拒；其他分会的 ADMIN 仍不能删除本分会会员；ADMIN、BOARD 的签到不受影响。同一套测试用线上旧规则跑，SUPER_ADMIN 各项都被拒绝，证明测试有效。部署时会一并上线用户已同意的 `b83d671`（代他人提交报销，已测试：BOARD 允许、MEMBER 拒绝）和 `65599ca`。回滚：重新部署 `d8282b0` 版规则。

### R-035 后台权限配置不生效（P1）

证据：Config → Access 页面写入 `userRolePermissions`、`positionPermissions`、`membershipTypePermissions`、`permissionCatalog`，但 `hooks/usePermissions.ts`、`firestore.rules` 和所有函数都不读这些表；两边连权限名称都不是同一套（`members.view` 对比 `canViewMembers`）。来源 commit `81a56be`。`SCHEMA.md:2342`、`SCHEMA-PERMISSIONS.md:122–124` 的描述与实际不符。

风险：管理员以为自己改了权限，实际上没有任何变化。

建议行动：短期在页面标明「暂不生效」或隐藏该页；是否真正接入（极高风险）另行决定。

### R-036 读取和写入范围偏宽的其他规则（P2）

证据：

- 任何登录用户可读：`points`（L546）、`mentorMatches` 列表（L963）、`achievementProgress`（L1337）、`benefitUsage`（L827）等。
- 无白名单的 create：`errorLogs` L1191、`emailLogs` L1291、`activityPlans` L809、`mentorshipFeedback` L988、`publicBusinessListings` L1180、`contracts` L1052。
- 计数字段可设任意值：`advertisements` L773–775；`guestPageStats` L1212，而且不需要登录。
- 功能已删除但规则还在：`nonMemberLeads`（公开可写）、`businessProfiles`；已删除集合的索引还在（`firestore.indexes.json` L970、L988、L1334）。
- `services/documentsService.ts:343` 对 Cloudinary 网址调用 `storageRef` 会同步抛错，可能导致删除文档失败。

建议行动：随 R-030 一起收紧；清理残留规则和索引。

### R-037 规则相关文档有误（P3）

证据：`CLAUDE.md` §5.3 写「`resource.data` 不能用于 list/query 规则」，实际上只要查询自带相同条件就可以用；`docs/PERMISSION_MATRIX.zh-CN.md` L96、L130、L199 仍列出已删除的集合。

风险：AI 按错误说法把列表规则放宽，正是 R-030 的成因之一。

建议行动：修改 `CLAUDE.md` 须所有者批准（CODEOWNERS）；矩阵文档随 R-030 修复一起更新。

### R-038 Cloud Functions 一个都没有部署（P1）

证据：2026-10-18 用有权限的账号运行 `firebase functions:list`，结果为「No functions found」；Firebase 环境信息显示项目未开启计费（Spark 方案无法部署 Cloud Functions）。`functions/src` 里的所有函数（会员自动晋升、会费续费与提醒、生日推送、活动提醒、徽章 / 成就 / 自动化触发器、财务校验）在线上都没有运行。

风险：依赖这些函数的自动功能静默失效，例如每年 10 月自动发起会费续费、每年 1 月会费提醒、`members` 更新后自动晋升。线上目前只有 Netlify Functions 在跑；生日推送的 Netlify 版本要靠外部定时器调用，是否配置了外部定时器也未确认。

建议行动：盘点哪些自动功能是业务真正需要的；决定是开启计费并部署，还是把需要的功能迁到 Netlify（与 R-006 一起决定）；把未部署的函数从文档中标注清楚，不再当作线上能力。

进展（2026-10-18）：用户决定迁到 Netlify、不开计费。已完成（代码已改，待部署）：生日推送修复（见 R-033）；新增 `netlify/functions/annual-dues-reminders.mjs`，取代 `sendAnnualDuesReminders`，每年 1 月 1 日 10:00（马来西亚时间）运行，同一年重复运行不会重复提醒，也不会让已处理的 WhatsApp 横幅重新出现。会费记录改读 `jciCareer.membershipDuesHistory`，兼容旧的 `membership`。待做：签到积分（R-039）、标记 `functions/` 停用。

### R-039 会员活动签到拿不到个人积分（P1）

证据：`services/eventsService.ts:765–768` 删掉了签到时发积分的调用，注释说改由 Cloud Function `onEventRegistrationUpdate` 发放；但这个函数从未被 `functions/src/index.ts` 导入，所以即使开通计费也不会部署，而且它本身也不写 `points`。

风险：签到后个人积分不增加，积分排行和激励计算偏低，且没有任何报错。

建议行动：在网页端签到流程恢复调用 `PointsService`，并删除那条错误注释（见 Netlify 迁移计划 P4）。

进展（2026-10-18，代码已改，待部署）：`EventsService.markAttendance` 在签到批量写入成功后调用 `PointsService.awardEventAttendancePoints`（固定文档 ID，重复签到不会重复加分）；加分失败只记录错误，不撤销签到，与 `undoAttendance` 的处理方式一致。活动详情弹窗的「签到」原来只改状态（不加分、不更新出席名单，而且写入的 `checkedInByName` 不在规则白名单里，理事会被拒绝），现在改走 `markAttendance`，与弹窗的「撤销签到」对称。新增 `services/eventsService.markAttendance.test.ts`（4 个测试）。已知边界：撤销签到后再次签到不会再加分，因为固定 ID 的积分记录已存在，净积分为 0。

线上实测（2026-10-18，本机开发版连接正式 Firebase，经用户授权，用 PETER YU / BOARD 账号）：在活动「2026 JCI Malaysia National Convention」签到 → 报名状态变为 checked_in、进入出席名单、积分 507 → 517，生成 `points/{memberId}_{eventId}_attendance`（+10）；撤销签到 → 状态回到 registered、移出出席名单、积分回到 507、`pointsReversed: true`。同一测试中证实 SUPER_ADMIN（非当届理事）给他人签到、代报名、取消报名都被规则拒绝，即 R-034 在线上真实存在。

2026-10-18 部署 R-034 规则后复测（noreply / SUPER_ADMIN）：只读探测确认新规则已生效；给 PETER YU 签到成功（507 → 517）。撤销时发现既有 bug：`undoAttendance` 调用 `awardPoints` 扣分时没有传 `awardedBy`，积分服务的跨会员防护拒绝了扣分，而 `pointsReversed` 已经先被设为 true，结果分数没扣回、以后也不会重试（此前签到不加分，所以从未暴露）。已修：传入当前用户作为 `awardedBy`；扣分失败时把 `pointsReversed` 改回 false 并记录错误。新增 2 个单元测试；修复后复测撤销成功（517 → 507，扣分记录注明授权人）。三次测试的积分、通知和标记都已清理，PETER YU 恢复 507 分。

### R-040 大多数会员没有可用的登录账号（P0）

证据：导入的会员资料编号是随机生成的（`services/membersService.ts:609`），邀请函数建的登录账号也是随机 uid（`netlify/functions/send-invite.mjs:89`、`auto-invite.mjs:90`），首次登录时 `hooks/useAuth.tsx` 把资料复制到新 uid，但 `firestore.rules` 只允许自建 GUEST 资料，复制被拒。2026-10-18 用管理员凭证对线上做只读试跑：345 位会员中只有 8 位的登录账号 uid 等于会员编号；335 位没有登录账号；2 位（SHANE TEOH、SHIRLEY PANG）的邮箱有登录过的账号，但没有关联到会员资料。

风险：绝大多数会员无法登录使用系统。

建议行动：已实现（待部署）`netlify/functions/member-auth.mjs`：导入时为新会员建账号（uid = 会员编号），SUPER_ADMIN 在会员导入窗口用「Fix Auth」先试跑、再执行补建；登录时不再复制资料，改为提示联系管理员。部署后由 SUPER_ADMIN 执行 Fix Auth；上述 2 位需人工处理。注意：本地 `netlify dev` 运行用到 `firebase-admin/auth` 的函数会报错（`jwks-rsa` 4.1 用 require 加载 ES 模块 `jose` 6），现有的 `send-invite` 等也一样；线上是否正常取决于 Netlify 的 Node 版本，部署后先用 Fix Auth 的试跑确认。

结果（2026-10-18）：PR #3 预览版上 `member-auth` 正常加载（无令牌请求返回 401），试跑结果与本地只读脚本一致。随后 SUPER_ADMIN（noreply）在预览版执行 Fix Auth（与正式站共用同一 Firebase），未勾选替换孤儿账号、未发邮件：新建 337 个账号，8 个原已就绪，0 个错误，审计记录 4 条（`auditLog` action `member_auth_fix`）。复核：345 位会员全部有 uid = 会员编号的登录账号。SHANE TEOH、SHIRLEY PANG 原为「需人工处理」，执行时其邮箱下的旧账号已不存在（并非本功能删除：未勾选替换，且代码不删除登录过的账号），因此也被新建；旧账号由用户本人在 Firebase 控制台删除（2026-10-18 确认）。会员尚未设置密码：需用 Google 登录或「忘记密码」。

### R-041 付款流程写死了已停用的域名 app.jcikl.cc（P1）

证据：会员实际使用 `https://jciklconnect.netlify.app`，`app.jcikl.cc` 已无法连接（2026-10-18）。`netlify/functions/toyyibpay-api.mjs` 只接受 `app.jcikl.cc` 开头的付款跳回网址，否则改成 `https://app.jcikl.cc/payment/result`，所以会员付款后被带到打不开的页面；ToyyibPay 回调地址的默认值也是 `app.jcikl.cc`（线上已设 `TOYYIBPAY_CALLBACK_URL`，故未受影响）；判断正式环境用的是「URL 含 app.jcikl.cc」，导致正式站被当成非正式环境、也接受 localhost 跳回网址。另外网页端的跳回路径 `/payment-return` 和后备路径 `/payment/result` 在网站里都没有对应页面。

风险：会员付完款看到错误页面，可能以为付款失败而重复付款。

建议行动 / 进展（2026-10-18，代码已改，待合并部署）：新增 `netlify/lib/siteUrl.mjs`，用 Netlify 自带的 `URL` / `DEPLOY_PRIME_URL` / `CONTEXT` 判断本站网址与正式环境，不新增环境变量；跳回网址只接受本站（含预览版），否则改为「本站/payment-return」；回调默认值改为本站的函数地址；新增 `/payment-return` 页面（访客与已登录会员都能看到，按 `status_id` 显示成功 / 处理中 / 失败，只作提示，付款记录仍以服务端回调为准）。单元测试 11 项通过。其余 10 个函数的 CORS 白名单也只列了 `app.jcikl.cc`，因网页与函数同源暂不影响，另行处理。
