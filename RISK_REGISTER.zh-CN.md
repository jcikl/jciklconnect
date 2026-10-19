# JCI KL 风险清单

生成时间：2026-08-24。来源：对当前代码库进行只读扫描。

2026-10-12 更新：根据 `CAPABILITIES.md` 扫描结果（commit `9f36b73`）新增 R-018 至 R-024，原有条目未改动。

2026-10-12 更新：新增 R-025 至 R-027。

2026-10-18 更新：第一轮核实（权限与规则）新增 R-028 至 R-045，见文末。

2026-10-20 更新：Phase 1（外部会员）新增 R-059 至 R-072，审查修复新增 R-073 至 R-086，见文末（`phase1/integration`，尚未合并、尚未部署）。R-049 至 R-058（Phase 0）的中文版尚未补写，以 `RISK_REGISTER.md` 为准。

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

### R-042 线上付款函数因缺少 ToyyibPay 密钥无法启动（P0，已解决）

证据：2026-10-18 不带令牌请求正式站 `/.netlify/functions/toyyibpay-api` 返回 502，错误为 `TOYYIBPAY_SECRET_KEY env var not set`（函数启动时检查该变量，缺失即抛错）；PR #3、#4 的预览版相同。错误响应还把服务器内部的调用栈返回给了浏览器。

风险：所有经系统发起的网上缴费（会费、活动报名费）都无法建账单。

处理：用户于同日在 Netlify 补设 `TOYYIBPAY_SECRET_KEY`（沙盒）与 `TOYYIBPAY_SECRET_KEY_PROD`（正式）并重新部署；复测正式站返回 401（函数正常启动，进入身份检查）。注意：缺少 `systemConfig/toyyibpay` 设置时代码默认沙盒模式，正式收款前须确认模式为 Production。后续可考虑：函数启动时缺变量改为按请求返回 500 并记录日志，避免把调用栈返回给浏览器。

### R-043 付款通知函数缺少密钥无法启动；Sandbox / Production 开关从未生效（P0）

证据（2026-10-19）：
- GET 正式站 `/.netlify/functions/toyyibpay-callback` 返回 502，错误为 `TOYYIBPAY_WEBHOOK_SECRET env var not set`（函数启动时检查，缺失即抛错）。ToyyibPay 付款成功后的通知因此全部失败，账单不会被标为已付、交易不会生成；线上 `toyyibpay_webhooks`、`toyyibBills` 均为空。
- ToyyibPay 设置页的模式开关：网页端发送 `isSandbox: String(isSandbox)`（`services/toyyibService.ts:141`），服务端只接受 boolean（`toyyibpay-api.mjs` setMode），一律返回 400；所以 `systemConfig/toyyibpay` 从未写入，系统一直按默认值使用沙盒。切换成功后页面标签也不会刷新（`useToyyibMode` 只读一次）。

风险：网上缴费即使付款成功也不会入账；无法切换到正式收款。

处理：用户在 Netlify 补设 `TOYYIBPAY_WEBHOOK_SECRET`（Functions 作用域，Production + Deploy Previews）并重新部署，补好后 GET 应返回 405。代码修复（分支 `fix/toyyib-mode-switch`，待合并）：网页端发送真正的 boolean，服务端兼容 boolean 与 "true"/"false"，切到 Production 前检查正式密钥已配置；`useToyyibMode` 增加 `refresh()`，切换后重新读取模式。

同日追加：`public/_redirects` 只有一条 `/* /index.html 200`，而 Netlify 先执行该文件再执行 `netlify.toml`，所以 `netlify.toml` 里的 `/api/webhooks/zoom`、`/api/webhooks/toyyibpay`、`/api/toyyibpay` 三条接口转址从未生效，GET `/api/webhooks/toyyibpay` 返回首页 HTML（200）。ToyyibPay 线上用 `TOYYIBPAY_CALLBACK_URL`（函数直连地址）不受影响；Zoom 若在 Zoom 后台填的是 `/api/webhooks/zoom`，则通知一直未送达。修复：在 `public/_redirects` 的通配规则之前加入这三条转址（同一分支）。

