# JCI KL 权限矩阵初稿

生成时间：2026-08-24。来源：对 `App.tsx`、`hooks/usePermissions.ts`、`utils/rolePermissions.ts`、`firestore.rules`、`netlify/functions/` 进行只读扫描。

## 目的

本文件用于回答三个问题：

1. 前端 UI 让谁看见入口？
2. Firestore Rules 实际允许谁读写数据？
3. Netlify/Firebase Functions 是否在服务端再次校验身份和角色？

结论先行：当前系统不是单一权限源，而是由 UI 权限、Firestore Rules、Serverless Function 授权共同组成。后续开发必须同时检查三层，否则容易出现“UI 看不到但 API 可写”或“UI 能点但规则拒绝”的问题。

## 角色与术语

- `GUEST`：已登录但未成为 active member 的访客/待审核用户。
- `MEMBER`：普通 active member。
- `BOARD`：静态 board role，或通过当前年度 board membership 动态获得 board 权限。
- `ADMIN`：管理员。
- `SUPER_ADMIN`：超级管理员。
- `INACTIVE`：停用用户，应被硬性限制。
- `isBoard()`：Firestore Rules 中包含 `BOARD`、`ADMIN`、`SUPER_ADMIN`，也包含 current board member。
- `isAdmin()`：Firestore Rules 中包含 `ADMIN`、`SUPER_ADMIN`。
- `canOperateFinance`：前端 `usePermissions.ts` 中的财务操作权限，主要给当前年度 treasurer/secretary/president。
- `canViewFinance`：前端静态/动态权限中的财务查看能力。

## 前端 UI 权限摘要

来源：`hooks/usePermissions.ts`、`App.tsx`。

| UI 能力 | 主要前端判断 | 备注 |
|---|---|---|
| Workspace 模块入口 | `canAccessWorkspaceModules` | 排除 `GUEST` 和 `INACTIVE`；允许 board/admin/super admin/honorary/senator。 |
| Events/Payment Requests 入口 | `canAccessEventsAndPayments` | active 非 guest/inactive 用户可进入部分活动与付款相关视图。 |
| Finance 入口 | `hasPermission('canViewFinance')` | MEMBER 默认无；动态 board 可能有；admin/super admin 有。 |
| Finance 写操作 | `canOperateFinance` | 当前年度 board 且职位包含 treasurer/secretary/president 等。 |
| Members 管理 | `isAdmin || isBoard || isDeveloper`，细节也用 `hasPermission('canEditMembers')` | Member 自己有个人资料视图。 |
| Automation | `isBoard || isAdmin` | Developer 在部分配置页也可见。 |
| System/Access Config | 多数为 `isAdmin || isBoard`，`AccessConfigView` 内部要求 `isAdmin` | UI 与页面内部有二次限制。 |
| Developer Interface | `isDeveloper || isAdmin` | Dev mode 对本地调试放大权限。 |
| Social Media | `hasPermission('canManageEvents')` 作为 BOD 判断，`isAdmin` 控制删除等高权限操作 | 与 Firestore `socialPosts` rules 需重点对齐。 |

## Firestore 集合权限矩阵

### 会员与身份

| 集合 | 读权限 | 写权限 | 风险/备注 | 测试优先级 |
|---|---|---|---|---|
| `users/{userId}` | 本人 | 本人 | 用于 FCM token 等用户私有数据。 | P2 |
| `members/{memberId}` | 本人、email 匹配、active member、org reader | 自助注册可 create guest；本人可更新非锁定字段；board/admin 可编辑；delete 仅 admin | 当前最大 PII 风险点：active member 可读面偏宽，list 依赖服务层过滤。 | P0 |
| `memberEmails/{email}` | authenticated + org reader | create board/admin；update/delete admin | email dedup 槽。Bulk import 可能绕过。 | P1 |
| `manualPromotionRequests` | board/admin/developer；本人可 get 自己 | board/admin/developer 可处理 | 晋升请求属于敏感状态。 | P1 |
| `promotionHistory` | board/admin/developer；member list/get 规则较宽 | board/admin/developer | 需确认 member 是否会看到过多历史。 | P2 |
| `mentorMatches` | authenticated，部分 get 限制 | authenticated 条件写 | 需要确认成员关系和 cross-reference 写入。 | P2 |
| `mentorshipFeedback` | authenticated 且相关方/board/admin | create authenticated；update/delete board/admin | 反馈可能含敏感内容。 | P2 |

