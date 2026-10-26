# JCI KL — Firestore 权限矩阵

> 数据来源：irestore.rules（1414 行）
> 更新时重读规则文件并重跑本文档生成。
>
> 2026-10-18（R-034）：此前 `canReadOrgMembers()` 和 11 处写死的 `['BOARD','ADMIN']` 漏掉了 SUPER_ADMIN，本表写作 B+ 的 eventRegistrations、notifications、inquiries、benefitUsage、webhooks、mentorMatches、mentorshipFeedback、memberEmails、nonMemberLeads 实际上不含 SUPER_ADMIN；规则已修正，现与本表一致。
>
> 2026-10-20（Phase 1）：新增外部自助注册创建分支；`surveys`、`surveyResponses`、`hobbyClubs`、`guestRegistrations`、`eventRegistrations`、`sisterChapters` 的规则按下表更新；外部会员状态变更改由 `netlify/functions/external-accounts` 在服务端完成。
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
> **注：** Firestore get 与 list 分别对应单文档读取与集合级查询；
esource.data 仅在 get 中可用，因此部分集合的 list 权限会比 get 更宽松（无法用文档字段做过滤）。

---

## 汇总表

| 集合 | get | list | create | update | delete | 备注 |
|------|-----|------|--------|--------|--------|------|
| members | 自己(登)；A+；M+/B+ 仅 KL 文档（loId 为 jcikl 或缺失，且非外部角色）；active CHAPTER_ADMIN 仅本分会文档 | A+；M+/B+ 且查询须带 `where('loId','==','jcikl')`；active CHAPTER_ADMIN 须带本分会 loId；非外部用户可按本人邮箱精确匹配 | B+ 或 自注册GUEST(注册表单字段，积分/等级/徽章只能是默认值，jciCareer 只能有 joinDate)；`role` 为 ADMIN / SUPER_ADMIN / AFFILIATE / CHAPTER_ADMIN 仅 A+ 可写（R-053）；例外：外部自助注册（`uid == 文档 id`、文档尚不存在、role 为 AFFILIATE、`loId` 不是 `jcikl` 且对应 `sisterChapters` 存在并 `isActive`、`affiliation` 恰好只有 `category` / `country` / `status`、`status` = `pending_chapter`、`category` 等于分会 `type` 的映射结果（规则函数 `categoryForChapterType`，对应 `utils/affiliation.mjs` `categoryForChapter`）、`country` 等于该分会的 `country`、其余字段限自注册键加 `affiliation`、GUEST 默认值检查同自注册） | 自己(非锁定字段；`affiliation` 已锁定；name/email 顶层或嵌套均可) 或 B+（不能把人设为 ADMIN / SUPER_ADMIN / CHAPTER_ADMIN）；（CHAPTER_ADMIN 的客户端状态分支已移除）；外部会员（AFFILIATE / CHAPTER_ADMIN）自己可在 `general.dob` 为空时设置一次（`birthdayMMDD` 须与之一致或不变）；分会管理人不再从客户端写会员文档：所有状态变更（批准、拒绝、停用、重新激活）都由 `external-accounts` function 在服务端完成（Admin SDK，不经过规则） | A+(同LO；SA 不限 LO) | 2026-10-18 R-034：SA 删除不受 LO 限制；2026-10-19 Phase 0：外部用户只能读自己的完整文档（active CHAPTER_ADMIN 另可读本分会文档）；其他外部会员的完整文档仅 A+ 可读，KL 普通读者改用 `memberCards` |
| memberCards | 自己；isAdmin()；其余读者须本人已开放名片（`privacy.shareCardInternationally == true`，互惠规则）且为 M+ / canReadOrgMembers / active 外部用户（`international == true` 或 loId 为本分会） | 同 get，但不含「自己」（外部用户的查询须带 `where('international','==',true)` 或 `where('loId','==',本分会)`） | 自己(MEMBER+ 或 active 外部) 或 canEditMembers；字段必须与 `memberCardKeys()` 完全一致；`loId` 与 `international` 须与同批写入/已有的 members 文档一致；members 文档不存在则拒绝 | 同 create | 自己 或 canEditMembers | Phase 0 新集合，卡片由 `MemberCardsService.syncCards` 同步（见 `SCHEMA.md` `memberCards`）；2026-10-26：`memberCardKeys()` 新增 `idealReferrals`；2026-10-26：`memberCardKeys()` 新增 `specialOffers`，仅 `international == true` 的卡可带（同 `phone` / `socials`），且须为 list |
| communication | 登 | 登 | M+(需含authorId) | 自己 或 B+ | 自己 或 B+ | |
| notifications | 自己 或 B+ | B+ 任意；其他已登录用户（含 GUEST、AFFILIATE、CHAPTER_ADMIN）只限自己，查询必须带 `where('memberId','==',uid)` | B+；M+ 限指定的自助通知类型 | （见规则） | （见规则） | 2026-10-25：list 原本只限 B+，普通会员的通知铃铛一直读不到自己的通知；App 顶部铃铛已不再加载 communication 动态 |
| events | 登 | 公 | B+ | B+ 或 M+(仅attendees字段) | B+ | list公开供宣传页使用 |
| projects | 登(或Active状态公开) | 公 | B+ | B+ 或 M+(仅attendees字段) | B+ | |
| lagship_projects | 公 | 公 | B+ | B+ | B+ | 对外展示集合 |
| 	asks | G+ | G+ | B+ | B+ 或 Assignee(自己) | B+ | |
| 	ransactions | B+/A+ | B+/A+ | A+/Finance(必填字段，非对账状态) | A+/Finance(字段白名单，非对账)；A+/Finance 可把已对账交易改回未对账(仅对账字段)；A+ 可作废已对账交易 | Finance(非对账/非清算) | 2026-10-18 R-028：白名单加入 reconciliation 与作废字段 |
| 	ransactionSplits | B+/A+ | B+/A+ | A+/Finance(父未对账) | A+/Finance(父未对账，字段白名单) | Finance(父未对账) | |
| projectTrx | B+/A+ | B+/A+ | B+(字段白名单) | B+(非对账，字段白名单) | B+(非对账) | |
| ankAccounts | Finance(同LO) | A+/Finance | Finance | Finance | Finance | get 限同LO |
| paymentRequests | 登(自己/Finance/A+) | M+/Finance/A+ | 登(自己) 或 B+/A+(代他人提交) | 自己(draft/cancel/resubmit) 或 Finance | 自己(draft) 或 A+ | 代他人提交来自 commit `b83d671`，2026-10-18 随 R-034 一起部署 |
| eventRegistrations | 登(自己/B+)；文档不存在时，仅当 id 以 `_` 加调用者 uid 结尾才允许（报名事务要先读尚不存在的 `{eventId}_{uid}`） | M+/B+；active 外部用户只列自己的（查询须带 `where('memberId','==',uid)`） | 登(自己或B+)；外部用户须 active | B+(字段白名单) 或 自己(非财务字段；`registrantLoId`、`currency` 也被锁定) | B+ | Phase 1：新增 `registrantLoId`、`currency` |
| points | 登 | 登 | B+ | B+/A+ | B+/A+ | |
| 
otifications | 自己 或 B+ | B+/A+ | B+ 或 M+(特定类型) | 自己(仅read字段) 或 B+ | 自己 或 B+ | list P0：resource.data 失效 |
| documents | 登 | 登 | B+ | B+ | A+ | |
| documentVersions | 登 | 登 | B+ | A+ | A+ | |
| surveys | 内部用户（`isInternalUser()`）；active 外部用户仅限 `specificMemberIds` 含自己，或 `openToExternals == true` 且 `status == 'Active'`（list 查询须带对应过滤条件） | 同 get | B+ | B+；其他人只有在问卷 `Active` 且自己能读时，才能只改 `responsesCount`（+1）和 `updatedAt`，并且同一次写入必须创建自己的 `surveyResponses/{surveyId}_{uid}` | B+ | Phase 1：`openToExternals` 由 B+ 写入 |
| surveyResponses | 自己/B+；文档不存在时只允许读自己的 id `{surveyId}_{uid}`（重复提交检查） | M+；active 外部用户只列自己的（查询须带 `where('memberId','==',uid)`） | 登(自己，无重复提交)；非 B+ 必须使用 id `{surveyId}_{uid}`；外部用户还须是 active，且问卷定向给自己或 `openToExternals == true` 且 `Active` | B+ | B+ | list P0：resource.data 失效 |
| workflows | B+ | B+ | B+ | B+ | A+ | |
| workflow_executions | B+ | B+ | B+ | A+ | A+ | 执行记录不可随意修改 |
| utomationRules | B+ | B+ | B+ | B+ | A+ | |
| inventoryItems | M+ | M+ | Finance | Finance(字段白名单) | Finance | |
| stock_movements | M+ | M+ | Finance | × (不可变审计记录) | A+ | update 完全禁止 |
| maintenance_schedules | M+ | M+ | Finance(字段白名单) | Finance(字段白名单) | Finance | |
| inventory_alerts | M+ | M+ | Finance(字段白名单) | Finance(字段白名单) | Finance | |
| hobbyClubs | 内部用户；active 外部用户仅限 `openToExternals == true`（list 须带该过滤条件） | 同 get | M+(非GUEST，且不能把 `openToExternals` 设为 true)/B+ | B+ 或 Lead(不能改 leadId / memberIds / openToExternals) | A+ | Phase 1：只有 B+ 能开放给其他分会 |
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
| 
econciliations | B+/A+ | B+/A+ | B+/A+(必填字段) | A+ 或 B+(仅notes字段) | A+ | |
| eventBudgets | B+/A+/创建者 | B+/A+ | B+/A+ | A+ 或 B+(字段白名单) | B+/A+ | |
| eventFeedback | B+/A+/自己 | B+/A+ | 登(自己，必填字段) | B+/A+ | B+/A+ | P0：匿名反馈对所有人可读 |
| projectReports | B+/A+ | B+/A+ | B+/A+ | B+/A+ | A+ | |
| guestRegistrations | B+/A+ | B+/A+ | 公(主文档字段验证且 `status == 'Pending'`，或电话索引形状；`projects/{eventId}` 必须存在且状态为 Active / Upcoming / Approved；已存在的 id 会变成更新，被拒绝) | B+(主文档：`status` / `checkedIn` / `checkedInAt` / `notes` / `updatedAt` / `cancelledAt`；电话索引文档：仅 `status`) | B+ | 访客报名用 `writeBatch` 同时写主文档与电话索引文档；访客取消后不能重新报名（见 `RISK_REGISTER.md` R-072） |
| oardMembers | 公 | 公 | B+ | B+(字段白名单) | B+ | |
| oardTransitions | 公 | 公 | B+ | B+ | B+ | |
| oardTermSettings | 公 | 公 | B+ | B+ | B+ | |
| zoomBookings | M+ | M+ | M+(自己) | B+ 或 自己 | × (不可删) | |
| mentorMatches | B+/A+/自己(师/学) | 登 | B+/A+ 或 自己(师/学) | B+/A+ 或 当事人(字段白名单) | B+/A+ | |
| mentorshipFeedback | B+/A+ | B+/A+ | 登 | B+/A+ | B+/A+ | |
| 	rainingModules | G+ | G+ | B+ | B+ | B+ | |
| contracts | 自己/B+/A+ | B+/A+ | M+(Draft/Pending) | A+/B+ 或 M+(签名字段) | A+ | |
| pointEscrow | 自己/B+/A+ | B+/A+ | A+ 或 M+(自己，Locked，字段白名单) | A+ 或 B+(字段白名单) | A+ | |
| incentivePrograms | 登 | 登 | A+ | B+/A+ | A+ | P0：多程序同时active |
| incentiveStandards | 登 | 登 | B+ | B+ | B+ | |
| incentiveSubmissions | 自己/B+/A+ | M+/A+ | A+/B+ 或 自己 | B+/A+ | B+/A+ | list P0：resource.data 失效 |
| loStarProgress | 自己(M+)/B+/A+ | M+ | B+/A+ | B+/A+ | B+/A+ | |
| system_config | 登 | 登 | B+/A+ | B+/A+ | B+/A+ | |
| systemSettings | 登 | 登 | A+ | A+ | A+ | |
| RegistrationHistory | 登 | 登 | B+ | B+ | B+ | P0已修：改用 COLLECTIONS.REGISTRATION_HISTORY（commit a3e19a9）|
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
| emailChangeRequests | × | × | × | × | × | 仅 Admin SDK（`netlify/functions/self-email`）读写；规则 `if false` |
| pointsRules | 登 | 登 | B+/A+ | B+/A+ | B+/A+ | |
| pointsRuleExecutions | B+/A+ | B+/A+ | 登(字段白名单) | A+ | A+ | ⚠️ P0：竞态→双倍积分 |
| irthdayNotificationsSent | × | × | × | × | × | ⚠️ 全禁止，仅Cloud Function |
| permissionCatalog | 登 | 登 | A+ | A+ | A+ | |
| sisterChapters | 公 | 公 | SA | SA | SA | Phase 1：外部自助注册表单在登录前要选分会，只含名称 / 国家 / logo，不含个人资料 |
| socialPosts | M+(自己或B+) | M+ | M+(自己，draft，字段验证) | B+/A+ 或 自己(draft/rejected) | A+ | |
| socialPersonas | M+ | M+ | B+ | B+ | B+ | |
| counters | — | — | — | — | — | ⚠️ P0：无Firestore规则→付款申请创建失败 |
| postcodes | 登 | 登 | A+ | A+ | A+ | |
| finance | 登 | 登 | Finance/A+ | Finance/A+ | Finance/A+ | 单文档 finance/meta，记录已有交易年份列表 |
| nonMemberLeads | B+ | B+ | 公(字段验证) | B+ | B+ | 匿名提交，B+ 管理 |
| userRolePermissions | 登 | 登 | A+ | A+ | A+ | 可配置权限规则引擎：按用户角色 |
| membershipTypePermissions | 登 | 登 | A+ | A+ | A+ | 可配置权限规则引擎：按会员类型 |
| positionPermissions | 登 | 登 | A+ | A+ | A+ | 可配置权限规则引擎：按担任职位 |