### R-044 网页端建的 ToyyibPay 账单全部是假账单（P0）

证据：`config/constants.ts:142` 的 `TOYYIB_CONFIG.USER_SECRET_KEY` 固定为空字符串（密钥已移到服务端 `toyyibpay-api`，网页端本就不应持有），但 `services/toyyibService.ts` 的 `createBill` 仍以「密钥为空」为条件直接返回 `MOCK-xxxx` 假账单，不调用付款函数。2026-10-19 在正式站用 Manual Bill 建 RM1 沙盒测试账单，界面显示成功，但 ToyyibPay 与 `toyyibBills` 都没有任何记录。

风险：会员缴会费、活动报名费、手动建账单得到的付款链接全部无效；这是线上 `toyyibBills` 一直为空的根本原因。

处理（分支 `fix/toyyib-mock-bill`，待合并）：改为仅在开发模式（`isDevMode()`）返回假账单；新增 `services/toyyibService.createBill.test.ts`（2 项，撤掉修复后对应测试失败）。

### R-045 服务端过滤掉了 ToyyibPay 必需参数，真账单从未建成；付款人可改金额（P0）

证据（2026-10-19，修好 R-044 后在正式站建 RM1 沙盒账单）：ToyyibPay 先回「billName exceed limit. Max 30 length」，改短名称后回「billPriceSetting parameter is empty」。`toyyibpay-api` 的转发白名单 `CREATE_BILL_ALLOWED_PARAMS` 只含名称、描述、金额、付款人、分类，把 `billPriceSetting`、`billPayorInfo`、`billPaymentChannel`、`billExternalReferenceNo` 全部丢弃；服务端名称上限检查是 255 字，而 ToyyibPay 是 30 字（描述 100 字）。另外网页端发送的 `billPriceSetting` 是 `'0'`（付款人可自行修改金额）。

风险：即使没有 R-044，经系统也建不出真账单；修好后若照网页端的值转发，付款人可改金额。

处理（分支 `fix/toyyib-create-bill-params`，待合并）：新增 `netlify/lib/toyyibBill.mjs` 的 `buildCreateBillParams`：价格设置固定为 `1`（固定金额）、付款人资料固定为 `1`，付款方式只接受 0/1/2，放行外部参考编号，名称 / 描述按 ToyyibPay 上限截断，回调 / 跳回网址仍只由服务端决定。单元测试 5 项通过。

### R-046 付款通知被静默拒收：字段名不对，核对时又固定查沙盒（P0）

证据（2026-10-19，沙盒 RM1 付款 `4e9xc8va`、`lm6obyw3`、`wn0s7ywr`）：Netlify 日志在付款时段有 `toyyibpay-callback` 请求，但没有任何警告或错误，`toyyibpay_webhooks` 与交易记录始终为空。ToyyibPay 通知里付款编号的字段是 `refno`（另有 `status`、`billcode`、`order_id`、`amount`），处理程序却读 `transaction_id`（那是跳回网址才有的字段），所以每一笔真实通知都以 400「Missing required fields」结束，且不留日志。向 `getBillTransactions` 核对时也只看环境变量 `TOYYIBPAY_SANDBOX` 和沙盒密钥，不理会 `systemConfig/toyyibpay` 的系统模式；并且直接取账单的第一条记录，而不是与本次付款对应的那条。

风险：任何线上付款（会费、活动费、手动账单）都不会自动入账；切到正式模式后，核对会去查沙盒，真实付款会被拒。

处理（分支 `fix/toyyib-callback-refno`，待合并）：`netlify/lib/toyyibCallback.mjs` 兼容两种字段（`refno` / `transaction_id`），按付款编号、再按 order_id 选对应记录；`netlify/lib/toyyibMode.mjs` 集中处理模式、密钥、API 地址，`toyyibpay-api` 与 `toyyibpay-callback` 共用；通知按账单建立时记下的 `isSandbox`（新字段，与 `billExternalReferenceNo` 一起在建账单时写入）选择环境，没有则用系统模式；所有拒收情况都写日志（只记账单编号和原因）。单元测试 10 项通过。

