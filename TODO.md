# TODO

本文件记录当前开发目标、已确认的后续任务，以及 agent 在执行过程中发现但不属于当前范围的问题。

## 使用规则

- 每次开始任务时，先读取 `CLAUDE.md`，再读取本文件和任务相关的代码、schema 与权限规则。
- 当前任务只处理"进行中"或用户明确指定的事项。
- 发现范围外问题时，先登记到"待确认"或"后续任务"，不得自动扩大当前任务。
- 每项任务必须写明来源和完成标准；涉及架构、数据迁移、删除字段或权限变化时，标记为"需要确认"。
- 完成代码后，同时检查是否需要更新 `SCHEMA.md`、`SCHEMA-PERMISSIONS.md` 或本文件。
- 任务完成后，将项目移到"已完成"，保留一句验证结果。

---

## 当前目标

- **目标：完整拆解全系统，将所有 Firestore 集合的字段结构与权限规则记录到 SCHEMA.md 和 SCHEMA-PERMISSIONS.md，供系统复制使用。**
- 范围：全部 Firestore 集合（含 constants.ts + firestore.rules 中的全部集合）的字段路径、类型、枚举值、来/往流向、权限矩阵。
- 不包含：业务逻辑重写、数据迁移、新功能开发、服务代码修改。
- 完成标准：
  - [x] SCHEMA.md 覆盖全部集合，每集合有完整字段表（字段路径、类型、必填、枚举、来、往）。（2026-09-19：新增 finance/nonMemberLeads/userRolePermissions/membershipTypePermissions/positionPermissions 5个集合节，总覆盖率 100%）
  - [x] SCHEMA-PERMISSIONS.md 汇总表覆盖全部集合，每行有 get/list/create/update/delete 五列。（2026-09-19：新增 finance/nonMemberLeads/userRolePermissions/membershipTypePermissions/positionPermissions 行；修正 RegistrationHistory P0 备注）
  - [x] 每批次分析完成后在本文件标记完成并记录验证结果。（2026-09-16 全部11批次已标记）
  - [x] RADAR_CONTRIBUTIONS 常量问题已修复（2026-09-19：`COLLECTIONS.RADAR_CONTRIBUTIONS` → `COLLECTIONS.REGISTRATION_HISTORY`，依据代码注释 L2435 "from RegistrationHistory"）

---

## 进行中

<!-- 当前无进行中任务；从批次一开始 -->

---

## 分析批次（按业务域）

> 执行方式：`/start jciklconnect` → agent 读取本文件 → 选第一个未完成批次 → 分析代码并写入 SCHEMA.md + SCHEMA-PERMISSIONS.md → 标记完成

| # | 批次 | 集合 | 状态 |
|---|------|------|------|
| 1 | 成员与身份 | `members`（补完来/往）、`memberEmails`、`boardMembers`、`boardTransitions`、`boardTermSettings`、`promotionHistory`、`manualPromotionRequests`、`guestRegistrations` | ✅ 完成（2026-09-16：SCHEMA.md 已覆盖全部集合含来/往；已清理已删除功能残留；SCHEMA-PERMISSIONS.md 同步更新；commit 41f65f7） |
| 2 | 活动与项目 | `events`、`eventBudgets`、`eventRegistrations`、`eventFeedback`、`projects`、`flagship_projects`、`activityPlans`、`projectReports`、`projectTrx` | ✅ 完成（2026-09-16：7/9 已完整；补写 `projects` 18行来/往、`projectReports` 36行子字段来/往） |
| 3 | 财务核心 | `transactions`、`transactionSplits`、`bankAccounts`、`reconciliations`、`paymentRequests`、`toyyibBills`、`toyyibCategories`、`toyyibpay_webhooks` | ✅ 完成（2026-09-16：8/8 已完整，无需补写） |
| 4 | 财务延伸 | `contracts`、`pointEscrow`、`sponsorships`、`inventoryItems`、`stock_movements`、`maintenance_schedules`、`inventory_alerts`、`finance_alerts` | ✅ 完成（2026-09-16：8/8 已完整，无需补写） |
| 5 | 积分与游戏化 | `points`、`pointsRules`、`pointsRuleExecutions`、`badges`、`badgeAwards`、`achievements`、`achievementAwards`、`achievementProgress`、`incentivePrograms`、`incentiveStandards`、`incentiveSubmissions`、`loStarProgress` | ✅ 完成（2026-09-16：10/12 已完整；补写 pointsRules 7行、badgeAwards 3行来/往） |
| 6 | 知识与成长 | `learningPaths`、`learningProgress`、`trainingModules`、`documents`、`documentVersions`、`surveys`、`surveyResponses` | ✅ 完成（2026-09-16：6/7 已完整；补写 surveys 9行、learningPaths 1行来/往） |
| 7 | 社群与互动 | `hobbyClubs`、`communication`、`mentorMatches`、`mentorshipFeedback`、`zoomBookings`、`guestPageStats`、`memberBenefits`、`benefitUsage` | ✅ 完成（2026-09-16：8/8 已完整，无需补写） |
| 8 | 商业与网络 | `businessProfiles`、`publicBusinessListings`、`advertisements`、`promotionPackages`、`publications`、`partnerships`、`sisterChapters`、`inquiries` | ✅ 完成（2026-09-16：补写 advertisements 1行来/往；其余7集合已完整） |
| 9 | 自动化与治理 | `automationRules`、`workflows`、`workflow_executions`、`tasks`、`notifications`、`templates` | ✅ 完成（2026-09-16：补写 workflows 3行、automationRules 3行、workflow_executions 21行、notifications 2行、templates 1行；tasks 已完整） |
| 10 | 会员旅程 | `socialPosts`、`socialPersonas`、`RegistrationHistory`、`postcodes`、`guestRegistrations` | ✅ 完成（2026-09-16：补写 socialPosts 1行；新增 postcodes 集合节；其余3集合已完整） |
| 11 | 系统与审计 | `auditLog`、`errorLogs`、`emailLogs`、`systemLogs`、`webhooks`、`webhook_logs`、`counters`、`system`、`system_config`、`systemSettings`、`permissionCatalog`、`birthdayNotificationsSent` | ✅ 完成（2026-09-16：补写 auditLog 2行、errorLogs 4行、emailLogs 1行、systemLogs 1行；新增 webhooks 和 webhook_logs 集合节；其余已完整） |