---

## 外部用户（AFFILIATE / CHAPTER_ADMIN）的规则范围

> 依据 `firestore.rules`（Phase 0）。外部角色不在 `isMember()` / `isActiveMember()` / `canReadOrgMembers()` / `isBoard()` / `isAdmin()` 中，因此依赖这些函数的规则对外部用户默认拒绝。下表只列规则里显式使用 `isExternal()` / `isInternalUser()` / `isActiveExternal()` 的集合；应用层的视图白名单见 `utils/externalAccess.ts`，不等同于规则范围。

**显式允许 active 外部用户（`isActiveExternal()`，或登录即可读且规则未排除外部）：**

| 集合 | 外部用户可做的事 | 限制 |
|------|------------------|------|
| `members` | 读自己的完整文档；active CHAPTER_ADMIN 读本分会文档；自己改非锁定字段 | 不能读其他外部会员完整文档；`affiliation` 锁定 |
| `memberCards` | 本人已开放名片后，读 `international == true` 或本分会的卡片（自己的卡片随时可读） | 只读；卡片写入由成员本人或 KL 编辑者完成；`memberCardKeys()` 为固定键集，含 `phone` / `socials` / `specialOffers`，且仅 `international == true` 的卡片可带这三个键（`validMemberCard`；`specialOffers` 须为 list） |
| `events` | 读（`get` 登录即可，`list` 公开）；更新 `attendees` / `registeredMembers` / `updatedAt` | 不能创建、删除；规则对 `list` 没有 KL 限制，只有应用层查询按 KL 主办 / 协办过滤（见 `RISK_REGISTER.md` R-058） |
| `eventRegistrations` | 只读和创建自己的报名 | 查询须带 `where('memberId','==',uid)` |
| `surveys` | 读 `specificMemberIds` 包含自己的问卷，或 B+ 已开放（`openToExternals == true`）且 `Active` 的问卷（list 查询须带对应过滤条件） | 只能在作答时把 `responsesCount` 加 1，不能创建、删除或改其他字段 |
| `surveyResponses` | 只列自己的回答；只能回答定向给自己的问卷，或已开放且 `Active` 的问卷 | 不能改、删 |
| `benefitUsage` | 读自己的使用记录；创建自己的记录 | 字段白名单 |
| `sisterChapters` | 读（公开，未登录也可读） | 只有 SUPER_ADMIN 可写 |
| `projects` | `get`：登录即可，或状态为 Active | 规则层未排除外部 |
| `memberBenefits` | 读（`isAuthenticated()`） | 只有 Board 可写 |
| `hobbyClubs` | 只读 B+ 已开放（`openToExternals == true`）的社团（list 查询须带该过滤条件） | 不能创建、更新、删除 |
| `advertisements` / `partnerships` | 读（公开） | 只有 Board / Admin 可写 |