### 活动、项目与任务

| 集合 | 读权限 | 写权限 | 风险/备注 | 测试优先级 |
|---|---|---|---|---|
| `events` | get authenticated；list public | create/delete board/admin；update board/admin 或 committee/organizer 条件 | list 公开，需确认列表字段不含敏感资料。 | P1 |
| `eventRegistrations` | authenticated，list active/member/org | create authenticated；update authenticated 条件；delete org reader | 报名、付款、签到状态要重点防止代写。 | P1 |
| `eventBudgets` | board/admin 或 createdBy；list board/admin | create/delete board/admin；update admin 或条件 | 财务相关。 | P1 |
| `eventFeedback` | board/admin 或本人 | create 本人；update/delete board/admin | 已修公开读风险，需回归测试。 | P2 |
| `projects` | get authenticated 或 active public；list public | create/delete board/admin；update board/admin 或负责人/committee 条件 | list 公开，需确认公开字段。 | P1 |
| `tasks` | member | create/delete board/admin；update board/admin 或 assignee/status 条件 | 项目任务状态会影响积分/项目进度。 | P2 |
| `activityPlans` | authenticated | create authenticated；update/delete board/admin | create 比 UI 管理权限宽，需确认是否设计如此。 | P1 |
| `projectReports` | board/admin | create/update board/admin；delete admin | 管理级资料。 | P2 |
| `flagship_projects` | public read | write board/admin | 公开页面数据。 | P3 |

### 财务、付款与对账

| 集合 | 读权限 | 写权限 | 风险/备注 | 测试优先级 |
|---|---|---|---|---|
| `transactions` | admin/board/finance access | create/update finance operator；delete 按 canDeleteFinance | 核心财务数据。 | P0 |
| `transactionSplits` | admin/board | create/update finance operator；delete canDeleteFinance | 与 transaction 一致性要测。 | P1 |
| `projectTrx` | admin/board/finance access | create/update finance operator；delete canDeleteFinance | 项目财务。 | P0 |
| `bankAccounts` | finance access | create/update/delete finance operator | 银行账户敏感。 | P0 |
| `paymentRequests` | 本人、finance、committee 条件 | create authenticated；update 本人/finance/approver 条件；delete 条件 | 状态机复杂，需测试 submitted/approved/rejected/paid/cancelled 等。 | P0 |
| `reconciliations` | admin/board | create board/admin；update admin 或条件；delete admin | 对账影响财务真相。 | P1 |
| `finance_alerts` | admin/finance access | create board/admin；update finance operator；delete admin | webhook/异常处理辅助。 | P1 |
| `toyyibCategories` | authenticated | board | Toyyib 配置。 | P1 |
| `toyyibBills` | board/admin/member 条件 | create/update/delete board 条件 | 支付状态需和 callback/server function 对齐。 | P0 |
| `toyyibpay_webhooks` | 禁止客户端读写 | 禁止客户端读写 | 仅服务端 callback 写入，设计合理。 | P1 |

### 自动化、工作流与 Webhook

| 集合 | 读权限 | 写权限 | 风险/备注 | 测试优先级 |
|---|---|---|---|---|
| `workflows` | board/admin | create/update board/admin；delete admin | 与 `workflowService`/`automationService` 重复实现相关。 | P1 |
| `workflow_executions` | board/admin | create board/admin；update/delete admin | 执行记录权限比 workflow 更严。 | P1 |
| `automationRules` | board/admin | create/update board/admin；delete admin | 规则执行可能触发写入。 | P1 |
| `webhooks` | authenticated + role condition | board/admin 类角色 | secret 字段处理曾是风险点；目前 service 会剥离 secret。 | P1 |
| `webhook_logs` | board/admin | create board/admin；update false；delete admin | 日志不可变性较好。 | P2 |
| `nudgeRules` | member | write board | member 可读所有 nudge rules，需确认内容是否敏感。 | P2 |

### 内容、公开页面与沟通

