# JCI KL 风险清单

生成时间：2026-08-24。来源：对当前代码库进行只读扫描。

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