后续（2026-10-19，R-046 上线后）：新加的拒收日志显示了真实的通知内容——ToyyibPay 以 `multipart/form-data`（表单上传格式）发送通知，处理程序却按普通表单解析，所有字段都读成空，沙盒账单 `g6e28dl6` 仍被拒收。分支 `fix/toyyib-callback-multipart`：`netlify/lib/toyyibCallback.mjs` 新增 `readCallbackBody`，可读取 multipart、普通表单、JSON 三种格式；新增 2 项测试（撤掉修复后失败）。

### R-048 会员重新整理页面后被登出（P1）

证据（errorLogs，2026-09 至 2026-10-19）：共 34 笔 `useAuth-load-member-data` 错误「Missing or insufficient permissions.」——真实会员 2026-09-23（手机，8 次）、2026-10-05（电脑）各有发生，2026-10-18/19 的测试面板也有，每次之后会员都显示为已登出。规则允许已登录用户读取 `members/{自己的 uid}`，说明读取请求送到 Firestore 时还没带上登录凭证：重新整理时 Firebase Auth 先报告已恢复的用户，Firestore 还没附上凭证。`useAuth` 把这个错误当成致命错误并清空登录状态。

风险：会员重新整理后随机被登出，需要重新登录。

处理（分支 `fix/auth-reload-signout`，待合并）：读取自己会员资料改经 `utils/retryOnPermissionDenied.ts`——遇到权限不足时先刷新登录凭证再重读（最多 2 次），期间保持「载入中」；真正没有权限的读取重试后仍会失败。单元测试 3 项；预览中连续重新整理 10 次均保持登录。上线后需确认 errorLogs 不再出现此错误。

## 2026-10-20 新增：Phase 1 外部会员

### R-059 自助注册丢失了表单收集的个人资料（P2，已解决）

证据：`components/auth/RegisterModal.tsx` 传的是平铺的 `fullName`、`phone`、`gender`、`dateOfBirth`、`nationality`，而 `hooks/useAuth.tsx` 的 `signUp` 只读 `additionalData.general.*` 和 `contact.phone`，这些值被无声丢弃。

风险：所有自助注册的 GUEST 资料都缺全名、性别、出生日期、国籍和电话。

处理（2026-10-20，`phase1/integration`）：新增 `components/auth/signUpExtras.ts` 的 `buildSignUpExtras`，把值放进 `general.fullName` / `gender` / `dob` / `nationality` 和 `contact.phone`，空值不写（Firestore 不接受嵌套的 undefined）；注册资料的构建函数移到 `utils/signUpPayload.ts`。测试：`tests/unit/signUpExtras.test.ts`、`tests/unit/signUpPayload.test.ts`。注册时仍不写 `birthdayMMDD`：`firestore.rules` 的 GUEST 创建白名单不允许。

### R-060 访客活动报名一直失败（P1，已解决）

证据：`EventsService.registerGuestForEvent` 的事务要先读 `guestRegistrations`，而未登录访客读不了（只有 board / admin 能读）；电话索引文档也不满足创建规则的必填字段检查。另外 `cancelGuestRegistration` 会写 `cancelledAt`，它不在更新白名单里，整个取消批次被拒绝。

风险：访客无法报名活动，board 也无法取消访客报名。

处理（2026-10-20，`phase1/integration`）：服务不再读取，用一个 `writeBatch` 按确定性 id 同时写主文档和电话索引文档；创建规则接受主文档形状（`status == 'Pending'`）或电话索引形状（`_indexFor == 'phone'`）；id 已存在时写入变成更新，访客无权更新，整个批次失败，表单提示「已报名」；更新白名单加入 `cancelledAt`，索引文档只能改 `status`。测试：`tests/rules/guestRegistrations.rules.test.ts`。`cancelGuestRegistration` 在应用里仍没有调用方。见 R-072。

### R-061 问卷提交只有 board 和 admin 能成功（P1，已解决）

证据：`SurveysService.submitResponse` 的事务要增加 `surveys.responsesCount`（`surveys` 更新规则原本只允许 board / admin），并先读自己尚不存在的回答 id（`surveyResponses` 的 get 规则读 `resource.data.memberId`，文档不存在时被拒绝）。

