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

- [ ] **需核实是否已部署**：v6 P0 专项修复（commit `1c9bba2`）涉及的 `firestore.rules` 与 Cloud Functions 改动。来源：原 `CLAUDE.md` 记录"待执行 `firebase deploy --only firestore:rules && firebase deploy --only functions`"（现见 `docs/ANALYSIS-HISTORY.md`）。影响：未部署则这些 P0 修复在生产环境不生效。完成标准：用户确认已部署，或对比线上 rules 与本地 `firestore.rules` 一致。部署须用户亲自批准。
- [ ] **另一会话产生的未提交文件，待用户决定去留**（2026-10-12 登记）：`CAPABILITIES.md`、`scripts/gen-capabilities.py`、`docs/development/{CLAUDE_MD_MIGRATION,CRUD_CHECKLIST,DECISION_PROTOCOLS,LAYER_RULES}.md`、`docs/collections/{ANALYSIS_FRAMEWORK,ANALYSIS_LOG}.md`，以及 `RISK_REGISTER(.zh-CN).md` 新增的 R-018～R-024。来源：2026-10-12 00:17 另一 AI 会话改写 CLAUDE.md 时生成。用户已决定保留 2026-10-11 版 CLAUDE.md，该会话的版本另存为 `docs/CLAUDE.md.bak-2026-10-12-other-session`（不入库）。影响：`ANALYSIS_LOG.md` 与 `docs/ANALYSIS-HISTORY.md` 内容重复；`CAPABILITIES.md` 能力地图可能有参考价值。完成标准：用户逐项决定提交、合并进现有文档或删除。

---

## 后续任务

<!-- 批次分析发现的范围外问题登记于此 -->

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
