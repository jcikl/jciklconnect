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

<!-- 批次分析发现的范围外问题登记于此 -->

- [ ] **重建蓝图第一轮核实的修复（需要确认）**（2026-10-18 登记）。来源：第一轮核实（权限与规则），详情见 `RISK_REGISTER.md` R-028～R-037。影响：数据外泄、记录可伪造、对账 / 注册 / 推送可能失效。涉及文件：`firestore.rules`、`storage.rules`、`hooks/useAuth.tsx`、`services/{financeService,toyyibService,notificationService,paymentRequestService}.ts`、`components/modules/AccessConfigView.tsx`。完成标准：先确认线上规则版本；每项先在模拟器复现，再按极高风险流程提计划、等用户批准后修复，并补规则测试。
- [ ] **把需要的后台任务从 Cloud Functions 搬到 Netlify（需要确认）**（2026-10-18 登记，用户已选定方向：搬到 Netlify，不开计费）。来源：R-038。盘点结论：21 个函数中只有 1 月 1 日会费提醒需要迁移，生日推送已在 Netlify，但要修令牌读取位置（R-033）；10 月自动续费、活动前一天提醒待用户决定；其余已有网页端替代或已废弃。顺带修签到积分（R-039）。步骤：P1 共享 helper（`netlify/lib/firebaseAdmin.mjs`）+ 修推送 → P2 迁移会费提醒 → P3 按用户决定 → P4 修签到积分 → P5 标记 `functions/` 停用并同步文档。完成标准：每步在 `netlify dev` + 模拟器验证，推送一律 dryRun，部署由用户执行。
  - 2026-10-18 用户决定：10 月自动续费 → 不做，继续手动；1 月 1 日会费提醒 → 迁移；签到积分 → 在网页端恢复；活动前一天提醒 → 先不做，等推送修好后再议。`functions/` 先标记停用，保留一个月。
  - 进度：P1 修推送 ✅（commit `09c3af2`）；P2 迁移 1 月会费提醒 ✅（`netlify/functions/annual-dues-reminders.mjs`，模拟器验证通过）；P4 签到积分 ✅（单元测试 4 个通过）；P5 收尾待做。均未部署。
- [ ] **修复失败的积分规则测试**（2026-10-18 登记）。来源：`npx vitest run` 时 `tests/property/pointsRule.properties.test.ts` 报 `doc() cannot be called with an empty path`；撤掉本次改动后同样失败，属既有问题。影响：测试套件不是全绿，无法作为 CI 关卡。完成标准：查明原因并修好，全套测试通过。
- [ ] **部署 R-028 规则（用户执行）**（2026-10-18 登记）：`firebase deploy --only firestore:rules`。部署后验证：财政能对账配对、新用户能注册、会员能改电话。回滚：重新部署 `047b450` 的 `firestore.rules`。
- [ ] **导入会员时直接建 Firebase Auth 账号 + Super Admin「Fix Auth」补建按钮（需要确认计划）**（2026-10-18 用户提出）：导入会员资料时，按电邮和电话在 Firebase Auth 建账号（uid = 会员文档 ID，首次登录不再需要复制资料）；已导入的会员由 Super Admin 在会员页面 batch import 抽屉里的新按钮「Fix Auth」补建。来源：R-028 调查发现被邀请的导入会员首次登录会被拒。
  - 2026-10-18 计划已确认：Auth 账号 uid = 会员文档 ID；新建 `netlify/lib/memberAuth.mjs` + `netlify/functions/member-auth.mjs`（create 模式 ADMIN+；fix 模式仅 SUPER_ADMIN，默认试跑，写 auditLog）。用户决定：建账号后不自动发设置密码邮件，Fix Auth 可勾选发送；导入权限收紧到 ADMIN 以上；从未登录过的孤儿账号必须手动勾选才删除重建；删除 `useAuth.tsx` 登录时复制资料的逻辑，改为提示联系管理员。步骤：0 电话格式化 → 1 服务端函数 → 2 导入时自动建 → 3 Fix Auth 界面 → 4 删除复制路径。
  - 进度：0–4 步代码完成（`b51d2d0` + 本次提交），未部署。线上只读试跑：345 人中 8 人就绪、335 人待建、2 人需人工处理（见 R-040）。待办：部署后由 SUPER_ADMIN 先试跑再执行 Fix Auth；处理 SHANE TEOH、SHIRLEY PANG；`docs/PERMISSION_MATRIX.zh-CN.md` 记录导入按钮已收紧到 ADMIN+；`send-invite` / `auto-invite` 改用 `memberAuth` 的 uid=会员编号逻辑（另开任务）。
  - 顺带发现、另行处理：`membersService.createMember` 写入的 `memberEmails` 占位记录 email 为空（L615）；`useAuth.tsx` 调用 `check-and-create-auth`（L345）和 `delete-auth-user`（L206）时没带 token，两条路一直无效。
- [x] **部署规则（用户执行）** ✅ 2026-10-18 已部署，SUPER_ADMIN 签到线上验证通过（2026-10-18 登记）：R-034 修复 + `b83d671`（用户已同意）+ `65599ca`。命令：`firebase deploy --only firestore:rules,storage`。部署后验证：noreply@jcikl.cc（SUPER_ADMIN）能给他人签到。回滚：重新部署 `d8282b0` 的 `firestore.rules`。
- [ ] **重建蓝图第二轮核实：财务（P4）**。来源：重建蓝图 artifact 的验证顺序。完成标准：逐条核对 P4 验收标准和 2026-07-14 撤销审计的 9 个缺口，结果登记到风险清单。
- [ ] **重建蓝图第三轮核实：其余模块（P2、P3、P5–P7）**。完成标准同上。

---

## 文档创建记录

<!-- 新建 Markdown 文档时记录：文档、创建原因、所属主题、入口链接 -->

- `docs/ANALYSIS-HISTORY.md`（2026-10-11）：存放历次集合扫描结果与修复记录。原内容在 `CLAUDE.md` 中占约 150 行，属于历史记录而非规则；`TODO.md` 只管当前任务，`RISK_REGISTER.md` 是另一种风险格式，都不适合承载。入口：`CLAUDE.md` 第 7 节文档分工表。

---

## 已完成

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