---

## 待确认

- [ ] **需核实是否已部署**（规则部分已核实，见下方 2026-10-18 结论；函数部分仍待核实）：v6 P0 专项修复（commit `1c9bba2`）涉及的 `firestore.rules` 与 Cloud Functions 改动。来源：原 `CLAUDE.md` 记录"待执行 `firebase deploy --only firestore:rules && firebase deploy --only functions`"（现见 `docs/ANALYSIS-HISTORY.md`）。影响：未部署则这些 P0 修复在生产环境不生效。完成标准：用户确认已部署，或对比线上 rules 与本地 `firestore.rules` 一致。部署须用户亲自批准。
  - 2026-10-18 进展：本机 Firebase CLI 当前账号对 `jci-lo-management-app` 无读取权限（403），无法自动比对。需要用户在 Firebase 控制台复制当前规则，或换一个有权限的账号登录 CLI。另一个判断方法：线上对账配对、新用户自助注册如果都正常，说明线上规则和仓库版本不同（见 R-028）。
  - 2026-10-18 结论（规则）：用户从控制台提供线上规则，比对确认是 commit `d8282b0`（2026-09-10）版，已包含 `1c9bba2` 的规则修复。未部署：`b83d671`（代他人提交付款申请，线上会被拒绝）、`65599ca`（删除已废弃集合的规则，无功能影响）。Cloud Functions：2026-10-18 用 noreply@jcikl.cc 账号查询，线上一个函数都没有部署（项目未开启计费），所以 `1c9bba2` 的函数修复也不存在于线上，见 R-038。
- [ ] **另一会话产生的未提交文件，待用户决定去留**（2026-10-12 登记）：`CAPABILITIES.md`、`scripts/gen-capabilities.py`、`docs/development/{CLAUDE_MD_MIGRATION,CRUD_CHECKLIST,DECISION_PROTOCOLS,LAYER_RULES}.md`、`docs/collections/{ANALYSIS_FRAMEWORK,ANALYSIS_LOG}.md`，以及 `RISK_REGISTER(.zh-CN).md` 新增的 R-018～R-024。来源：2026-10-12 00:17 另一 AI 会话改写 CLAUDE.md 时生成。用户已决定保留 2026-10-11 版 CLAUDE.md，该会话的版本另存为 `docs/CLAUDE.md.bak-2026-10-12-other-session`（不入库）。影响：`ANALYSIS_LOG.md` 与 `docs/ANALYSIS-HISTORY.md` 内容重复；`CAPABILITIES.md` 能力地图可能有参考价值。完成标准：用户逐项决定提交、合并进现有文档或删除。

---

## 后续任务

- [x] 线上 WhatsApp 二维码 SVG 修复部署验收（2026-11-25）：已复现 SSR 缺少 `xmlns` 导致独立 SVG 图片加载失败，并补充命名空间及回归断言。修复 `be0ffb5` 已推送，Netlify 显示 Published；14 项二维码 / 头像 / 手册测试、typecheck、build、diff 校验通过（构建仍有既有分块警告）。部署后两个抽查二维码均为 200 / SVG，浏览器 naturalWidth=96 且未隐藏；线上 SVG 与按当前联系号码生成的预期 WhatsApp 二维码逐字一致。未执行实体手机扫码，不保存号码。
- [x] 线上会员头像 404 原因核实（2026-11-25）：只读抽查 30 个已公开名片会员，均无 `general.avatarUrl` 或旧版 `avatarUrl` / `avatar`，包含先前两个 404 样本。另查两个确有当前头像且已公开名片的样本，线上接口分别返回 200 / JPEG（172175 字节）及 PNG（81229 字节）；部署后浏览器确认自动头像代理图片 naturalWidth=1024，缺资料样本显示姓名缩写。结论仅针对抽查：缺头像资料时回退缩写是预期行为；未改数据库、来源限制或公开授权。