| 集合 | 读权限 | 写权限 | 风险/备注 | 测试优先级 |
|---|---|---|---|---|
| `communication` | authenticated | create active member；update/delete 作者或 board/admin | 公告/帖子。 | P2 |
| `documents` | authenticated | create/update board/admin；delete admin | 文档可能敏感。 | P2 |
| `documentVersions` | authenticated | create board/admin；update/delete admin | 版本和文件清理需测。 | P2 |
| `publications` | public read | write board | 访客 e-newsletter。 | P3 |
| `advertisements` | public read | create/delete board/admin；update board/admin 或条件 | 公开展示但管理写入。 | P2 |
| `partnerships` | public read | write board | 公开合作页面。 | P3 |
| `publicBusinessListings` | public read | authenticated 条件写 | 公开商业目录，需检查写入条件。 | P2 |
| `guestPageStats` | authenticated read；public create/update 受字段限制 | public create/update 统计字段；delete admin | 访客统计允许匿名写，必须保持严格字段白名单。 | P1 |
| `guestRegistrations` | board/admin | public create 受字段限制；update board/admin；delete board | 公开报名入口，防 spam/字段注入。 | P1 |
| `nonMemberLeads` | org reader | public create 受字段限制；update/delete org reader | 公开 lead 入口，需反滥用。 | P1 |

### 学习、激励与游戏化

| 集合 | 读权限 | 写权限 | 风险/备注 | 测试优先级 |
|---|---|---|---|---|
| `points` | authenticated | create/update/delete board/admin | 积分影响 ranking/benefit。 | P1 |
| `pointsRules` | authenticated | board/admin | 规则变更影响全系统积分。 | P1 |
| `pointsRuleExecutions` | board/admin read | create authenticated 且字段限制；update/delete admin | 客户端可 create execution log，需测试字段白名单。 | P1 |
| `badges` / `badgeAwards` | authenticated | board | 游戏化奖励。 | P2 |
| `achievements` / `achievementAwards` | authenticated | board | 游戏化奖励。 | P2 |
| `achievementProgress` | 本人/board/admin get；authenticated list | create/update/delete admin | list 较宽，需确认不泄露。 | P2 |
| `incentivePrograms` | authenticated | create/delete admin；update board/admin | 激励项目。 | P2 |
| `incentiveStandards` | authenticated | board | 标准影响积分/奖励。 | P2 |
| `incentiveSubmissions` | 本人/board/admin | 本人或 board/admin 条件 | 提交材料可能敏感。 | P2 |
| `loStarProgress` | 本人/board/admin；member list | write board/admin | 进度聚合。 | P2 |
| `trainingModules` | guest/member/board/admin | write board | 训练模块。 | P3 |
| `learningPaths` | authenticated | write board | 学习路径。 | P3 |
| `learningProgress` | 本人/board/admin；member list | create/update/delete 本人或 board/admin | list 是否过宽需确认。 | P2 |
| `certificates` | authenticated | create authenticated；update/delete admin | create 较宽，service 已有完成度校验，Rules 仍需测试。 | P1 |

### 库存、系统与配置

| 集合 | 读权限 | 写权限 | 风险/备注 | 测试优先级 |
|---|---|---|---|---|
| `inventory` | authenticated member | create/delete finance operator；update finance operator 条件 | 库存价值可能与财务相关。 | P1 |
| `stock_movements` | authenticated member | create finance operator；update 禁止；delete admin | append-only 设计合理。 | P2 |
| `maintenance_schedules` | authenticated member | finance operator | 库存维护。 | P2 |
| `inventory_alerts` | authenticated member | finance operator | alert acknowledge 等需测。 | P2 |
| `system_config` | authenticated | board/admin | 系统配置面较宽。 | P1 |
| `system` | authenticated | board | 系统级配置。 | P1 |
| `permissionCatalog` | authenticated | admin | 权限配置核心。 | P0 |
| `userRolePermissions` | authenticated | admin | 权限配置核心。 | P0 |
| `membershipTypePermissions` | authenticated | admin | 权限配置核心。 | P0 |
| `positionPermissions` | authenticated | admin | 权限配置核心。 | P0 |
| `auditLog` | admin read；board/admin create | update/delete 禁止 | 审计日志不可改。 | P1 |
| `systemLogs` | admin | create admin；delete admin；update 禁止 | 系统日志。 | P2 |
| `errorLogs` | board read；authenticated create；board update；admin delete | 见前 | 客户端可写 error log，需字段/PII 约束。 | P2 |
| `emailLogs` | board/admin read | create authenticated；update/delete admin | create 较宽，需确认不会被 spam。 | P2 |
| `postcodes` | authenticated | admin | 配置数据。 | P3 |

### 其他业务域