风险：会员和外部用户无法提交问卷回答。

处理（2026-10-20，`phase1/integration`）：`surveys` 更新规则允许任何能读该问卷的人只把 `responsesCount` 加 1 并更新 `updatedAt`；`surveyResponses` 的 get 在文档不存在时放行。规则测试复现了这两个失败。

### R-062 兴趣社群列表漏掉没有 isDeleted 字段的社群（P1，已解决）

证据：`HobbyClubsService.getAllClubs` 用 `where('isDeleted', '!=', true)`，这会同时丢掉没有 `isDeleted` 字段的文档；`createClub` 从不写这个字段，所以几乎看不到任何社群。

风险：KL 会员几乎看不到兴趣社群。

处理（2026-10-20，`phase1/integration`）：改为在代码里过滤软删除的社群并按名称排序，不改索引。单元测试用 Firestore 的 `!=` 语义复现了旧行为。

### R-063 活动「标记已付款」缺少 bankAccountId 时报错（P1，已解决）

证据：活动「Mark as paid」流程创建收入交易时没有 `bankAccountId`，而 `transactions` 创建规则要求有 `bankAccountId`。

风险：活动页面无法记录付款。

处理（2026-10-20，`phase1/integration`）：`services/eventPaymentService.ts` 的 `markRegistrationPaid` 自动选账户（项目的 `financialAccountId`，且它确实是本 LO 的银行账户；否则第一个 MYR 账户；再否则第一个账户；都没有则给出可读的错误），金额由财务确认（窗口预填 `price || priceMin`，见 R-080），报名状态更新失败时会把刚建的交易删掉。遗留问题见 R-070。

### R-064 国际目录用的是假数据，外部用户看不到 KL 名片（P2，已解决）

证据：`BusinessDirectoryView` 使用 `MOCK_SISTER_CHAPTER_MEMBERS`，姐妹会筛选没有作用在真实数据上；`MemberCardsService.getInternationalCards` 把 `loId == 'jcikl'` 的名片丢掉，外部用户看不到已开放名片的 KL 会员。

风险：目录显示的是假人，外部用户看不到 KL 名片，也看不到本分会的名片。

处理（2026-10-20，`phase1/integration`）：目录改经 `useSisterChapterMembers` 读取名片，删除假数据文件；外部用户得到 `international == true` 的名片（含 KL）加上本分会的名片，由 `mergeCards` 合并；`attachSisterChapters` 为 KL 提供固定的分会条目。测试：`tests/unit/internationalCards.test.ts`。

### R-065 Global Relations 的「移除成员」一直失败（P2，已解决）

证据：`MembersService.deleteMember` 里有一个客户端检查，管理员的 `loId` 与目标不同就拒绝，所以 KL 管理员无法移除姐妹会的文档，而 `members` 更新规则其实允许 `isAdmin()` 编辑任何 LO。

风险：无法在 Global Relations 里移除姐妹会的人。

处理（2026-10-20，`phase1/integration`）：`deleteMember` 增加一个很窄的例外（KL 管理员、`loId == 'jcikl'`、目标在其他分会）；这个检查只在客户端，规则没有改。Global Relations 现在对有登录账号的外部会员改为经 `external-accounts` 的 `setStatus` 停用（名片移除，登录和记录保留），只有没有登录的旧文档（role MEMBER、`loId` 不是 `jcikl`）才软删除。

### R-066 注册表单的邮箱预检查无法工作；自助注册的外部会员没有 memberEmails 槽位（P2）

证据：`RegisterModal` 的 `checkField` 调用 `netlify/functions/check-member-field.mjs` 时不带 `Authorization`，而该函数要求 BOARD / ADMIN / SUPER_ADMIN 令牌，并且查询的是 `members` 顶层的 `email` 字段（新文档的邮箱在 `contact.email`）；表单把没有 `exists` 的响应当成「可用」。`signUpExternal` 不写 `memberEmails`：该集合的创建规则只允许 B+。

风险：访客永远看不到「邮箱已被使用」的提示；自助注册的外部会员没有槽位，依赖槽位的重复检查（`MembersService.createMember`）看不到他们。`external-accounts` 还会检查 Firebase Auth，所以用同一邮箱邀请仍会被拒绝。