- [ ] 转介测试字段与服务实现不一致（2026-11-25，行业选项更新时发现）：`tests/unit/idealReferrals.test.ts` 和 `idealReferralsParity.test.ts` 合计 7 项失败；测试以 `idealReferral` / `business.idealReferrals` 为输入，`MembersService.normalizeMemberData` 及 `mapMemberToBusinessProfile` 当前使用 `business.idealReferralTypes`。来源：行业更新相关测试；完成标准：确认字段契约并统一实现或测试。本次未修改服务层，不扩大到转介逻辑重构。

- [x] Business Connect WhatsApp 二维码浏览器验收（2026-11-25）：占位图已替换为当前 `members.contact.phone` 的 WhatsApp 二维码，复用公开名片授权；补充 SVG 命名空间后线上两个样本实际加载及目标编码比对通过，见上方验收。无授权 / 无效号码的拒绝由自动化测试覆盖；未修改生产会员授权进行破坏性验收，未执行实体手机扫码。

- [x] Business Connect 自动会员头像部署验收（2026-11-25，用户已授权）：沿用 `privacy.shareCardInternationally`，公开页面自动读取当前头像，不需单独发布；线上有头像样本的接口及浏览器加载通过，缺资料样本回退缩写，见上方调查。关闭分享后的 404 及抓取期间撤回授权由自动化测试覆盖，未修改生产会员授权；本次 14 项相关测试、typecheck、build 通过，不代表全量测试通过。

<!-- 批次分析发现的范围外问题登记于此 -->

- [ ] **重建蓝图第一轮核实的修复（需要确认）**（2026-10-18 登记）。来源：第一轮核实（权限与规则），详情见 `RISK_REGISTER.md` R-028～R-037。影响：数据外泄、记录可伪造、对账 / 注册 / 推送可能失效。涉及文件：`firestore.rules`、`storage.rules`、`hooks/useAuth.tsx`、`services/{financeService,toyyibService,notificationService,paymentRequestService}.ts`、`components/modules/AccessConfigView.tsx`。完成标准：先确认线上规则版本；每项先在模拟器复现，再按极高风险流程提计划、等用户批准后修复，并补规则测试。
- [ ] **把需要的后台任务从 Cloud Functions 搬到 Netlify（需要确认）**（2026-10-18 登记，用户已选定方向：搬到 Netlify，不开计费）。来源：R-038。盘点结论：21 个函数中只有 1 月 1 日会费提醒需要迁移，生日推送已在 Netlify，但要修令牌读取位置（R-033）；10 月自动续费、活动前一天提醒待用户决定；其余已有网页端替代或已废弃。顺带修签到积分（R-039）。步骤：P1 共享 helper（`netlify/lib/firebaseAdmin.mjs`）+ 修推送 → P2 迁移会费提醒 → P3 按用户决定 → P4 修签到积分 → P5 标记 `functions/` 停用并同步文档。完成标准：每步在 `netlify dev` + 模拟器验证，推送一律 dryRun，部署由用户执行。
  - 2026-10-18 用户决定：10 月自动续费 → 不做，继续手动；1 月 1 日会费提醒 → 迁移；签到积分 → 在网页端恢复；活动前一天提醒 → 先不做，等推送修好后再议。`functions/` 先标记停用，保留一个月。
  - 进度：P1 修推送 ✅（commit `09c3af2`）；P2 迁移 1 月会费提醒 ✅（`netlify/functions/annual-dues-reminders.mjs`，模拟器验证通过）；P4 签到积分 ✅（单元测试 4 个通过）；P5 收尾待做。均未部署。