| 集合 | 读权限 | 写权限 | 风险/备注 | 测试优先级 |
|---|---|---|---|---|
| `businessProfiles` | authenticated | 本人 create/update；admin/board delete | `COLLECTIONS` 注释标为 dead/partial，需要确认是否仍使用。 | P2 |
| `hobbyClubs` | authenticated | active member 可 create；owner/board/admin update；admin delete | owner 判断需测。 | P2 |
| `benefitUsage` | authenticated | 本人/条件写 | 会员权益使用记录。 | P2 |
| `memberBenefits` | authenticated | board | 权益配置。 | P2 |
| `contracts` | 本人/board/admin get；list board/admin | member create；board/admin/参与方条件 update；delete admin | 与 point escrow/惩罚相关。 | P1 |
| `pointEscrow` | 本人/board/admin get；list board/admin | admin 或严格条件 create/update；delete admin | 积分托管，需状态机测试。 | P1 |
| `bounties` | authenticated | create/update board/admin；delete admin | 新/局部功能，需确认使用状态。 | P2 |
| `sisterChapters` | active member | SUPER_ADMIN | 对外关系数据。 | P2 |
| `socialPosts` | active member，部分本人/board get | 本人 create；board/admin update；admin delete | 社媒审批状态机需测试。 | P1 |
| `socialPersonas` | active member | board | 账号/persona 配置。 | P1 |
| `birthdayNotificationsSent` | 禁止客户端读写 | 禁止客户端读写 | 服务端生日任务专用。 | P2 |

## Netlify Functions 权限矩阵

| Function | 认证方式 | 角色要求 | 主要写入/外部操作 | 风险/备注 |
|---|---|---|---|---|
| `audit-log.mjs` | Firebase ID token | `BOARD`/`ADMIN`/`SUPER_ADMIN` | 写 `auditLog` | 为 board 绕过 Firestore create 限制的服务端入口。 |
| `auto-invite.mjs` | 无登录；email + rate limit + neutral response | 无 | 查 `members`，创建 Auth user，发送 password reset，写 `emailLogs` | 公开入口但有中性响应和限流；仍应监控滥用。 |
| `birthday-notifications.mjs` | `CRON_SECRET` header/query | cron secret | 查会员，发生日通知，写 sent marker | query secret 有日志泄露风险，优先 header。 |
| `check-and-create-auth.mjs` | Firebase ID token | `BOARD`/`ADMIN`/`SUPER_ADMIN` | 检查/创建 Auth account | 特权入口。 |
| `check-auth-email.mjs` | Firebase ID token | `BOARD`/`ADMIN`/`SUPER_ADMIN` | 检查 Auth email | PII/账号枚举风险已用角色限制。 |
| `check-member-field.mjs` | Firebase ID token | `BOARD`/`ADMIN`/`SUPER_ADMIN` | 枚举/检查 member 字段 | PII 风险，需保留严格角色。 |
| `cloudinary-delete.mjs` | Firebase ID token | `BOARD`/`ADMIN`/`SUPER_ADMIN` | Cloudinary signed delete | 有 publicId prefix allowlist。 |
| `delete-auth-user.mjs` | Firebase ID token | `ADMIN`/`SUPER_ADMIN` | 删除 Firebase Auth user | 高风险，不应给 board。 |
| `jci-proxy.mjs` | 无 | public | 代理 `jcimalaysia.cc` 公开 event HTML | eventid 限制为数字；返回 HTML。 |
| `lark-sync.mjs` | Firebase ID token | 本人或 `BOARD`/`ADMIN`/`SUPER_ADMIN` | Lark API、Firestore member data | 同步范围和 PII 需审计。 |
| `send-email.mjs` | Firebase ID token | `BOARD`/`ADMIN`/`SUPER_ADMIN` | Resend/SendGrid/SMTP 发送邮件 | 已限制 MEMBER，需继续限制 recipient flood。 |
| `send-invite.mjs` | Firebase ID token | `ADMIN`/`SUPER_ADMIN` | 创建/邀请 Auth user | 高风险，合理限制 admin。 |
| `send-push-test.mjs` | Firebase ID token | `ADMIN`/`SUPER_ADMIN` | 写 notification，发 FCM | 管理测试工具。 |
| `social-ai-rewrite.mjs` | Firebase ID token | `BOARD`/`ADMIN`/`SUPER_ADMIN` | 调用 GROQ API | 外部 AI 费用/数据泄露需控制 payload。 |
| `toyyibpay-api.mjs` | Firebase ID token | 一般 action 需登录；`createCategory`/`createBill`/`setMode` 需 `BOARD`/`ADMIN`/`SUPER_ADMIN` | ToyyibPay API、systemConfig | 支付入口，必须保留 allowlist 和 return/callback URL 锁定。 |
| `toyyibpay-callback.mjs` | shared secret query | webhook secret | ToyyibPay 查证、写 bills/transactions/alerts/webhook idempotency | 无 Toyyib 原生签名，shared secret 是关键边界。 |
| `update-auth-email.mjs` | Firebase ID token | admin 可改他人；非 inactive 只能改自己 | 更新 Firebase Auth email | 与 member profile email 同步相关。 |
| `whapi-proxy.mjs` | Firebase ID token | `BOARD`/`ADMIN`/`SUPER_ADMIN` | WHAPI 外部调用 | 第三方 token 仅服务端。 |
| `zoom-create-meeting.mjs` | Firebase ID token | `BOARD`/`ADMIN`/`SUPER_ADMIN` | Zoom API、Firestore booking | 特权会议创建。 |
| `zoom-cancel-meeting.mjs` | Firebase ID token | `BOARD`/`ADMIN`/`SUPER_ADMIN` | Zoom API、Firestore booking | 特权会议取消。 |
| `zoom-webhook.mjs` | Zoom HMAC signature | Zoom webhook secret | 更新 `zoomBookings` | 签名校验存在；需考虑 timestamp replay window。 |