建议行动：把预检查换成不需要令牌的服务端检查，或者去掉；在批准时由服务端写入槽位。

### R-067 advertisements.targetAudience 从未被执行（P2，既有问题）

证据：`targetAudience` 由 `AdvertisementsView` 写入，只用于它自己的列表搜索，没有任何投放代码读取。Phase 1 新增的 `targetCriteria.audiences` 和 `targetCriteria.countries` 只有 `MemberBenefitsView` 经 `utils/benefitEligibility.ts` 读取；`roles`、`tiers`、`memberIds` 在那里同样没有被执行，其他广告展示位置未检查。`advertisements` 在 `firestore.rules` 里是公开可读。

风险：管理员选了等级或角色受众，以为会过滤，其实不会；对外部用户来说，受众检查只存在于福利页面。

建议行动：以 `audiences` / `countries` 作为唯一的投放条件，应用到所有广告位置；隐藏或删除不用的字段。

### R-068 外部用户的活动付款依赖财务人员自觉（P2）

证据：`EventDetailModal` 的 `handleMarkPaid` 会检查 `canOperateFinance`，但 `EventParticipantsTab`、`EventRegistrationsList`、`EventRoleParticipantsList` 里的「标记已付款 / 撤销付款」按钮没有按角色隐藏，`handleUndoPaid` 也没有角色检查；真正的门是规则（`transactions` 的创建和删除只有 Finance / admin）。外部用户看到的活动价格是同一个数字加美元符号，没有换算。「标记已付款」窗口现在把「实收金额（MYR）」预填为 `price || priceMin`，财务必须确认或修改（填 0 则不建交易），所以只有财务直接接受预填值时，美元报名才会被记成同样数字的马币。`transactions.currency` 已在类型里声明，但没有任何代码写它。

风险：部分角色会看到不该有的按钮；财务不留意地确认，会把美元价当马币记账。

建议行动：没有 `canOperateFinance` 的角色隐藏这些按钮；考虑为美元报名加入换算；写入或删除 `transactions.currency`。

### R-069 useEventParticipations 直接读 Firestore，并且读错了访客的姓名字段（P3）

证据：`components/modules/Events/useEventParticipations.ts` 引入了 `firebase/firestore` 并自己查询 `guestRegistrations`（分层违规，见 R-022），构建访客行时读 `data.general?.name`，而访客文档的姓名在顶层 `name`。规则里访客查询只有 board / admin 能做，并且和会员列表放在同一个 `Promise.all` 里。

风险：参与者列表里的访客行没有姓名；如果非 board / admin 的人能打开这个页签，被拒绝的访客查询会让整个列表加载失败。

建议行动：把查询移到 service 里，并读取 `name`。

### R-070 projects.financialAccountId 从未被写入；线下付款说明文字是占位符（P3）

证据：`services/`、`components/`、`hooks/` 里没有任何代码给项目文档写 `financialAccountId`（`EventPaymentService.resolveBankAccountId` 读取它，写入者只有假数据），所以标记已付款会退回到第一个 MYR 银行账户。`config/constants.ts` 的 `EXTERNAL_OFFLINE_PAYMENT_NOTE` 是一段全局占位文字，所有外部用户看到同一段。

风险：活动收入可能进错账户；外部用户拿到的是通用的付款说明。

建议行动：在项目层面加账户选择，并替换说明文字（或做成可配置）。

### R-071 external-accounts 无法在本地测试，也没有限流（P2）

证据：`netlify/functions/external-accounts.mjs` 用到 `firebase-admin/auth`，在本地 `netlify dev` 下会失败（见 R-040），所以第一次真正运行要在部署预览版上。它有每次调用 20 人、每个分会 100 个成员文档的上限，但没有限流；`chapter-birthdays.mjs` 也没有。现有的内存限流（`auto-invite`、`send-invite`）按函数实例计算，冷启动后清零。

风险：没有验证过的函数会创建 Auth 账号并发邮件；分会管理人的令牌被盗，可在上限内批量建账号。

建议行动：发布前在预览版上验证创建、邀请、状态变更、重发邮件；如担心滥用，加入持久化的限流。