- [ ] **修复失败的积分规则测试**（2026-10-18 登记）。来源：`npx vitest run` 时 `tests/property/pointsRule.properties.test.ts` 报 `doc() cannot be called with an empty path`；撤掉本次改动后同样失败，属既有问题。影响：测试套件不是全绿，无法作为 CI 关卡。完成标准：查明原因并修好，全套测试通过。
- [ ] **部署 R-028 规则（用户执行）**（2026-10-18 登记）：`firebase deploy --only firestore:rules`。部署后验证：财政能对账配对、新用户能注册、会员能改电话。回滚：重新部署 `047b450` 的 `firestore.rules`。
- [x] **导入会员时直接建 Firebase Auth 账号 + Super Admin「Fix Auth」补建按钮** ✅ 2026-10-18 Fix Auth 已执行，345/345 会员有登录账号（见 R-040）；代码随 PR #3 合并上线（2026-10-18 用户提出）：导入会员资料时，按电邮和电话在 Firebase Auth 建账号（uid = 会员文档 ID，首次登录不再需要复制资料）；已导入的会员由 Super Admin 在会员页面 batch import 抽屉里的新按钮「Fix Auth」补建。来源：R-028 调查发现被邀请的导入会员首次登录会被拒。
  - 2026-10-18 计划已确认：Auth 账号 uid = 会员文档 ID；新建 `netlify/lib/memberAuth.mjs` + `netlify/functions/member-auth.mjs`（create 模式 ADMIN+；fix 模式仅 SUPER_ADMIN，默认试跑，写 auditLog）。用户决定：建账号后不自动发设置密码邮件，Fix Auth 可勾选发送；导入权限收紧到 ADMIN 以上；从未登录过的孤儿账号必须手动勾选才删除重建；删除 `useAuth.tsx` 登录时复制资料的逻辑，改为提示联系管理员。步骤：0 电话格式化 → 1 服务端函数 → 2 导入时自动建 → 3 Fix Auth 界面 → 4 删除复制路径。
  - 进度：0–4 步代码完成（`b51d2d0` + 本次提交），未部署。线上只读试跑：345 人中 8 人就绪、335 人待建、2 人需人工处理（见 R-040）。待办：部署后由 SUPER_ADMIN 先试跑再执行 Fix Auth；处理 SHANE TEOH、SHIRLEY PANG；`docs/PERMISSION_MATRIX.zh-CN.md` 记录导入按钮已收紧到 ADMIN+；`send-invite` / `auto-invite` 改用 `memberAuth` 的 uid=会员编号逻辑（另开任务）。
  - 顺带发现、另行处理：`membersService.createMember` 写入的 `memberEmails` 占位记录 email 为空（L615）；`useAuth.tsx` 调用 `check-and-create-auth`（L345）和 `delete-auth-user`（L206）时没带 token，两条路一直无效。
- [x] **部署规则（用户执行）** ✅ 2026-10-18 已部署，SUPER_ADMIN 签到线上验证通过（2026-10-18 登记）：R-034 修复 + `b83d671`（用户已同意）+ `65599ca`。命令：`firebase deploy --only firestore:rules,storage`。部署后验证：noreply@jcikl.cc（SUPER_ADMIN）能给他人签到。回滚：重新部署 `d8282b0` 的 `firestore.rules`。
- [x] **确认 SHANE TEOH、SHIRLEY PANG 旧登录账号由谁删除** ✅ 2026-10-18 用户确认是本人在 Firebase 控制台删除。（2026-10-18 登记）来源：Fix Auth 试跑时两人邮箱下有登录过的账号，正式执行时已不存在。完成标准：用户确认是否在 Firebase 控制台删除；若不是，查 Firebase Auth 日志。
- [ ] **通知会员新的登录方式**（2026-10-18 登记）：Fix Auth 未发设置密码邮件，会员需用 Google 登录或「忘记密码」。完成标准：会员群发通知，或改为批量发送设置密码邮件（需用户决定）。
- [ ] **`ConfirmDialog` 深色模式下「Cancel」按钮几乎看不见**（2026-10-18 登记）。来源：Fix Auth 执行确认窗口截图。涉及：`components/ui/ConfirmDialog.tsx`（共用组件，影响所有确认窗口）。完成标准：浅色、深色两种主题下按钮文字都清晰可读。
- [ ] **`send-invite` / `auto-invite` 改用 uid = 会员编号**（2026-10-18 登记）。来源：R-040。这两个函数仍用随机 uid 建账号；全部会员已有账号后影响变小，但应统一用 `netlify/lib/memberAuth.mjs`。
- [ ] **确认 ToyyibPay 模式为 Production**（2026-10-18 登记，R-042）：System Config → ToyyibPay；缺少设置时代码默认沙盒。
- [ ] **付款跳回网址修复上线后实测**（2026-10-18 登记，R-041）：合并部署后，用最小金额实际付款一次，确认跳回 `/payment-return` 且系统记录为已付；已登录会员停留在结果页、按钮回到系统。
- [ ] **会员自助缴费写 `membership.{年份}.toyyibBillCode` 被规则拒绝**（2026-10-18 登记）。来源：`hooks/useToyyibPayment.ts:84` 写会员资料的 `membership` 字段，而会员自改资料规则锁定 `membership`；与 R-032 同属会员自助缴费流程。完成标准：改由服务端写入或调整写入位置，并补规则测试。
- [ ] **10 个 Netlify 函数的 CORS 白名单改用本站网址**（2026-10-18 登记，R-041）：`audit-log`、`auto-invite`、`cloudinary-delete`、`lark-sync`、`send-email`、`send-invite`、`toyyibpay-api`、`upload-to-drive`、`whapi-proxy`、`member-auth` 只列了 `app.jcikl.cc`；改用 `netlify/lib/siteUrl.mjs` 的 `siteOrigins()`。
- [ ] **ToyyibPay 付款通知没有入账**（2026-10-19 登记，P0，R-046）：通知其实已送达，但因读错字段（`transaction_id` 而非 `refno`）被静默拒收；核对时也固定查沙盒。修复在分支 `fix/toyyib-callback-refno`。完成标准：合并后沙盒再付一笔 RM1，日志出现 `Received billCode=…`，账单变已付、交易自动入账。
- [ ] **正式环境测试未完成：缺正式收款分类**（2026-10-19 登记）。模式开关已验证可切到 Production 并切回（`systemConfig/toyyibpay` 已写入，现为 Sandbox）。现有分类 `6x9mw99z` 仅存在于沙盒；「Create & Link」会把新分类绑定到会籍类型或项目，需用户决定绑定对象或提供在 toyyibpay.com 建好的分类编号（用 Import 导入）。
- [ ] **ToyyibPay 页顶部模式标签切换后不更新**（2026-10-19 登记）：设置面板已显示 Production，页顶仍显示 Sandbox，疑为另一个 `useToyyibMode` 实例。
- [x] **`toyyibBills` 未保存外部参考编号**（2026-10-19 登记）：建账单时已写入 `billExternalReferenceNo` 和 `isSandbox`（随 R-046 修复）。
- [ ] **测试数据**（2026-10-19）：沙盒账单 `4e9xc8va`、`lm6obyw3`（各 RM1，测试用）留在 `toyyibBills`，待用户决定是否删除。
- [ ] **重建蓝图第二轮核实：财务（P4）**。来源：重建蓝图 artifact 的验证顺序。完成标准：逐条核对 P4 验收标准和 2026-07-14 撤销审计的 9 个缺口，结果登记到风险清单。
- [ ] **重建蓝图第三轮核实：其余模块（P2、P3、P5–P7）**。完成标准同上。