**显式拒绝外部用户（规则条件中含 `isInternalUser()`，外部用户在该条件下被排除）：**
`communication`、`finance`、`paymentRequests`、`documents`、`documentVersions`、`points`、`pointsRules`、`pointsRuleExecutions`、`achievements`、`achievementAwards`、`achievementProgress`、`badges`、`badgeAwards`、`businessProfiles`、`inquiries`、`activityPlans`、`templates`、`promotionPackages`、`incentivePrograms`、`incentiveStandards`、`incentiveSubmissions`、`learningPaths`、`learningProgress`、`mentorMatches`、`mentorshipFeedback`、`publicBusinessListings`、`sponsorships`、`system`、`system_config`、`systemSettings`、`RegistrationHistory`、`toyyibBills`、`toyyibCategories`、`guestPageStats`、`counters`、`permissionCatalog`、`userRolePermissions`、`membershipTypePermissions`、`positionPermissions`（`surveys` 与 `benefitUsage` 只对白名单内的记录放行）。

其余集合依赖 `isMember()` / `isActiveMember()` / `canReadOrgMembers()` / `isBoard()` / `isAdmin()` 等角色函数，外部用户默认被拒绝。

**外部账号的重新激活与永久删除（2026-10-26，服务端，不经过规则）：** 都由 `netlify/functions/external-accounts`（Admin SDK）完成，`firestore.rules` 无需修改，客户端仍不能删除这些文档。重新激活 = `setStatus` → `active`：KL 管理员（ADMIN / SUPER_ADMIN）任意；active CHAPTER_ADMIN 只能解除 `suspendedByRole == 'CHAPTER_ADMIN'` 的本分会 AFFILIATE。永久删除 = `deleteAccount`（`canDeleteAccount`）：KL 管理员可删任何外部账号（AFFILIATE / CHAPTER_ADMIN，`loId` 不是 `jcikl`）；active CHAPTER_ADMIN 只能删本分会 AFFILIATE；不能删自己或 KL 会员。删除范围：`members`、`memberEmails`（`memberId` 相同的槽位）、`memberCards`、`emailChangeRequests`、`publicBusinessListings` 的同 id 文档与 Auth 账号；见 `RISK_REGISTER.md` R-092。