### R-072 访客取消报名后不能再次报名（P3，设计如此）

证据：访客报名文档的 id 是 `{eventId}_{emailKey}`；再次报名是对已存在 id 的 `set`，也就是更新，访客无权更新（见 R-060）。取消后的文档会保留。

风险：取消过的访客不能用同一邮箱或电话再报同一个活动。

建议行动：接受现状，或由 board 删除已取消的文档（board 有删除权限）。

## 2026-10-20 新增：Phase 1 审查修复

以下修复都在 `phase1/integration`（尚未合并、尚未部署）。

### R-073 KL 自助注册因嵌套的 undefined 一直失败（P0，已解决）

证据：注册资料构建函数（`utils/signUpPayload.ts` 的 `buildSelfSignUpMember`）在表单没有填简介时留下 `others.bio: undefined`；旧的 `stripUndefined` 只去掉顶层的 undefined，而 Firestore 不接受嵌套的 undefined，所以写 `members` 失败。失败时，刚创建的 Firebase Auth 账号会留下，没有资料。

风险：新的 KL 申请人无法注册，每次失败还会留下一个孤立的 Auth 账号。

处理：`stripUndefined` 现在会清理各层的普通对象（Timestamp 和数组保持原样），`buildExternalSignUpMember` 也用它。`hooks/useAuth.tsx` 的 `signUp` 在资料写入失败时会删除刚建的 Auth 账号（和 `signUpExternal` 原有的回滚一致）。

### R-074 分会管理人可以撤销 KL 的决定（P1，已解决）

证据：重新激活已停用成员的条件是 `affiliation.activatedAt` 已有，这并不说明是谁停用的，所以分会管理人可以解除 JCI KL 做的停用。规则里分会管理人的客户端分支还允许 `expired` → `suspended` 等从浏览器直接改状态字段的写法。

风险：分会管理人能推翻 KL 的停用，也能做 `external-accounts` 转换表不允许的状态变更。

处理：`setStatus` 在每次变为 `suspended` 时写 `affiliation.suspendedByRole`（`KL` 或 `CHAPTER_ADMIN`），分会管理人只有在值为 `CHAPTER_ADMIN` 时才能重新激活；`ChapterAdminView` 的「重新激活」按钮用同一条件显示。`members` 更新规则里的客户端分支已移除，分会管理人不再从浏览器写会员文档。

### R-075 任何人都可以通过自助注册占满分会名额（P1，已解决）

证据：每个分会 100 个成员的上限统计了该分会所有成员文档，而任何人都能自助注册出一个 `pending_chapter` 文档。

风险：大量自助注册会让真正的邀请无法进行。

处理：function 只统计 `affiliation.status` 在 `CAP_COUNTED_STATUSES`（`active`、`suspended`）内的成员；待审批、已拒绝、已过期的文档不占名额。索引见 R-086。

### R-076 问卷的 responsesCount 可以被刷高（P2，已解决）

证据：`surveys` 更新规则允许任何能读问卷的人给 `responsesCount` 加 1，与是否真的有回答无关，也不看问卷状态。

风险：用户不作答也能把回答计数刷上去。

处理：非 board / admin 的更新必须针对 `Active` 的问卷，只改 `responsesCount`（+1）和 `updatedAt`，并且同一次写入要创建自己的 `surveyResponses/{surveyId}_{uid}`（规则检查该文档写入前不存在、写入后存在）。

### R-077 自助注册的类别没有和分会绑定（P2，已解决）

证据：外部自助注册规则接受 `sister`、`apicc`、`global` 中任意一个 `affiliation.category`。

风险：自助注册的人可以选一个与自己分会不符的类别，从而改变他能看到的内容（福利受众）。

处理：规则要求 `affiliation.category == categoryForChapterType(chapter.type)`。见 R-083。

### R-078 可以按 id 试探报名和问卷回答（P2，已解决）

证据：`eventRegistrations` 和 `surveyResponses` 的 get 规则允许读取任意 id 下不存在的文档，「找不到」与「无权限」的区别会告诉用户别人是否报过名或答过卷。