---

## 文档创建记录

- `AGENTS.md`（2026-11-17）：基于当前 `CLAUDE.md` 建立 Codex 项目入口，引用共享规则并补充 Codex 任务恢复、验证和命令适配；入口为仓库根目录 `AGENTS.md`。独立文件用于提供 Codex 入口，避免复制整套长期规则。

<!-- 新建 Markdown 文档时记录：文档、创建原因、所属主题、入口链接 -->

- `docs/ANALYSIS-HISTORY.md`（2026-10-11）：存放历次集合扫描结果与修复记录。原内容在 `CLAUDE.md` 中占约 150 行，属于历史记录而非规则；`TODO.md` 只管当前任务，`RISK_REGISTER.md` 是另一种风险格式，都不适合承载。入口：`CLAUDE.md` 第 7 节文档分工表。

---

## 已完成

- [x] 首页更新提交 GitHub（2026-11-25，用户授权）：提交首页布局、响应式动效、白色页脚 Logo 与对应任务记录；保留其他工作区改动。此前 typecheck、build 及响应式浏览器验证通过；推送结果以本次交付说明为准。

- [x] 首页四处外层间距调整（2026-11-25）：首屏 / 近期活动上下各 30px，蓝色介绍各 40px，四大领域外层 padding 为 0；手机同值，保留四大领域 margin 与吸顶面板内部 padding，其他 home-section 不受影响。浏览器核对桌面 / 手机实际计算值及无溢出；typecheck、build、diff 校验通过。未提交、未部署。
- [x] 首屏标题同排与四大领域滚动修正（2026-11-25，用户连续批注）：移除标题强制换行，以文字容器宽度缩放字号；保留文字轻重动效。滚动联动从固定 650px 门槛改为按吸顶面板实际高度判断，照片加入透明度过渡。实测 618px 标题单行、390×600 手机联动及无溢出；电脑滚动 Business → Community 左右展开，手机 Community → International 上下展开，吸顶分别为 80 / 64px。typecheck、build、diff 校验通过；未提交、未部署。

- [x] 首页简介精简与组织介绍全宽（2026-11-25，按用户连续批注）：删除 Sources 文字与简介包装容器，正文直接放于 hero，保留数字配色及计数入场；文字层级高于照片 / 圆环，圆环允许溢出自身舞台并在页面边缘裁切，避免旋转产生横向滚动。蓝色组织介绍两段改为上下排列且占满内容区，不再使用字数限宽 / 桌面双栏。390 / 981 / 1440px 浏览器核对正文与内容区等宽、无横向溢出、来源 / 容器已移除；typecheck、最终样式 build、diff 校验通过。未提交、未部署。

- [x] 更正首页简介内容位置（2026-11-25，按用户批注）：将原 “Meet people who move ideas forward…” 替换为 Since 1954 历史与全球网络介绍，保留浅色背景、深蓝 / 亮蓝数字及入场计数动效；移除此前放在 hero 下方的重复统计区块，保留按钮、照片和其他首页区块。390 / 778 / 1440px 浏览器检查无横向溢出，确认内容仅出现一次且位于 hero 简介中；typecheck、build、diff 校验通过。未提交、未部署。