## P0 规则缺陷速查

| # | 集合 | 缺陷描述 | 状态 |
|---|------|---------|------|
| 2 | counters | 无规则块，paymentRequests 创建时序号生成 PERMISSION_DENIED | 已修（rules L1177-1182） |
| 6 | 
otifications | list 用 resource.data → 会员永远看不到自己的通知 | 已修 |
| 7 | 	ransactionSplits | get 规则缺少 loId 字段导致跨LO数据泄露 | 已修 |
| 8 | pointsRuleExecutions | getDoc→setDoc 竞态 → 双倍积分；全部写入无原子保障 | 部分修 |
| 9 | chievementProgress | list 原 resource.data 失效已修为 isAuthenticated() | 已修 |
| 11 | auditLog | AuditLogService 从未被调用（死代码）| 已修（financeService L2176、membersService L1281、paymentRequestService L467） |
| 12 | emailLogs | 无写入者，集合永远为空，邮件无审计记录 | 已修（emailService.logEmail() L90/130/145） |
| 13 | sponsorships | financeService 赞助收入硬编码为 0 | 已修（financeService L4579-4585 查 SponsorshipsService） |
| 14 | RADAR_CONTRIBUTIONS | COLLECTIONS.RADAR_CONTRIBUTIONS 常量不存在 → TypeScript 编译错误 + 运行时崩溃 | 已修（pointsService.ts L2438 改用 COLLECTIONS.REGISTRATION_HISTORY） |

---

*生成时间：2026-09-03 · 规则来源：firestore.rules · 分析框架版本：v6 · P0状态最后同步：2026-09-16（基线扫描）*
