# 集合分析记录（Analysis Log）

> 从 CLAUDE.md 迁出（原第 398–547 行），内容未改动。每次分析完成后，在本文件追加结果，不再写入 CLAUDE.md。

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

**第六批扫描（2026-09-03，uncovered-collections）— P0×6 P1×35 P2×25 Total×66**

| 集合 | 分析日期 | 逻辑错误数（P0/P1/P2）| 变体不对称数 | 退回完整度 | 关键P0摘要 |
|------|----------|-----------------------|------------|-----------|-----------|
| `nudges` | 2026-09-03 | 7（2/3/2）| 0 | 缺失 | Firestore规则完全缺失→dismiss永久失败；dismissed状态从不读Firestore→关闭后刷新重现 |
| `boardMembers + boardTransitions` | 2026-09-03 | 9（1/6/2）| 2 | 部分 | executeBoardTransition先标completed再writeBatch→批次失败时换届永久显示已完成但boardMembers未变更 |
| `RegistrationHistory` | 2026-09-03 | 5（1/3/1）| 1 | 缺失 | COLLECTIONS.RADAR_CONTRIBUTIONS常量不存在→recalculateMemberRadarStats运行时崩溃，雷达统计永不更新 |
| `counters + system + system_config` | 2026-09-03 | 5（1/2/2）| 1 | 部分 | counters集合无Firestore规则→生产环境所有付款申请创建PERMISSION_DENIED全部失败 |
| `socialPosts + socialPersonas` | 2026-09-03 | 7（1/4/2）| 2 | 部分 | allow update无hasOnly白名单→BOD可修改submittedBy等不可变字段实现署名欺诈 |
| `zoomBookings` | 2026-09-03 | 7（0/5/2）| 1 | 部分 | — |
| `mentorshipFeedback` | 2026-09-03 | 7（0/4/3）| 0 | 缺失 | — |
| `errorLogs` | 2026-09-03 | 6（0/2/4）| 3 | 缺失 | — |
| `sisterChapters` | 2026-09-03 | 5（0/2/3）| 1 | 缺失 | — |
| `systemSettings + permissionCatalog` | 2026-09-03 | 8（0/4/4）| 1 | 缺失 | — |

**v4 全库重分析（2026-07-19，修复5集合后）— P0×90 P1×312 P2×191 Total×593（vs v3: 616，净减23）**

本次修复：callback.js P0×3、membersService.ts P0×1、App.tsx P0×1、eventsService.ts P1、firestore.rules 5集合。
Top P0集合：transactions×3、pointsRuleExecutions×3、conversations×3；退回完整度：完整1个（guestPageStats）、部分60个、缺失13个。
Firestore rules 5项修复已写入文件，**待执行 `firebase deploy --only firestore:rules` 生效**。

**v5 全库重分析（2026-07-19，修复所有P1后）— P0×91 P1×311 P2×199 Total×601（vs v4: +8，更深入分析）**

**v6 全库重分析（2026-07-19，修复全部P0+P1+P2后）— P0×71 P1×309 P2×253 Total×633（vs v5: P0↓20 P1↓2 P2↑54）**

本次修复：16路并行 agent 修复所有服务层+Firestore规则（P0+P1+P2），commit `8ceaede`。
P0减少20条（91→71）确认修复生效；P2增加54条因分析粒度更深。
Top P0集合：pointsRuleExecutions×3、webhooks×3、birthdayNotificationsSent×3；退回完整度：完整1个（boardTermSettings）、部分55个、缺失25个。

**v6 P0专项修复（2026-07-19）— 17路并行 agent，commit `1c9bba2`**

修复内容：
- firestore.rules：pointsRuleExecutions hasOnly白名单扩展；workflow_executions create限Board/Admin；systemLogs create限Admin+hasOnly；webhook_logs hasOnly；points create限Board/Admin（防自我加分）；communication update改用resource.data.authorId；advertisements update hasOnly修正；achievementProgress list开放isAuthenticated；manualPromotionRequests create强制status==pending
- services/gamificationService.ts：成就进度计算新增recruitment/training/role三种类型
- services/promotionService.ts：overrideRequirements仅ADMIN可绕过审批
- functions/src/notifications.ts + functions/lib/notifications.js：生日通知去重（birthdayNotificationsSent集合）
- netlify/functions/birthday-notifications.js：停用（Cloud Function为唯一发送方）
- App.tsx：移除客户端生日通知生成（避免每台设备重复触发）

**待执行：`firebase deploy --only firestore:rules && firebase deploy --only functions`**

### 已分析集合（collection-deps）

| 集合 | 分析日期 | 联动集合数 | 强耦合 | 中耦合 | 弱耦合 | P0风险数 | P0风险摘要 |
|------|----------|-----------|-------|-------|-------|---------|-----------|
| `transactions` | 2026-07-16 | 10 | 3（`transactionSplits`, `members`, `projectTrx`）| 4（`paymentRequests`, `inventoryItems`, `notifications`, `reconciliations`）| 2（`financeAlerts`, `eventRegistrations`）+ 1 自引用 | 3 | rules `loId` 判断失效（全 LO 数据泄露）；`revertPaid` 非批次（PR 永久 Paid 但无交易）；删 Membership 交易不清 `members.transactionId[]` |

---