- [x] 首页 Business Connect 宣传区替换为组织介绍（2026-11-25，用户指定 jcikl.cc 参考区块）：采用 “Not just a network. A place to lead.” 原文、JCI 亮蓝背景与深色文字，加入 Learn / Lead / Connect / Impact 内容、标题字重渐变及阅读区域关键词高亮；复用现有入场逻辑，“Read our story” 接入原有 about 导航。浏览器检查 390 / 834 / 1440px 无横向溢出，确认手机单栏 / 桌面双栏、关键词字重高亮与关于页跳转；typecheck、build、git diff --check 通过，构建保留既有分块警告。未更改数据库、未提交、未部署；本地预览 http://localhost:3001/。

- [x] 首页简介采用官网数字段落（2026-11-25，用户提供 jcikl.cc 区块批注）：用 Since 1954 的连续大字简介替换原四列静态统计，沿用截图浅色背景、深色轻字重正文、深蓝 1954 / 100 / 5,000 与亮蓝年数；保留官网来源文字和 `https://jci.cc/about/` 链接。年数按当前年份减 1954 计算（2026 为 72）；首次进入视野时约 1.4 秒递增并轻微淡入，无重复计数；减少动效偏好 / 不支持观察器时显示最终值，动态切换偏好时取消计数。读屏使用静态完整段落，避免逐帧朗读。浏览器观察到递增中间值并确认最终 1954 / 72 / 100 / 5,000；390 / 834 / 1440px 无溢出，来源链接正确。typecheck、最终 build、diff 校验通过（既有分块警告仍在）。预览 `http://localhost:3001/`，未提交、未部署，不改数据库。

- [x] 四大领域按钮栏移除、全卡满铺与电脑 / 手机方向调整（2026-11-25，用户三项批注及补充要求）：移除顶部领域 tablist，改用卡片本身点击 / 键盘操作和原有滚动进度切换。768px 及以上横向排列，展开宽度由剩余空间决定，确保展开卡及其余三张竖向标题同在容器内；手机改为从上到下的纵向手风琴，收起项为横向标题行。图片改为展开卡全幅 object-fit:cover 背景，叠加遮罩和文字，不改原图片或说明。修正移动端伸缩期间高度变化引起的末项定位偏移：纵向轨道高度固定为展开项 + 三个收起项之和。浏览器验证 835×768 四卡全在容器内且高度均约 368.6px，390×678 / 511×768 为 column、单一展开、无横向溢出、卡片内容完整、图片铺满；手机末项 stickyTop=64px 且 stickyHeight=561px。typecheck、最终 build、diff 校验通过，既有分块警告仍在。预览 `http://localhost:3001/`，未提交、未部署；覆盖此前窄屏横向轨道设计。

- [x] 四大领域滚动手风琴与移除暂停按钮（2026-11-25，用户提供四张参考图并要求继续）：保留纵向进度驱动，切换时仅当前领域以深色展开、高亮并展示图片 / 原说明；其他领域收为白色窄卡和竖向标题，支持点击窄卡、顶部按钮、键盘及滚动切换。桌面全部四卡并排伸缩，手机 / 平板用横向轨道展示展开卡与相邻窄卡；补充完整领域名称，不改原有说明或数据源。移除首屏 Pause motion 按钮、暂停状态及样式，继续遵守系统减少动效偏好。浏览器验证 1208×768、768×1024、390×678 单一展开 / 其余说明隐藏、滚动切换、点击窄卡、无页面横向溢出、暂停按钮不存在；手机 sticky 高度 610px + 顶部 64px，可容纳于 678px 屏幕。typecheck、最终 build、diff 校验通过，既有构建分块警告仍在。预览 `http://localhost:3001/`，未提交、未部署；替代前次全部大卡横向展示方式。

- [x] 首页五项浏览器批注调整（2026-11-25）：移除新增董事横向展示及相关状态 / 读取流向说明，保留原主席主题；首屏和 Business Connect 主按钮均改为 Become a Member，打开现有注册表。四大领域改为纵向页面进度驱动横向原生轨道，支持反向滚动、按钮 / 键盘定位；减少动效或高度低于 650px 时使用普通横向浏览，不阻止滚轮 / 触摸默认行为。用户提供的白色 Logo 原样复制至 `public/jci-kl-white.png`，页脚可选参数仅在首页启用，contain 显示完整 Logo，其他页面保持原设置。浏览器验证两个注册入口、董事展示已移除、滚动前后 railLeft 变化且 stickyTop 固定、反向返回、390 / 768 / 1440px 无溢出、600px 短屏降级、Logo 正常加载及完整比例；typecheck、最终 build、diff 校验通过，已运行能力地图生成脚本（无内容差异）。预览 `http://localhost:3001/`，未提交、未部署；覆盖前次新增董事展示与伸缩面板的设计决定，未修改数据库。

