# JCI KL — Firestore 权限矩阵

> 数据来源：irestore.rules（1414 行）
> 更新时重读规则文件并重跑本文档生成。
>
> **角色缩写**
> | 缩写 | 含义 |
> |------|------|
> | 公 | 公开（无需登录，allow if true）|
> | 登 | 任意已登录用户（isAuthenticated）|
> | G+ | GUEST+，包含 GUEST 角色（isMember）|
> | M+ | MEMBER+，排除 GUEST（isActiveMember）|
> | B+ | BOARD / ADMIN / SUPER_ADMIN 或现任理事会成员（isBoard）|
> | Finance | 现任理事会财务主管/秘书/会长（isFinanceOperator）|
> | A+ | ADMIN / SUPER_ADMIN（isAdmin）|
> | SA | 仅 SUPER_ADMIN |
> | × | 完全禁止（allow if false，仅 Admin SDK 可访问）|
> | — | 规则文件中无对应 allow 块（等同 × ）|
>
> **注：** Firestore get 与 list 分别对应单文档读取与集合级查询；esource.data 仅在 get 中可用，因此部分集合的 list 权限会比 get 更宽松（无法用文档字段做过滤）。

---

## 汇总表

| 集合 | get | list | create | update | delete | 备注 |
|------|-----|------|--------|--------|--------|------|
| members | M+(自己:登) | M+ | B+ 或 自注册GUEST(仅GUEST字段) | 自己(非锁定字段) 或 B+ | A+(同LO) | |
| communication | 登 | 登 | M+(需含authorId) | 自己 或 B+ | 自己 或 B+ | |
| events | 登 | 公 | B+ | B+ 或 M+(仅attendees字段) | B+ | list公开供宣传页使用 |
| projects | 登(或Active状态公开) | 公 | B+ | B+ 或 M+(仅attendees字段) | B+ | |
| lagship_projects | 公 | 公 | B+ | B+ | B+ | 对外展示集合 |
| 	asks | G+ | G+ | B+ | B+ 或 Assignee(自己) | B+ | |
| 	ransactions | B+/A+ | B+/A+ | A+/Finance(必填字段，非对账状态) | A+/Finance(字段白名单，非对账) | Finance(非对账/非清算) | |
| 	ransactionSplits | B+/A+ | B+/A+ | A+/Finance(父未对账) | A+/Finance(父未对账，字段白名单) | Finance(父未对账) | |
| projectTrx | B+/A+ | B+/A+ | B+(字段白名单) | B+(非对账，字段白名单) | B+(非对账) | |
| ankAccounts | Finance(同LO) | A+/Finance | Finance | Finance | Finance | get 限同LO |
| paymentRequests | 登(自己/Finance/A+) | M+/Finance/A+ | 登(自己) | 自己(draft/cancel/resubmit) 或 Finance | 自己(draft) 或 A+ | |
| 
onMemberLeads | B+ | B+ | 公(字段验证) | B+ | B+ | 匿名提交，B+ 管理 |
| eventRegistrations | 登(自己/B+) | M+/B+ | 登(自己或B+) | B+(字段白名单) 或 自己(非财务字段) | B+ | |
| points | 登 | 登 | B+ | B+/A+ | B+/A+ | |
| 
otifications | 自己 或 B+ | B+/A+ | B+ 或 M+(特定类型) | 自己(仅read字段) 或 B+ | 自己 或 B+ | list P0：resource.data 失效 |
| documents | 登 | 登 | B+ | B+ | A+ | |
| documentVersions | 登 | 登 | B+ | A+ | A+ | |
| surveys | 登 | 登 | B+ | B+ | B+ | |
| surveyResponses | 自己/B+ | M+ | 登(自己，无重复提交) | B+ | B+ | list P0：resource.data 失效 |
| workflows | B+ | B+ | B+ | B+ | A+ | |
| workflow_executions | B+ | B+ | B+ | A+ | A+ | 执行记录不可随意修改 |
| utomationRules | B+ | B+ | B+ | B+ | A+ | |
| inventoryItems | M+ | M+ | Finance | Finance(字段白名单) | Finance | |
| stock_movements | M+ | M+ | Finance | × (不可变审计记录) | A+ | update 完全禁止 |
| maintenance_schedules | M+ | M+ | Finance(字段白名单) | Finance(字段白名单) | Finance | |
| inventory_alerts | M+ | M+ | Finance(字段白名单) | Finance(字段白名单) | Finance | |
| hobbyClubs | 登 | 登 | M+(非GUEST)/B+ | B+ 或 Lead(非leadId/memberIds) | A+ | |
| usinessProfiles | 登 | 登 | 登(自己) | A+ 或 自己(非memberId) | A+/B+ | |
| inquiries | 登(发/收方或B+) | M+/B+ | 登(senderId=自己) | 自己(发/收方) 或 B+ | B+ | |
| adges | 登 | 登 | B+ | B+ | B+ | |
| adgeAwards | 登 | 登 | B+ | B+ | B+ | |
| chievements | 登 | 登 | B+ | B+ | B+ | |
| chievementAwards | 登 | 登 | B+ | B+ | B+ | |
| chievementProgress | 自己/B+/A+ | 登 | A+ | A+ | A+ | list P0：resource.data 失效已修复 |
| dvertisements | 公 | 公 | B+/A+ | B+/A+ 或 登(仅计数字段) | B+/A+ | |
| promotionPackages | 登 | 登 | B+ | B+ | B+ | |
| manualPromotionRequests | B+/A+/自己 | B+/A+ | B+(pending)/A+(approved) | B+/A+ | B+/A+ | P0: overrideReq已修为仅A+ |
| promotionHistory | B+/A+/自己 | M+/B+ | B+/A+ | B+/A+ | B+/A+ | list P0：resource.data 失效 |
| ctivityPlans | 登 | 登 | 登 | B+ | B+ | |
| 	emplates | 登 | 登 | B+ | B+ | B+ | |
| memberBenefits | 登 | 登 | B+ | B+ | B+ | |
| enefitUsage | 登 | 登 | 登(自己，字段白名单) | B+ | B+ | |
| webhooks | B+ | B+ | B+ | B+ | B+ | |
| webhook_logs | B+ | B+ | B+(字段白名单) | × (不可变) | A+ | |
| econciliations | B+/A+ | B+/A+ | B+/A+(必填字段) | A+ 或 B+(仅notes字段) | A+ | |
| eventBudgets | B+/A+/创建者 | B+/A+ | B+/A+ | A+ 或 B+(字段白名单) | B+/A+ | |
| eventFeedback | B+/A+/自己 | B+/A+ | 登(自己，必填字段) | B+/A+ | B+/A+ | P0：匿名反馈对所有人可读 |
| projectReports | B+/A+ | B+/A+ | B+/A+ | B+/A+ | A+ | |
| guestRegistrations | B+/A+ | B+/A+ | 公(字段验证) | B+(字段白名单) | B+ | |
| oardMembers | 公 | 公 | B+ | B+(字段白名单) | B+ | |
| oardTransitions | 公 | 公 | B+ | B+ | B+ | |
| oardTermSettings | 公 | 公 | B+ | B+ | B+ | |
| zoomBookings | M+ | M+ | M+(自己) | B+ 或 自己 | × (不可删) | |
| mentorMatches | B+/A+/自己(师/学) | 登 | B+/A+ 或 自己(师/学) | B+/A+ 或 当事人(字段白名单) | B+/A+ | |
| mentorshipFeedback | B+/A+ | B+/A+ | 登 | B+/A+ | B+/A+ | |
| 	rainingModules | G+ | G+ | B+ | B+ | B+ | |
| learningPaths | 登 | 登 | B+ | B+ | B+ | |
| learningProgress | 自己/B+/A+ | M+/B+/A+ | 登(自己) | B+/A+ 或 自己 | B+/A+ 或 自己 | |
| certificates | 登 | 登 | 登 | A+ | A+ | P0：任意用户可自颁证书 |
| 
udgeRules | M+ | M+ | B+ | B+ | B+ | |
| 
udges | — | — | — | — | — | ⚠️ P0：无Firestore规则，dismiss永久失败 |
| contracts | 自己/B+/A+ | B+/A+ | M+(Draft/Pending) | A+/B+ 或 M+(签名字段) | A+ | |
| pointEscrow | 自己/B+/A+ | B+/A+ | A+ 或 M+(自己，Locked，字段白名单) | A+ 或 B+(字段白名单) | A+ | |
| incentivePrograms | 登 | 登 | A+ | B+/A+ | A+ | P0：多程序同时active |
| incentiveStandards | 登 | 登 | B+ | B+ | B+ | |
| incentiveSubmissions | 自己/B+/A+ | M+/A+ | A+/B+ 或 自己 | B+/A+ | B+/A+ | list P0：resource.data 失效 |
| loStarProgress | 自己(M+)/B+/A+ | M+ | B+/A+ | B+/A+ | B+/A+ | |
| system_config | 登 | 登 | B+/A+ | B+/A+ | B+/A+ | |
| systemSettings | 登 | 登 | A+ | A+ | A+ | |
| RegistrationHistory | 登 | 登 | B+ | B+ | B+ | P0：COLLECTIONS常量不存在 |
| sponsorships | 登 | 登 | B+/A+ | B+/A+ | B+/A+ | P0：financeService硬编码0 |
| system | 登 | 登 | B+ | B+ | B+ | |
| publications | 公 | 公 | B+ | B+ | B+ | |
| publicBusinessListings | 公 | 公 | 自己 或 B+ | 自己 或 B+ | 自己 或 B+ | |
| errorLogs | B+ | B+ | 登 | B+ | A+ | |
| guestPageStats | 登 | 登 | 公(格式验证) | 公(仅计数字段) | A+ | |
| partnerships | 公 | 公 | B+ | B+ | B+ | |
| 	oyyibCategories | 登 | 登 | B+ | B+ | B+ | |
| 	oyyibBills | B+/A+/自己 | M+/B+/A+ | B+ 或 自己 | B+ | B+ | |
| 	oyyibpay_webhooks | × | × | × | × | × | ⚠️ 全禁止，仅Admin SDK |
| inance_alerts | Finance/A+ | B+/A+ | B+(字段验证) | Finance(仅解决字段) | A+ | |
| uditLog | A+ | A+ | B+/A+ | × (不可变) | × (不可变) | ⚠️ P0：Service层从未调用 |
| systemLogs | A+ | A+ | A+(字段白名单) | × (不可变) | × (不可变) | |
| webhook_logs | B+ | B+ | B+(字段白名单) | × (不可变) | A+ | |
| emailLogs | B+/A+ | B+/A+ | 登 | A+ | A+ | ⚠️ P0：无写入者，集合永远为空 |
| memberEmails | B+/A+ | B+/A+ | B+/A+ | A+ | A+ | |
| pointsRules | 登 | 登 | B+/A+ | B+/A+ | B+/A+ | |
| pointsRuleExecutions | B+/A+ | B+/A+ | 登(字段白名单) | A+ | A+ | ⚠️ P0：竞态→双倍积分 |
| irthdayNotificationsSent | × | × | × | × | × | ⚠️ 全禁止，仅Cloud Function |
| permissionCatalog | 登 | 登 | A+ | A+ | A+ | |
| sisterChapters | M+ | M+ | SA | SA | SA | |
| socialPosts | M+(自己或B+) | M+ | M+(自己，draft，字段验证) | B+/A+ 或 自己(draft/rejected) | A+ | |
| socialPersonas | M+ | M+ | B+ | B+ | B+ | |
| counters | — | — | — | — | — | ⚠️ P0：无Firestore规则→付款申请创建失败 |
| conversations | — | — | — | — | — | ⚠️ P0：无规则→任意用户读所有私信 |