风险：泄露谁报名了某个活动、谁回答了某份问卷。

处理：不存在的 `eventRegistrations` 文档只有在 id 以 `_` 加调用者 uid 结尾时才允许读；不存在的 `surveyResponses` 文档只允许读 `{surveyId}_{uid}`。见 R-084、R-085。

### R-079 不存在的活动也能接受访客报名（P2，已解决）

证据：`guestRegistrations` 创建规则只检查数据形状，未登录访客可以对任意 `eventId` 创建报名。

风险：为虚构或未列出的活动产生垃圾文档。

处理：创建时还要求 `projects/{eventId}` 存在，且状态为 Active、Upcoming 或 Approved（访客活动页列出的状态）。见 R-082。

### R-080 标记已付款时，分档价格记成了最低档（P2，已解决）

证据：`markRegistrationPaid` 用 `price ?? priceMin`，分档价格的活动会记成最低档，与付款人实际付的无关。

风险：财务收入金额不对。

处理：「标记已付款」窗口要求财务确认实际收到的马币金额（预填 `price || priceMin`）；交易的 `amount` 就是确认的金额，`originalAmount`（只有美元报名才写）保留列出的价格。

### R-081 问卷回答可以用任意 id 创建（P2，已解决）

证据：`surveyResponses` 创建规则只要数据字段符合就接受任何文档 id，一个用户可以提交多份回答。

风险：重复或多余的回答被计入问卷结果。

处理：非 board / admin 必须使用 id `{surveyId}_{uid}`（`SurveysService.submitResponse` 本来就用这个 id），已存在的 id 仍然被拒绝。

### R-082 已接受：未登录访客可以抢先占用访客的邮箱或电话（P3，已接受）

证据：访客报名 id 是 `{eventId}_{emailKey}` 和 `{eventId}_phone_{phoneKey}`，创建不需要登录（R-060、R-072）。任何人都可以为某个已列出的活动登记一个邮箱或电话，真正的主人之后会被提示「已报名」。

风险：访客可以挡住别人对该活动的访客报名。

决定：暂时接受；board 可以删除被抢占的文档（board 有删除权限）。

### R-083 规则里的 categoryForChapterType 与 categoryForChapter 重复（P3）

证据：`firestore.rules` 的 `categoryForChapterType` 与 `utils/affiliation.mjs` 的 `categoryForChapter` 是同一个映射（先 `sister_lo`，再 `apicc`，再 `global`，默认 `sister`），规则不能引用代码。

风险：只改其中一处，自助注册会被拒绝（或接受错误的类别）。

建议行动：两处一起改；`tests/rules/wp3SelfRegister.rules.test.ts` 与单元测试应覆盖同样的情况。

### R-084 问卷 id 不能包含下划线（P3）

证据：`surveyResponses` 的 get 规则把第一个 `_` 之前的部分当作问卷 id（`responseId.split('_')[0]`），`surveys` 更新规则则拼出 `{surveyId}_{uid}`。问卷 id 是 Firestore 自动 id，不含 `_`。

风险：手工指定的带 `_` 的问卷 id 会破坏不存在文档的读取和重复提交检查。

建议行动：不要用自定义 id 创建问卷。

### R-085 eventRegistrations 的「文档不存在」检查只看后缀（P3）

证据：`eventRegistrations` 的 get 规则在 id 以 `_` 加调用者 uid 结尾时允许读取不存在的文档，不检查前面的部分。

风险：只是理论上的：本身含 `_` 的 uid 可能匹配到别的 id 的后缀。Firebase 自动 uid 不含 `_`，且匹配只会暴露「文档不存在」。

建议行动：暂不处理；若将来引入自定义 uid 再收紧。

### R-086 部署注意：复合索引 members (loId, affiliation.status)（P2）

证据：名额统计（R-075）用 `loId ==` 加 `affiliation.status in [...]` 查询 `members`；索引已写在 `firestore.indexes.json`。

风险：如果规则和 function 上线时没有这个索引，创建或邀请外部账号会在统计查询处失败。

建议行动：发布 function 前，把 `firestore.indexes.json` 与 `firestore.rules` 一起部署，并等索引建好。