- [x] 首页响应式动效与交互补齐（2026-11-25，用户要求）：桌面四大领域面板支持悬停 / 点击与 0.8 秒伸缩，1024px 以下为点击切换内容，支持左右键 / Home / End；窄屏导航按原菜单开关逐项淡入与位移，不修改共享页头逻辑。首屏使用合照与既有活动图片进行约 1.44 秒淡化，周期 18 秒，保留推近 / 标题 / 圆环并增加 3 秒节点脉冲、统一暂停和减少动效支持。复用已经取得的当届 active 董事资料（本次 13 条）新增横向吸附展示及前后按钮，不新增查询、写入或虚构故事；读取流向补充至 `SCHEMA.md`。现有四大领域图片内容相同，保留原素材，首屏避免重复轮播同图；没有地图，节点效果应用于现有圆环。浏览器验证 390 / 768 / 1440px 无横向溢出、领域切换 / 键盘操作 / 桌面最终 flex-grow=2.6、菜单错峰、人物滑动吸附、两张图片加载及统一暂停；最终 typecheck、build、diff 校验通过（既有构建分块警告仍在）。预览 `http://localhost:3001/`，未提交、未部署。

- [x] 首页应用 jcikl.cc 四类动效（2026-11-25，用户要求预览）：在现有首页扩充变量字体标题字重渐变（1.15 秒）、合照推近（9 秒，最多 5.5%）、两层 140 / 190 秒反向圆环及滚动入场（四大领域逐项错峰）；保留旧版主席主题效果、全部功能和数据。新增首屏暂停 / 继续控制，遵守减少动效偏好；修正旋转边界引起的横向溢出。浏览器验证暂停 / 恢复状态、图片缩放、圆环变换和活动区滚动触发，390 / 1440px 及默认宽度无横向溢出。typecheck、最终 build、diff 校验通过，既有构建分块警告仍在。预览 `http://localhost:3001/`，未提交、未部署。

- [x] 首页风格与动效第二轮调整（2026-11-25，用户反馈新版生硬且偏好旧版主席主题）：恢复原版主席区块的桌面 / 手机人像布局、深蓝金色、年度主题 Logo 呼吸与 4 秒条纹扫光；作用域隔离避免新版标题样式覆盖原版。其他区块加入柔和圆角、滚动首次渐入、卡片与箭头悬停反馈，保留减少动效设置及既有内容顺序、数据与操作。浏览器检查 390px 与 1440px 无横向溢出，并确认 stripe-wipe / pulse 动画启用；最终 typecheck、build、diff 校验通过，既有构建分块警告仍在。预览 `http://localhost:3001/`，未提交、未部署；覆盖上一条记录中“主席区循环动效移除”的设计决定。

- [x] Connect 访客首页重新设计（2026-11-25，用户要求本地预览）：`GuestLandingPage.tsx` 与独立作用域样式统一 Plus Jakarta Sans、JCI 蓝 / 深蓝 / 白色阅读布局；保留原有活动查询、KL 相关筛选与全部近期活动、报名路由、登录注册、主席 / 年度主题 / 合照数据、四大领域、现有统计及导航。新增既有 Business Connect 手册的直接入口；循环波纹 / 条纹 / 闪光改为一次性淡入，支持减少动效。浏览器检查 390 / 768 / 1440px 无横向溢出，实际打开活动报名表、注册窗口、登录窗口及会员手册，未提交表单。typecheck、build、diff 校验通过；活动性质测试 7 项通过、1 项原有跳过。构建仍有既有分块警告；统计数字沿用原有静态内容，未重新核实。预览 `http://localhost:3001/`，未提交、未部署；未改数据库或共享页头 / 页脚逻辑。

- [x] 线上手册页面验收（2026-11-25）：实际站点 `https://jciklconnect.netlify.app/business-connect.html` 已显示完整 285 位会员、20 个行业组，无折叠或加载更多，排序 / 打印按钮已移除；实测吸顶位置与导航底边一致，跨行业切换正常。线上 HTML 含 Netlify 注入的托管注释，与 Git 文件不是逐字相同。头像和二维码尚未通过验收，问题另行登记；本次未修改或部署业务代码。

- [x] 更新 26 项行业选项（2026-11-25）：`config/referralOptions.mjs` 按用户提供的顺序和名称更新；下拉只提供新选项，解析器保留旧标签读取兼容以避免逗号名称被拆散，不批量改写会员数据。schema 已同步；新选项识别及解析检查、typecheck、build、diff 校验通过；扩大验证的 7 项转介字段测试失败另行登记。未提交、未部署。

- [x] 手册控件精简与行业吸顶（2026-11-25）：按用户批注移除排序选择器和打印按钮及事件逻辑；固定组内姓名排序。当前行业标题在顶部导航下吸顶，并随下一行业进入替换；通过 ResizeObserver 同步实际导航高度，打印样式恢复静态定位。浏览器核对控件移除、桌面标题与导航对齐、行业切换、390px 吸顶偏移及无溢出；14 项测试、typecheck、build、diff 校验通过。未提交、未部署。

- [x] 会员手册按行业分组（2026-11-25）：行业标题与人数、行业字母排序、空行业归入末尾 Other；组内保留姓名 / 公司排序和完整简介，搜索 / 筛选联动更新分组，打印保留行业章节并分页。浏览器核对 285 位会员归入 20 组、行业筛选及手机无溢出；14 项测试、typecheck、build、diff 校验通过。未提交、未部署。