---

## P0 规则缺陷速查

| # | 集合 | 缺陷描述 | 状态 |
|---|------|---------|------|
| 1 | 
udges | 无 Firestore 规则块，dismiss 写入永久失败 | 待修 |
| 2 | counters | 无规则块，paymentRequests 创建时序号生成 PERMISSION_DENIED | 待修 |
| 5 | conversations | 无规则块，任意登录用户可读所有私信 | 待修 |
| 6 | 
otifications | list 用 resource.data → 会员永远看不到自己的通知 | 已修 |
| 7 | 	ransactionSplits | get 规则缺少 loId 字段导致跨LO数据泄露 | 已修 |
| 8 | pointsRuleExecutions | getDoc→setDoc 竞态 → 双倍积分；全部写入无原子保障 | 部分修 |
| 9 | chievementProgress | list 原 resource.data 失效已修为 isAuthenticated() | 已修 |
| 10 | certificates | 任意已登录用户可自颁证书（create: isAuthenticated） | 待修 |
| 11 | uditLog | AuditLogService 从未被调用（死代码）| 待修 |
| 12 | emailLogs | 无写入者，集合永远为空，邮件无审计记录 | 待修 |
| 13 | sponsorships | financeService 赞助收入硬编码为 0 | 待修 |
| 14 | RegistrationHistory | COLLECTIONS.RADAR_CONTRIBUTIONS 常量不存在 → 运行时崩溃 | 待修 |

---

*生成时间：2026-09-03 · 规则来源：irestore.rules · 分析框架版本：v6*