## UI 与 Rules/Functions 的重点不一致

| 区域 | 现象 | 风险 | 建议 |
|---|---|---|---|
| `members` 读取 | UI 会隐藏部分 sensitive fields，但 Firestore 对 active member 的读权限较宽 | 客户端过滤不能保护 PII | 拆分 public directory 与 sensitive profile，或服务端读取敏感字段。 |
| `activityPlans` create | UI 主要 board/admin 管理，但 Rules 允许 authenticated create | 普通用户可能可直接写入 activityPlans | 确认产品意图；若非预期，收紧 Rules。 |
| `certificates` create | service 有完成度校验，但 Rules 允许 authenticated create | 用户可能绕过服务层直接创建 certificate | 将完成度校验移入 Rules 可表达范围，或改为 server function。 |
| `guestPageStats` public write | 允许匿名 create/update 统计字段 | spam/计数污染 | 保持严格字段白名单，增加速率限制或服务端聚合。 |
| Workflow/Automation | UI、client services、Cloud Functions 都有 workflow 概念 | 权限和执行语义漂移 | 选定 canonical engine。 |
| ToyyibPay callback | 使用 query secret 而非签名 | URL 日志泄露会影响 callback 安全 | 优先使用难猜 secret、定期轮换、避免日志记录完整 URL。 |
| Zoom webhook | 有 HMAC，但未看到 timestamp freshness 检查 | replay 风险 | 增加 timestamp 窗口校验。 |

## P0 测试清单

优先为以下边界写 Firestore emulator tests 或 function tests：

1. `GUEST` 不能 list/read 敏感 `members` 字段。
2. `MEMBER` 不能修改自己的 `role`、`points`、`jciCareer`、`isDeveloper`、board 字段。
3. `BOARD` 不能把任何人提升为 `ADMIN` 或 `SUPER_ADMIN`。
4. `INACTIVE` 不能 self-write，也不能访问 workspace 数据。
5. 非 finance operator 不能 create/update/delete `transactions`、`projectTrx`、`bankAccounts`。
6. `paymentRequests` 的审批、拒绝、付款、删除状态流转不能被普通会员绕过。
7. 非 admin 不能写 `permissionCatalog`、`userRolePermissions`、`membershipTypePermissions`、`positionPermissions`。
8. 客户端不能读写 `toyyibpay_webhooks` 和 `birthdayNotificationsSent`。
9. `toyyibpay-api` 对 `createBill`、`setMode` 强制 BOARD+，并锁定 callback/return URL。
10. `delete-auth-user` 和 `send-invite` 只允许 ADMIN/SUPER_ADMIN。

## 后续维护规则

- 新增任何模块时，必须在本文件添加一行：UI 入口、Firestore 集合、Function 入口、测试优先级。
- 修改 `firestore.rules` 时，同步更新本文件。
- 新增 Netlify Function 时，必须写明：认证方式、角色要求、写入集合、外部 API、是否含 secret。
- UI 权限不得作为安全依据；所有敏感写入必须有 Rules 或 Function 服务端角色校验。