- [x] Business Connect 改为会员简介手册（2026-11-25，替代上一版折叠目录）：以会员姓名、头像、职位和公司为主，所有匹配会员及业务 / 合作 / 优惠资料完整展开，取消加载更多；保留搜索、筛选、排序、头像与 WhatsApp 二维码，加入 A4 打印样式及打印前图片准备。真实 285 位会员检查通过；390 / 768 / 1440px 无横向溢出；14 项相关测试、typecheck、build、diff 校验通过。打印样式已加入，尚未执行实际 PDF 导出验收。预览：`http://localhost:3001/business-connect.html`；未提交、未部署。

- [x] Business Connect 商业名录重新设计（2026-11-25）：沿用 JCI 蓝白与 Plus Jakarta Sans，改为公司优先的紧凑列表及完整资料展开；保留现有目录数据、搜索、分页、头像与 WhatsApp 二维码，增加行业 / 国际合作筛选及公司 / 姓名排序。13 项相关测试、typecheck、build、diff 校验通过；真实 285 条记录下检查筛选、空结果、排序、加载更多及展开，390 / 768 / 1440px 响应式检查完成。本地预览：`http://localhost:3001/business-connect.html`。未提交、未部署。

- [x] CLAUDE.md 重整（2026-10-11；约 680 行 → 194 行、全中文、9 章结构；历史表格迁至 `docs/ANALYSIS-HISTORY.md`；旧版六步分析模板删除，已由 `/analyze-collection` v3 取代；"来 / 往"规则补充至 `SCHEMA.md`；统一"新依赖须先问""顺手改进仅限同文件低风险"两处矛盾；`AGENT-EXECUTION.md` 补充部署须确认；旧版原文备份于 `docs/CLAUDE.md.bak-2026-10-11`，668 行，仅供对照，不作为规则读取）

- [x] P0 RADAR_CONTRIBUTIONS 修复（2026-09-19；`pointsService.ts:2438` 改用 `COLLECTIONS.REGISTRATION_HISTORY`；TypeScript 编译错误和运行时崩溃均消除）
- [x] SCHEMA.md 覆盖率验证与补全（2026-09-19；对比 constants.ts 全集合 + firestore.rules 全 match 块，发现并补写 5 个缺失集合节：finance、nonMemberLeads、userRolePermissions、membershipTypePermissions、positionPermissions）
- [x] SCHEMA-PERMISSIONS.md 覆盖率验证与补全（2026-09-19；新增 finance/nonMemberLeads/userRolePermissions/membershipTypePermissions/positionPermissions 行；修正 RegistrationHistory P0 备注；移除 nonMemberLeads 旧破损行）
- [x] P0 建立当前一致性基线（2026-09-16；扫描验证：4条P0已修（counters/auditLog/emailLogs/sponsorships），4条P0待确认，SCHEMA-PERMISSIONS.md P0速查表已同步更新）
- [x] 移除 nudges、certificates、conversations 全部相关代码（2026-09-16；commit 65599ca；13文件 -1268行）
- [x] 关闭待确认 nudges/conversations/certificates（代码已删除，对应 Firestore 规则无需单独修复）
- [x] SCHEMA.md + SCHEMA-PERMISSIONS.md 清理已删除功能残留（2026-09-16；commit 41f65f7；移除 certificates/nudges/nudgeRules/conversations 的集合节、权限行和 P0 条目）
- [x] 批次 1 成员与身份验证（2026-09-16；SCHEMA.md 已有完整来/往记录，无需补写）
- [x] 批次 2 活动与项目（2026-09-16；补写 projects 18行、projectReports 36行子字段来/往；其余7个集合已完整）
- [x] 批次 3 财务核心（2026-09-16；8/8 已完整，无需补写）
- [x] 批次 4 财务延伸（2026-09-16；8/8 已完整，无需补写）
- [x] 批次 5 积分与游戏化（2026-09-16；补写 pointsRules 7行、badgeAwards 3行；其余10集合已完整）
- [x] 批次 6 知识与成长（2026-09-16；补写 surveys 9行、learningPaths 1行；其余6集合已完整）
- [x] 批次 7 社群与互动（2026-09-16；8/8 已完整，无需补写）
- [x] 批次 8 商业与网络（2026-09-16；补写 advertisements 1行；其余7集合已完整）
- [x] 批次 9 自动化与治理（2026-09-16；补写 workflows 3行、automationRules 3行、workflow_executions 21行、notifications 2行、templates 1行）
- [x] 批次 10 会员旅程（2026-09-16；补写 socialPosts 1行；新增 postcodes 集合节）
- [x] 批次 11 系统与审计（2026-09-16；补写 auditLog 2行、errorLogs 4行、emailLogs 1行、systemLogs 1行；新增 webhooks 和 webhook_logs 集合节）
