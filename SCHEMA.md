# JCI KL — Firestore Collection Schema Reference

> 自动生成自 `types.ts`。每个集合列出 TypeScript 接口、所有字段路径、类型和枚举值。
> 更新时重新运行 workflow `generate-schema-md`。
> **“来 / 往”字段流规则：** `来` 记录实际写入或维护来源（角色填写、管理员操作、系统计算、服务同步、导入流程或其他字段引用）；`往` 记录实际使用目标（页面展示、权限判断、统计计算、业务流程、服务读取或其他集合/字段）。跨集合关系使用 `` `collection.field` ``；涉及权限时以 `SCHEMA-PERMISSIONS.md` 的角色为准；只有代码或明确流程能够证明时才标记系统自动操作。它们是文档化的数据流，不是 Firestore 自动触发器；无法从代码、权限或文档确认的关系才留空，不得臆测。

---
## `members`
> **TS Interface:** `Member` | **Constants key:** `COLLECTIONS.MEMBERS`
> `平铺冗余字段（等待替换）` 列记录 legacy/import flat aliases，主要来自 `MembersService.normalizeMemberData()` 的 flat-to-nested 映射。
> `来` / `往` 记录字段的数据流：`来` 只写明角色填写、系统计算、服务同步或其他字段引用等写入来源；`往` 只写明页面展示、权限判断、统计计算、服务流程或其他集合字段等实际使用目标。它们不是 Firestore 自动触发器；空白代表当前未确认有代码级联动。

| 字段路径 | 类型 | 必填 | 枚举值 / 说明 | 平铺冗余字段（等待替换） | 来 | 往 |
|--------|------|:----:|------------|--------------|----|----|
| id | string | ✓ | Firestore doc ID |  | 系统: Firestore doc id / Auth uid | 关联其他集合的 `memberId` |
| general | object | — | 基本信息 nested object |  | 会员资料表单 / 导入 normalize | 会员资料展示与搜索 |
| general.name | string | ✓ | | name | 角色: 自注册GUEST / 自己(非锁定字段) / B+；系统: 导入 normalize | `publicBusinessListings.ownerName`、`boardMembers.memberName`；`eventRegistrations.memberName` 仅创建快照 |
| general.fullName | string | — | | fullName | 角色: 自己(非锁定字段) 或 B+；系统: 导入 normalize | `publicBusinessListings.ownerName`、`boardMembers.memberName` |
| general.chineseName | string | — | |  | 角色: 自己(非锁定字段) 或 B+ | 会员资料详情、会员目录展示 |
| general.idNumber | string | ✓ | | idNumber / nationalId | 角色: GUEST 自己 / B+；MEMBER+ 自己不可改 |  |
| general.dob | string | ✓ | | dob / dateOfBirth | 角色: GUEST 自己 / B+；MEMBER+ 自己不可改；系统: 导入 normalize | 系统生成查询索引 `birthdayMMDD` |
| general.birthPlace | string | — | |  | 角色: 自己(非锁定字段) 或 B+ |  |
| general.gender | enum | ✓ | `Male` \| `Female` | gender | 角色: 自己(非锁定字段) 或 B+ | 会员资料详情、统计筛选 |
| general.race | enum | ✓ | `Chinese` \| `Malay` \| `Indian` \| `Others` | race / ethnicity | 角色: 自己(非锁定字段) 或 B+ |  |
| general.nationality | string | ✓ | | nationality | 角色: GUEST 自己 / B+；MEMBER+ 自己不可改 |  |
| general.avatarUrl | string | — | | avatarUrl / avatar | 角色: 自己(非锁定字段) 或 B+；系统: 头像上传/导入 normalize | `boardMembers.avatarUrl` |
| general.avatar | string | — | | avatar | 角色: 自己(非锁定字段) 或 B+ |  |
| general.ethnicity | string | — | | ethnicity | 角色: 自己(非锁定字段) 或 B+ |  |
| general.age | number | — | | age | 角色: 自己(非锁定字段) 或 B+；系统: 导入 normalize |  |
| general.dietaryPreference | enum | — | `vegetarian` \| `halal` \| `normal` \| null | dietaryPreference | 角色: 自己(非锁定字段) 或 B+ |  |
| contact | object | — | 联系信息 nested object |  | 会员资料表单 / 导入 normalize | 联系信息展示、隐私筛选 |
| contact.email | string | ✓ | | email | 角色: 自注册GUEST / 自己(非锁定字段) / B+；系统: 导入 normalize | `memberEmails/{sanitizedEmail}` 唯一索引；Auth email sync |
| contact.phone | string | ✓ | | phone | 角色: 自己(非锁定字段) 或 B+ |  |
| contact.alternatePhone | string | — | | alternatePhone | 角色: 自己(非锁定字段) 或 B+ |  |
| contact.address | string | ✓ | | address | 角色: 自己(非锁定字段) 或 B+；系统: 导入 normalize | `PostcodeService` 解析生成 `contact.area/state` |
| contact.area | string | — | |  | 系统: `contact.address` 解析 | 地区筛选/展示 |
| contact.state | string | — | |  | 系统: `contact.address` 解析 | 地区筛选/展示 |
| contact.whatsappJoined | boolean | ✓ | | whatsappJoined / whatsappGroup / whatsappgroup | 角色: 自己(非锁定字段) 或 B+ |  |
| contact.socials | object | ✓ | |  | 社交资料表单 / 导入 normalize | 会员资料展示（受 privacy 控制） |
| contact.socials.linkedin | string | — | | linkedin / linkedIn | 角色: 自己(非锁定字段) 或 B+ |  |
| contact.socials.facebook | string | — | | facebook | 角色: 自己(非锁定字段) 或 B+ |  |
| contact.socials.instagram | string | — | | instagram | 角色: 自己(非锁定字段) 或 B+ |  |
| contact.socials.wechat | string | — | | wechat / weChat | 角色: 自己(非锁定字段) 或 B+ |  |
| contact.emergency | object | ✓ | |  | 会员资料表单 | 紧急联系人信息展示 |
| contact.emergency.name | string | ✓ | | emergencyContactName / emergencyContact | 角色: 自己(非锁定字段) 或 B+ |  |
| contact.emergency.relationship | string | ✓ | | emergencyContactRelationship | 角色: 自己(非锁定字段) 或 B+ |  |
| contact.emergency.phone | string | ✓ | | emergencyContactPhone | 角色: 自己(非锁定字段) 或 B+ |  |
| contact.privacy | object | — | | privacy | 角色: 自己(非锁定字段) 或 B+；系统: 导入 normalize |  |
| contact.privacy.showPhone | boolean | — | | privacy.showPhone | 角色: 自己(非锁定字段) 或 B+；系统: 导入 normalize |  |
| contact.privacy.showAlternatePhone | boolean | — | | privacy.showAlternatePhone | 角色: 自己(非锁定字段) 或 B+；系统: 导入 normalize |  |
| contact.privacy.showSocials | boolean | — | | privacy.showSocials | 角色: 自己(非锁定字段) 或 B+；系统: 导入 normalize |  |
| others | object | — | 衣服/个性信息 nested object |  | 会员资料表单 / 导入 normalize | 会员资料、服装订单与个性化展示 |
| others.bio | string | — | | bio | 角色: 自己(非锁定字段) 或 B+ |  |
| others.shirtStyle | enum | ✓ | `Unisex` \| `Lady Cut` | shirtStyle / cutStyle | 角色: 自己(非锁定字段) 或 B+ |  |
| others.tshirtSize | enum | ✓ | `XS` \| `S` \| `M` \| `L` \| `XL` \| `2XL` \| `3XL` \| `5XL` \| `7XL` | tshirtSize | 角色: 自己(非锁定字段) 或 B+ |  |
| others.jacketSize | enum | ✓ | 同 tshirtSize 枚举值 | jacketSize | 角色: 自己(非锁定字段) 或 B+ |  |
| others.embroideredName | string | ✓ | | embroideredName | 角色: 自己(非锁定字段) 或 B+ |  |
| others.tshirtStatus | enum | ✓ | `NA` \| `Requested` \| `Sent` \| `Delivered` \| `Received` | tshirtStatus | 角色: 自己(非锁定字段) 或 B+ |  |
| others.hobbies | string[] | ✓ | | hobbies | 角色: 自己(非锁定字段) 或 B+ |  |
| others.surveyAnswers | map | — | Record\<string, string \| string[]\> | surveyAnswers | 角色: 自己(非锁定字段) 或 B+；系统: survey/profile sync |  |
| others.personaType | string | — | | personaType | 系统: behavioral/persona service；角色: B+ |  |
| others.tendencyTags | string[] | — | | tendencyTags | 系统: behavioral/persona service；角色: B+ |  |
| business | object | — | 商业信息 nested object |  | 商业资料表单 / 导入 normalize | Business Directory 与国际网络展示 |
| business.companyName | string | ✓ | | companyName | 角色: 自己(非锁定字段) 或 B+；系统: 导入 normalize | `publicBusinessListings.companyName`、`boardMembers.companyName` |
| business.companyWebsite | string | — | | companyWebsite | 角色: 自己(非锁定字段) 或 B+；系统: 导入 normalize | `publicBusinessListings.website` |
| business.companyLogoUrl | string | — | | companyLogoUrl | 角色: 自己(非锁定字段) 或 B+；系统: 导入 normalize | `publicBusinessListings.logo` |
| business.introduction | string | — | | introduction / companyDescription | 角色: 自己(非锁定字段) 或 B+；系统: 导入 normalize | `publicBusinessListings.description` |
| business.position | string | ✓ | | position / profession / title / departmentAndPosition | 角色: 自己(非锁定字段) 或 B+；系统: 导入 normalize | 会员商业资料、`boardMembers.position` 展示 |
| business.industry | string | ✓ | | industry | 角色: 自己(非锁定字段) 或 B+；系统: 导入 normalize | `publicBusinessListings.industry` |
| business.businessCategory | string[] | ✓ | | businessCategory / category | 角色: 自己(非锁定字段) 或 B+；系统: 导入 normalize | `publicBusinessListings.businessCategory` |
| business.specialOffer | SpecialOffer \| string | — | | specialOffer / offerToMember | 角色: 自己(非锁定字段) 或 B+；系统: 导入 normalize | `publicBusinessListings.offer/offerTerms/offerExpiry` |
| business.specialOffers | SpecialOffer[] | — | |  | 角色: 自己(非锁定字段) 或 B+ | Business Directory 优惠列表展示 |
| business.acceptInternationalBusiness | enum | ✓ | `Yes` \| `No` \| `Willing to Explore` | acceptInternationalBusiness | 角色: 自己(非锁定字段) 或 B+；系统: 导入 normalize | `publicBusinessListings.acceptsInternationalBusiness` |
| business.idealReferrals | string[] | — | | idealReferral / idealReferrals / idealReferralIndustry | 角色: 自己(非锁定字段) 或 B+；系统: 导入 normalize | `publicBusinessListings.idealReferralTypes` fallback |
| business.connections | InternationalConnection[] | — | | connections / internationalConnections | 角色: 自己(非锁定字段) 或 B+；系统: 导入 normalize | business directory / international network 展示 |
| business.levelOfManagement | string | — | | levelOfManagement | 角色: 自己(非锁定字段) 或 B+；系统: 导入 normalize |  |
| business.departmentAndPosition | string | — | | departmentAndPosition | 角色: 自己(非锁定字段) 或 B+；系统: 导入 normalize |  |
| business.companyDescription | string | — | | companyDescription | 角色: 自己(非锁定字段) 或 B+；系统: 导入 normalize | `publicBusinessListings.description` fallback |
| business.interestedIndustries | string[] | — | | interestedIndustries | 角色: 自己(非锁定字段) 或 B+；系统: 导入 normalize | Business Directory 匹配与行业筛选 |
| business.idealReferralTypes | string[] | — | | idealReferralTypes | 角色: 自己(非锁定字段) 或 B+；系统: 导入 normalize | `publicBusinessListings.idealReferralTypes` |
| business.bookmarkedBusinessIds | string[] | — | | bookmarkedBusinessIds | 角色: 自己(非锁定字段) 或 B+；系统: Business Directory 收藏操作 | Business Directory 书签状态 |
| jciCareer | object | — | JCI 会员生涯 nested object |  | 会员、财务、董事会及晋升服务 | 权限判断、会员统计、晋升与会费流程 |
| jciCareer.membershipType | enum | ✓ | `Guest` \| `Probation` \| `Official` \| `Honorary` \| `Senator` \| `Visiting` \| `Associate` | membershipType | 角色: B+；系统: 注册/审批/晋升/会费同步/导入 | `members.role` 推导；会费记录同步依据 |
| jciCareer.membershipStatus | enum | ✓ | `paid_due` \| `unpaid_due` \| `terminated` \| `pending` \| `paid` \| `overdue` \| `partial` \| `over paid` |  | 角色: B+；系统: membership/finance sync |  |
| jciCareer.joinDate | string | ✓ | | joinDate / joinedDate | 角色: B+；系统: 注册/审批/导入 |  |
| jciCareer.introducer | string | — | | introducer | 角色: B+；系统: 导入 normalize | introducer stats recalculation |
| jciCareer.senatorship | object | ✓ | |  | B+ 操作 / senatorship validation | Senator 资格、编号及董事会验证 |
| jciCareer.senatorship.certified | boolean | ✓ | | senatorCertified | 角色: B+；系统: senatorship validation |  |
| jciCareer.senatorship.senatorNumber | string | — | | senatorshipId | 角色: B+；锁定后仅 A+ 可改 |  |
| jciCareer.senatorship.boardValidated | boolean | — | | senatorshipBoardValidated | 角色: B+；系统: senatorship validation |  |
| jciCareer.currentBoardYear | number | — | | currentBoardYear | 系统: `boardMembers.term` 当前届 active 记录 | 权限判断/board 展示 |
| jciCareer.currentBoardPosition | string | — | | currentBoardPosition | 系统: `boardMembers.position` 当前届 active 记录 | 权限判断/board 展示 |
| jciCareer.isCurrentBoardMember | boolean | ✓ | | isCurrentBoardMember | 系统: `boardMembers.isActive + term` 同步 | Firestore rules / `usePermissions` board 权限 |
| jciCareer.boardHistory | BoardPosition[] | ✓ | | boardHistory | 角色: B+；系统: board service/history sync |  |
| jciCareer.points | number | ✓ | | points | 系统: `points` 交易汇总/积分服务；角色: B+ | 排行榜、会员统计、dashboard |
| jciCareer.attendanceRate | number | ✓ | @deprecated 手填百分比 | attendanceRate | 角色: B+；deprecated |  |
| jciCareer.attendanceCheckins | number | — | | attendanceCheckins | 系统: attendance / points 统计 | engagement / promotion 进度 |
| jciCareer.attendanceMonths | number | — | | attendanceMonths | 系统: attendance / points 统计 | engagement / promotion 进度 |
| jciCareer.attendanceYear | number | — | | attendanceYear | 系统: attendance / points 统计 | engagement / promotion 进度 |
| jciCareer.badgesCount | number | ✓ | | badgesCount | 系统: gamification/badge 统计 | dashboard / member stats |
| jciCareer.projectsCount | number | ✓ | | projectsCount | 系统: projects / points 统计 | dashboard / member stats |
| jciCareer.trainingsCount | number | ✓ | | trainingsCount | 系统: trainings / points 统计 | dashboard / member stats |
| jciCareer.foundationPathway | object | — | | probationTasks / promotionProgress | Guest/probation 与 PromotionTracking | Foundation Pathway 清单与晋升资格 |
| jciCareer.foundationPathway.tasks | ProbationTask[] | ✓ | | probationTasks / foundationPathway.probationTasks | 角色: B+；系统: Guest approval / probation setup | Foundation Pathway / probation checklist |
| jciCareer.foundationPathway.bodMeetingAttended | boolean \| number \| null | ✓ | | promotionProgress.bodMeetingAttended | 角色: B+；系统: PromotionTracking / activity record | promotion eligibility |
| jciCareer.foundationPathway.eventOrganizerParticipation | boolean \| number \| null | ✓ | | promotionProgress.eventOrganizerParticipation | 角色: B+；系统: PromotionTracking / activity record | promotion eligibility |
| jciCareer.foundationPathway.eventParticipation | boolean \| number \| null | ✓ | | promotionProgress.eventParticipation | 角色: B+；系统: PromotionTracking / activity record | promotion eligibility |
| jciCareer.foundationPathway.jciInspireCompleted | boolean \| number \| null | ✓ | | promotionProgress.jciInspireCompleted | 角色: B+；系统: PromotionTracking / activity record | promotion eligibility |
| jciCareer.foundationPathway.completedAt | string | — | | promotionProgress.completedAt | 角色: B+；系统: PromotionTracking / promotion service | promotion audit/display |
| jciCareer.isDuesPaidCurrentYear | boolean | — | | isDuesPaidCurrentYear | 系统: finance / membership sync；角色: B+ |  |
| jciCareer.engagementProgress | object | — | | engagementProgress | 系统: engagement / promotion service；角色: B+ |  |
| jciCareer.engagementProgress.firstYear | map | — | Record\<string, MemberEngagementRequirementProgress\> |  | engagement / promotion service | 会员参与度与晋升进度 |
| jciCareer.engagementProgress.secondYear | map | — | Record\<string, MemberEngagementRequirementProgress\> |  | engagement / promotion service | 会员参与度与晋升进度 |
| jciCareer.radarStats | RadarStats | — | | radarStats | 系统: PointsService recalculation | analytics/dashboard |
| jciCareer.radarStatsByYear | map | — | Record\<string, RadarStats\>，key=年份 | radarStatsByYear | 系统: PointsService yearly recalculation | analytics/dashboard |
| jciCareer.membershipDuesHistory | map | — | Record\<string, MembershipRecord\>，key=年份字符串 | membershipDuesHistory | 系统: finance membership sync / dues renewal；角色: B+/Finance | dues dashboard / membership status |
| jciCareer.membershipDuesHistory[year].year | string \| number | ✓ | |  | 系统: finance / membership sync | 会费历史按年展示 |
| jciCareer.membershipDuesHistory[year].duesPaid | boolean | — | |  | 系统: payment/reconciliation sync | 会费状态展示 |
| jciCareer.membershipDuesHistory[year].paymentRef | string | — | |  | `paymentRequests` / `transactions` | 会费支付记录关联 |
| jciCareer.membershipDuesHistory[year].validatedBy | string | — | |  | 财务/会费验证操作 | 会费审计展示 |
| jciCareer.membershipDuesHistory[year].dues | number \| string | — | |  | 会费配置/财务同步 | 应缴会费展示 |
| jciCareer.membershipDuesHistory[year].type | MembershipType \| string | — | |  | 会员类型与会费配置 | 会费记录展示 |
| jciCareer.membershipDuesHistory[year].amount | number \| string | — | |  | 支付/交易同步 | 已缴金额展示 |
| jciCareer.membershipDuesHistory[year].status | enum | — | `paid` \| `over paid` \| `overdue` \| `partial` \| `pending` |  | finance / membership sync | dues dashboard / 会员状态 |
| jciCareer.membershipDuesHistory[year].transactionId | string[] | — | |  | `transactions.id` / `paymentRequests` | 交易详情与对账 |
| jciCareer.membershipDuesHistory[year].purpose | string | — | |  | 支付请求/交易同步 | 会费用途展示 |
| jciCareer.membershipDuesHistory[year].paymentDate | string | — | |  | 支付成功/对账流程 | 会费历史展示 |
| jciCareer.membershipDuesHistory[year].toyyibBillCode | string | — | |  | `toyyibBills.billCode` | ToyyibPay 账单查询 |
| jciCareer.membershipDuesHistory[year].toyyibPaymentUrl | string | — | |  | ToyyibPay 账单创建 | 会费支付入口 |
| jciCareer.membershipDuesHistory[year].toyyibPaymentStatus | string | — | `"1"`=已付, `"2"`=待付, `"3"`=失败, `"4"`=结算中 |  | ToyyibPay webhook / payment sync | 会费支付状态展示 |
| jciCareer.membershipDuesHistory[year].billExternalReferenceNo | string | — | |  | `toyyibBills.externalReferenceNo` | 账单追踪与对账 |
| jciCareer.leaderboardVisibility | boolean \| string | — | | leaderboardVisibility | 角色: B+ 或自己设置；系统: 导入 normalize |  |
| jciCareer.hasPaidInitiationFee | boolean | — | | hasPaidInitiationFee | 系统: finance / payment sync；角色: B+/Finance |  |
| jciCareer.senatorshipValidatedAt | string | — | | senatorshipValidatedAt | 系统: senatorship validation | audit/display |
| jciCareer.senatorshipValidatedBy | string | — | | senatorshipValidatedBy | 系统: senatorship validation | audit/display |
| jciCareer.careerHistory | CareerMilestone[] | — | | careerHistory | 角色: B+；系统: 导入 normalize | member career timeline |
| jciCareer.loId | string | — | | loId | 角色: B+；系统: member create/import | multi-LO filtering / scoped queries |
| jciCareer.mentorId | string | — | | mentorId | 角色: B+；系统: mentorship assignment | mentor matching / mentee relation |
| jciCareer.menteeIds | string[] | — | | menteeIds | 角色: B+；系统: mentorship assignment | mentor matching / mentor relation |
| jciCareer.duesStatus | string | — | | duesStatus | 系统: finance / membership sync；角色: B+/Finance | dues dashboard |
| jciCareer.isCurrentCommissionDirector | boolean | — | | isCurrentCommissionDirector | 系统: `boardMembers.commissionDirectorIds` 当前届同步 | commission director 权限/展示 |
| jciCareer.probationApprovedBy | string | — | | probationApprovedBy | 系统: Guest/probation approval；角色: B+ | audit/display |
| jciCareer.probationApprovedAt | string | — | | probationApprovedAt | 系统: Guest/probation approval；角色: B+ | audit/display |
| system | object | — | 系统字段 nested object |  | 注册、资料更新及角色变更服务 | 审计、权限判断、缓存与界面展示 |
| system.createdAt | string \| Timestamp \| Date | — | | createdAt | 系统: createMember / registration | audit/display |
| system.updatedAt | string \| Timestamp \| Date | — | | updatedAt | 系统: updateMember / services | cache invalidation / audit/display |
| system.roleChangedBy | string | — | UID of admin who last changed role | roleChangedBy | 系统: updateMemberRole | audit trail |
| system.roleChangedAt | string \| Timestamp | — | ISO timestamp of last role change | roleChangedAt | 系统: updateMemberRole | audit trail |
| system.role | enum | — | `GUEST` \| `MEMBER` \| `BOARD` \| `ADMIN` \| `SUPER_ADMIN` \| `INACTIVE` | role | 角色: B+ / A+；系统: registration / approval / membership sync / board sync | Firestore rules / UI permissions / `boardMembers.displayRole` |
| churnRisk | string | — | |  | 系统: AI churn prediction；角色: B+ | analytics/dashboard |
| tier | MemberTier \| string | — | |  | 系统: tier/gamification calculation；角色: B+ | member segmentation |
| skills | string[] | — | |  | 角色: 自己(非锁定字段) 或 B+ |  |
| badges | Badge[] | — | |  | 系统: gamification service；角色: B+ | dashboard / member profile |

---

## `boardMembers`
> **TS Interface:** `BoardMember` | **Constants key:** `COLLECTIONS.BOARD_MEMBERS`

| 字段路径 | 类型 | 必填 | 枚举值 / 说明 | 来 | 往 |
|--------|------|:----:|------------|----|----|
| id | string | ✓ | Firestore doc ID | 系统: Firestore doc id | |
| memberId | string | ✓ | 对应 members 集合 doc ID | 角色: B+；系统: board assignment 选择的 member | 关联 `members/{memberId}` |
| position | string | ✓ | 职位名称 | 角色: B+；系统: board assignment / transition | 当前届 active 记录同步到 `members.jciCareer.currentBoardPosition` |
| term | string | ✓ | 年份任期，如 "2025" | 角色: B+；系统: board term / transition | 当前届 active 记录同步到 `members.jciCareer.currentBoardYear` |
| startDate | string | ✓ | | 角色: B+；系统: term 起始日或操作时间 | |
| endDate | string | — | | 角色: B+；系统: archive / transition 写入 | |
| isActive | boolean | ✓ | | 角色: B+；系统: board archive/activate/transition 状态 | 当前届 active 记录用于同步 `members.jciCareer.isCurrentBoardMember` |
| permissions | string[] | ✓ | | 系统: 由 `position` 计算生成 (`getRolePermissions(position)`) | |
| commissionDirectorIds | string[] | — | | 角色: B+；系统: board assignment | 当前届同步对应 members 的 `isCurrentCommissionDirector` |
| commissionDirectorAvatars | map | — | Record\<string, string\> | 角色: B+；系统: board assignment 上传/传入 | guest/about board 展示 |
| commissionDirectorNames | map | — | Record\<string, string\> | 系统: 从 `members.general.name/fullName` 复制 | guest/about board 展示 |
| memberName | string | — | 冗余展示字段 | 系统: 从 `members.general.name/fullName` 复制 | guest/about board 展示；不自动回写 member |
| avatarUrl | string | — | 冗余展示字段 | 系统: 从 `members.general.avatarUrl` 复制 | guest/about board 展示；不自动回写 member |
| boardAvatarUrl | string | — | Board 专用头像 | 角色: B+；系统: 创建/编辑 board assignment 时传入 | guest/about board 展示，优先于 `avatarUrl` |
| companyName | string | — | 冗余展示字段 | 系统: 从 `members.business.companyName` / legacy `members.companyName` 复制 | guest/about board 展示；不自动回写 member |
| createdAt | string | ✓ | | 系统: 创建 `boardMembers` 记录或换届新增记录 | |
| updatedAt | string | ✓ | | 系统: 更新/归档/换届时写入 `boardMembers.updatedAt` | |

---

## `boardTransitions`
> **TS Interface:** `BoardTransition` | **Constants key:** `COLLECTIONS.BOARD_TRANSITIONS`

| 字段路径 | 类型 | 必填 | 枚举值 / 说明 | 来 | 往 |
|--------|------|:----:|------------|----|----|
| id | string | ✓ | Firestore doc ID | 系统: Firestore doc id | |
| year | string | ✓ | 换届年份 | 角色: B+；系统: 换届工具选择的年份 | `boardMembers.term`、`members.jciCareer.currentBoardYear` |
| outgoingBoard | BoardMember[] | ✓ | 卸任理事会快照 | 系统: 当前 active `boardMembers` 读取 | 当前 `boardMembers` 记录归档；对应 `members` 理事会字段清除/重置 |
| incomingBoard | BoardMember[] | ✓ | 新任理事会快照 | 角色: B+；系统: 换届工具填写并按 position 计算 permissions | 新增 active `boardMembers`；对应 `members` 理事会字段和角色同步 |
| transitionDate | string | ✓ | | 系统: `createBoardTransition()` 创建时生成 | 换届历史排序与展示 |
| completedBy | string | ✓ | 执行换届的 admin UID | 系统: 当前 `auth.uid` / 操作用户 UID | 换届审计记录 |
| status | enum | ✓ | `draft` \| `in_progress` \| `completed` | 系统: `createBoardTransition()` 写入 `in_progress`；`executeBoardTransition()` 更新 | 控制换届是否可重复执行；前端显示执行状态 |
| notes | string | — | | 角色: B+ / A+；系统: 换届备注 | 换届历史展示 |
| createdAt | string | ✓ | | 系统: `createBoardTransition()` 创建时生成 | 换届审计记录 |
| updatedAt | string | ✓ | | 系统: `executeBoardTransition()` 完成时更新 | 换届审计记录 |

---

## `boardTermSettings`
> **TS Interface:** `BoardTermSettings` | **Constants key:** `COLLECTIONS.BOARD_TERM_SETTINGS`

| 字段路径 | 类型 | 必填 | 枚举值 / 说明 | 来 | 往 |
|--------|------|:----:|------------|----|----|
| year | string | ✓ | doc ID 兼年份键 | 角色: B+ / A+；系统: 选定理事会届次 | `boardMembers.term`、当前届次查询键 |
| presidentTheme | string | — | 总裁主题 | 角色: B+ / A+；系统: 届次设置表单 | Guest Landing / About 页面展示 |
| tagline | string | — | 届次标语 | 角色: B+ / A+；系统: 届次设置表单 | Guest Landing / About 页面展示 |
| shortDescription | string | — | 届次简介 | 角色: B+ / A+；系统: 届次设置表单 | Guest Landing / About 页面展示 |
| logoUrl | string | — | 届次 Logo | 角色: B+ / A+；系统: 届次设置表单或图片上传 | Guest Landing / About 页面展示 |
| groupPhotoUrl | string | — | 理事会合照 | 角色: B+ / A+；系统: 届次设置表单或图片上传 | Guest Landing / About 页面展示 |
| memberGroupPhotoUrl | string | — | 会员合照 | 角色: B+ / A+；系统: 届次设置表单或图片上传 | Guest Landing / About 页面展示 |
| updatedAt | string | ✓ | | 系统: `setBoardTermSettings()` 保存时生成 | 缓存失效与设置更新时间记录 |

---

## `promotionHistory`
> **TS Interface:** `PromotionHistory` | **Constants key:** `COLLECTIONS.PROMOTION_HISTORY`

| 字段路径 | 类型 | 必填 | 枚举值 / 说明 | 来 | 往 |
|--------|------|:----:|------------|----|----|
| id | string | ✓ | Firestore doc ID | 系统: Firestore doc id | 晋升历史查询 |
| memberId | string | ✓ | | 系统: 当前 `members.id` | 关联 `members` 与晋升后会员状态 |
| memberName | string | ✓ | | 系统: 从 `members.general.name` 复制 | 晋升历史展示 |
| fromMembershipType | string | ✓ | 晋升前类型 | 系统: 晋升前 `members.jciCareer.membershipType` | 晋升历史审计 |
| toMembershipType | string | ✓ | 晋升后类型 | 系统: 晋升流程目标类型 | 更新 `members.jciCareer.membershipType` |
| promotionDate | Date | ✓ | | 系统: 晋升执行时间 | 晋升历史排序 |
| promotionMethod | enum | ✓ | `automatic` \| `manual` | 系统: 自动/手动晋升流程 | 晋升方式展示 |
| promotedBy | string | ✓ | 执行晋升的 admin UID | 系统: 执行晋升的 `auth.uid` | 晋升审计 |
| requirementsCompleted | PromotionRequirement[] | ✓ | 已满足的要求列表 | 系统: `jciCareer.foundationPathway` / `PromotionTracking` | 晋升审计与要求展示 |
| oldDuesAmount | number | ✓ | | 系统: 晋升前会员类型对应会费配置 | 晋升记录、财务审计 |
| newDuesAmount | number | ✓ | | 系统: 晋升后会员类型对应会费配置 | 晋升记录、财务同步依据 |
| notificationSent | boolean | ✓ | | 系统: 晋升通知发送结果 | 重试与通知状态展示 |
| notes | string | — | | 角色: 手动晋升申请说明 / 系统: 晋升流程备注 | 晋升历史详情与审计 |

---

## `manualPromotionRequests`
> **TS Interface:** `ManualPromotionRequest` | **Constants key:** `COLLECTIONS.MANUAL_PROMOTION_REQUESTS`

| 字段路径 | 类型 | 必填 | 枚举值 / 说明 | 来 | 往 |
|--------|------|:----:|------------|----|----|
| id | string | ✓ | Firestore doc ID | 系统: Firestore doc id | 申请查询 |
| memberId | string | ✓ | | 系统: 当前 `members.id` | 关联申请会员 |
| memberName | string | ✓ | | 系统: 从 `members.general.name` 复制 | 申请列表展示 |
| requestedBy | string | ✓ | 申请人 UID | 系统: 申请人的 `auth.uid` | 申请审计 |
| requestedAt | Date | ✓ | | 系统: 提交申请时生成 | 申请排序 |
| reason | string | ✓ | | 角色: B+ / A+；系统: 手动晋升申请表单 | 审核依据与晋升历史 `notes` |
| overrideRequirements | boolean | ✓ | 是否绕过要求核查 | 角色: 管理员审批操作 / 系统: 申请表单 | 晋升审批逻辑 |
| missingRequirements | string[] | ✓ | 未满足的要求列表 | 系统: `jciCareer.foundationPathway` / 晋升资格检查 | 审批依据与申请详情 |
| approvedBy | string | — | | 系统: 管理员批准操作的 `auth.uid` | 审批审计 |
| approvedAt | Date | — | | 系统: 管理员批准操作时间 | 审批时间展示 |
| status | enum | ✓ | `pending` \| `approved` \| `rejected` | 系统: 创建时 `pending`；管理员审批/拒绝操作更新 | 申请列表状态、审批流程与晋升流程 |
| adminNotes | string | — | | 角色: 管理员审批/拒绝表单 | 申请详情与审批审计 |

---

## `memberEmails`
> **TS Interface:** 无专属接口（工具集合）| **Constants key:** `COLLECTIONS.MEMBER_EMAILS`

邮箱去重槽位集合。doc ID = 经 sanitize 的邮箱字符串（lowercase，非 `a-z0-9@.` 字符替换为 `_`）。

| 字段路径 | 类型 | 必填 | 枚举值 / 说明 | 来 | 往 |
|--------|------|:----:|------------|----|----|
| email | string | ✓ | 原始邮箱地址 | 系统: 从 `members.contact.email` 规范化生成；导入时从导入记录生成 | 邮箱唯一性占位键；Auth 邮箱同步依据 |
| memberId | string | ✓ | 对应 members doc ID | 系统: 创建会员时生成；导入时从会员文档关联 | 关联 `members/{memberId}`；查询邮箱对应会员 |
| createdAt | Timestamp | ✓ | | 系统: 创建邮箱去重槽位时生成 | 去重槽位审计记录 |

---

## `mentorMatches`
> **TS Interface:** `MentorMatch` | **Constants key:** `COLLECTIONS.MENTOR_MATCHES`

| 字段路径 | 类型 | 必填 | 枚举值 / 说明 | 来 | 往 |
|--------|------|:----:|------------|----|----|
| id | string | ✓ | Firestore doc ID | 系统: Firestore doc id | `mentorshipFeedback.matchId`、匹配查询 |
| mentorId | string | ✓ | 对应 members doc ID | 系统: 匹配算法/创建匹配时指定 | 对应 `members.menteeIds` 写入；导师通知 |
| menteeId | string | ✓ | 对应 members doc ID | 系统: 匹配算法/创建匹配时指定 | 对应 `members.mentorId` 写入；学员通知 |
| compatibilityScore | number | ✓ | 算法匹配分 | 系统: `findPotentialMentors()` 匹配算法计算 | 导师匹配展示与排序 |
| matchingFactors | string[] | ✓ | 匹配依据列表 | 系统: 匹配算法生成 | 匹配说明与审核展示 |
| status | enum | ✓ | `suggested` \| `approved` \| `active` \| `completed` | 角色: B+ / A+；系统: 创建、批准、完成或取消流程 | 匹配状态查询、导师关系统计与权限判断 |
| startDate | string | — | | 系统: 批准匹配时写入 | 导师关系开始时间、匹配详情 |
| endDate | string | — | | 系统: 完成/取消导师关系时写入 | 导师关系历史与持续时间 |
| createdAt | string | ✓ | | 系统: 创建匹配记录时生成 | 匹配历史排序与审计 |
| updatedAt | string | ✓ | | 系统: 匹配状态或辅导记录更新时生成 | 缓存失效与最后更新时间 |

---

## `mentorshipFeedback`
> **TS Interface:** 无专属接口（工具集合）| **Constants key:** `COLLECTIONS.MENTORSHIP_FEEDBACK`

由 `MentorshipService.collectFeedback()` 写入，无独立 TypeScript 接口，字段从 service 层推断。

| 字段路径 | 类型 | 必填 | 枚举值 / 说明 | 来 | 往 |
|--------|------|:----:|------------|----|----|
| matchId | string | ✓ | 对应 mentorMatches doc ID | 系统: 当前导师匹配记录 | `mentorMatches/{matchId}` 关联的导师关系 |
| fromMemberId | string | ✓ | 提交反馈的 member UID | 角色: 导师或学员；系统: 反馈提交者 | 关联 `members/{fromMemberId}`；反馈权限校验 |
| rating | number | ✓ | | 角色: 导师或学员 | 导师关系评价与统计 |
| feedback | string | ✓ | 文字反馈 | 角色: 导师或学员 | 导师关系反馈展示 |
| createdAt | string | ✓ | ISO 日期字符串 | 系统: `collectFeedback()` 创建时生成 | 反馈历史排序与审计 |

---

## `sisterChapters`
> **TS Interface:** `SisterChapter` | **Constants key:** `COLLECTIONS.SISTER_CHAPTERS`

| 字段路径 | 类型 | 必填 | 枚举值 / 说明 | 来 | 往 |
|--------|------|:----:|------------|----|----|
| id | string | ✓ | Firestore doc ID，同时作为 members.loId 的值 | 角色: A+；系统: 创建时指定的 chapter ID | `members.loId` 关联；会员章节选择项 |
| name | string | ✓ | 例："JCI Singapore" | 角色: A+；系统: 章节设置表单 | 会员章节名称、国际网络展示 |
| country | string | ✓ | | 角色: A+；系统: 章节设置表单 | 国际网络筛选与展示 |
| type | enum[] | ✓ | `sister_lo` \| `apicc` | 角色: A+；系统: 章节设置表单 | 国际伙伴类型筛选与展示 |
| flagEmoji | string | — | | 角色: A+；系统: 章节设置表单 | 章节名称和会员章节选择项展示 |
| logoUrl | string | — | | 角色: A+；系统: 章节设置表单或图片上传 | 国际网络展示 |
| partnerSince | string | — | | 角色: A+；系统: 章节设置表单 | 合作年份展示 |
| website | string | — | | 角色: A+；系统: 章节设置表单 | 国际网络外部链接 |
| isActive | boolean | ✓ | | 角色: A+；系统: 启用/停用章节操作 | 活跃章节查询与会员章节选项 |
| createdAt | string | — | | 系统: 创建章节时生成 | 创建审计记录 |
| updatedAt | string | — | | 系统: 编辑章节时生成 | 缓存失效与更新时间记录 |

---

## `events`
> **TS Interface:** `Event` | **Constants key:** `COLLECTIONS.EVENTS`

| 字段路径 | 类型 | 必填 | 枚举值 / 说明 | 来 | 往 |
|--------|------|:----:|------------|----|----|
| id | string | ✓ | Firestore doc ID | 系统: Firestore doc id | `eventRegistrations.eventId`、`eventFeedback.eventId` |
| title | string | ✓ | | 角色: B+ / A+；系统: 活动表单 | 活动列表、报名与反馈页面展示 |
| description | string | — | | 角色: B+ / A+；系统: 活动表单 | 活动详情展示 |
| date | string | ✓ | | 角色: B+ / A+；系统: 活动表单 | 活动排序、状态与提醒 |
| endDate | string | — | | 角色: B+ / A+；系统: 活动表单 | 活动详情与时间范围 |
| time | string | — | | 角色: B+ / A+；系统: 活动表单 | 活动详情展示 |
| endTime | string | — | | 角色: B+ / A+；系统: 活动表单 | 活动详情展示 |
| type | enum | ✓ | `Meeting` \| `Training` \| `Social` \| `Project` \| `International` | 角色: B+ / A+；系统: 活动表单 | 活动筛选与展示 |
| attendees | number | ✓ | | 系统: `eventRegistrations.status` 报名/签到流程汇总 | 活动容量与统计展示 |
| maxAttendees | number | — | | 角色: B+ / A+；系统: 活动表单 | 报名容量校验 |
| status | enum | ✓ | `Upcoming` \| `Completed` \| `Cancelled` | 角色: B+ / A+；系统: 活动状态操作 | 活动列表与报名可用性判断 |
| predictedDemand | enum | — | `Low` \| `Medium` \| `High` | 系统: 活动字段与报名数量预测 | 活动需求展示 |
| location | string | ✓ | | 角色: B+ / A+；系统: 活动表单 | 活动详情与地图/地点展示 |
| price | number | — | | 角色: B+ / A+；系统: 活动表单 | 报名付款金额 |
| priceMin | number | — | | 角色: B+ / A+；系统: 活动表单 | 活动价格展示 |
| priceMax | number | — | | 角色: B+ / A+；系统: 活动表单 | 活动价格展示 |
| imageUrl | string | — | | 角色: B+ / A+；系统: 图片上传 | 活动卡片与详情展示 |
| organizerId | string \| null | — | | 角色: B+ / A+；系统: 创建活动时指定 | 活动负责人关联 |
| registeredMembers | string[] | — | | 系统: `eventRegistrations.memberId` 报名/取消报名流程维护 | 活动报名成员快速查询 |
| committee | ProjectCommitteeMember[] | — | 见 ProjectCommitteeMember | 角色: B+ / A+；系统: 活动设置 | 活动委员会展示与权限判断 |

---

## `eventRegistrations`
> **TS Interface:** `EventRegistration` | **Constants key:** `COLLECTIONS.EVENT_REGISTRATIONS`

| 字段路径 | 类型 | 必填 | 枚举值 / 说明 | 来 | 往 |
|--------|------|:----:|------------|----|----|
| id | string | ✓ | Firestore doc ID | 系统: 确定性报名 doc id | 报名、签到、付款记录关联 |
| eventId | string | ✓ | | 角色: 会员/代报名角色；系统: 当前 `events.id` | 关联 `events/{eventId}`、付款与反馈 |
| memberId | string | ✓ | | 角色: 会员/代报名角色；系统: 当前 `members.id` | 关联 `members/{memberId}`；签到与积分统计 |
| status | enum | ✓ | `registered` \| `paid` \| `checked_in` \| `cancelled` | 角色: 会员/委员会/B+；系统: 报名、付款、签到、取消流程 | 活动报名状态、容量与出席统计 |
| paidAt | string \| null | — | | 系统: 付款确认 | 财务付款状态与凭证展示 |
| checkedInAt | string \| null | — | | 角色: 委员会/B+；系统: 签到操作 | 出席统计与积分 |
| createdAt | string | ✓ | | 系统: 创建报名记录 | 报名历史排序 |
| updatedAt | string \| null | — | | 系统: 报名状态更新 | 最后更新时间 |
| loId | string \| null | — | | 系统: 从 `members.loId` 读取 | 章节报名统计 |
| cancelledAt | string \| null | — | | 系统: 取消报名流程 | 取消记录 |
| cancelledBy | string \| null | — | UID | 系统: 取消操作用户 | 取消审计 |
| cancelledByName | string \| null | — | | 系统: 从操作用户读取 | 取消审计展示 |
| cancelledByRole | enum \| null | — | `self` \| `admin` \| `board` \| `committee` | 系统: 取消时判定操作者角色 | 取消权限审计 |
| dietary | enum \| null | — | `normal` \| `vegetarian` \| `halal` | 角色: 会员/代报名角色 | 活动餐饮安排 |
| isVegetarian | boolean \| null | — | | 系统: 由 dietary 兼容生成 | 餐饮安排兼容字段 |
| emergencyContactName | string \| null | — | | 角色: 会员/代报名角色 | 活动安全资料 |
| emergencyContactPhone | string \| null | — | | 角色: 会员/代报名角色 | 活动安全资料 |
| tshirtSize | string \| null | — | | 角色: 会员/代报名角色 | 活动物资安排 |
| memberName | string \| null | — | 冗余展示字段 | 系统: 从 `members.general.name` 复制 | 报名列表展示；成员改名后可能滞后 |
| registeredBy | string \| null | — | | 系统: 当前代报名操作者 | 代报名审计与权限 |
| registeredByName | string \| null | — | | 系统: 从操作者会员资料复制 | 报名列表展示 |
| paidByName | string \| null | — | | 系统: 付款确认操作 | 付款审计展示 |
| checkedInByName | string \| null | — | | 系统: 签到操作 | 签到审计展示 |
| toyyibBillCode | string | — | | 系统: ToyyibPay 创建账单 | 付款账单关联 |
| toyyibPaymentUrl | string | — | | 系统: ToyyibPay 返回 | 付款页面跳转 |
| toyyibPaymentStatus | string | — | `"1"`=paid, `"2"`=pending, `"3"`=failed, `"4"`=settling | 系统: ToyyibPay 回调/查询 | 付款状态与报名状态同步 |
| billExternalReferenceNo | string | — | | 系统: ToyyibPay 账单创建 | 外部付款引用 |
| financeTransactionId | string | — | | 系统: 财务交易创建/关联 | 财务交易记录 |
| paymentMethod | enum | — | `toyyib` \| `bank_transfer` \| `cash` | 角色: 会员/财务；系统: 付款流程 | 付款处理分支 |

---

## `eventFeedback`
> **TS Interface:** `EventFeedback` | **Constants key:** `COLLECTIONS.EVENT_FEEDBACK`

接口定义于 `services/eventFeedbackService.ts`，未收录到 `types/` 目录。

| 字段路径 | 类型 | 必填 | 枚举值 / 说明 | 来 | 往 |
|--------|------|:----:|------------|----|----|
| id | string | — | Firestore doc ID；create 时可选 | 系统: Firestore doc id | 反馈查询 |
| eventId | string | ✓ | | 系统: 当前 `events.id` | `events/{eventId}` 关联、活动反馈汇总 |
| memberId | string | ✓ | | 角色: 参加活动的会员；系统: 当前 `members.id` / 当前用户 | 关联 `members/{memberId}`；反馈权限校验 |
| rating | number | ✓ | 1–5 | 角色: 参加活动的会员 | 活动评价统计 |
| overallSatisfaction | number | ✓ | 1–5 | 角色: 参加活动的会员 | 活动反馈汇总 |
| contentQuality | number | — | 1–5 | 角色: 参加活动的会员 | 活动反馈汇总 |
| organization | number | — | 1–5 | 角色: 参加活动的会员 | 活动反馈汇总 |
| venue | number | — | 1–5 | 角色: 参加活动的会员 | 活动反馈汇总 |
| comments | string | — | | 角色: 参加活动的会员 | 反馈详情展示 |
| wouldRecommend | boolean | — | | 角色: 参加活动的会员 | 推荐率统计 |
| suggestions | string | — | | 角色: 参加活动的会员 | 活动改进参考 |
| submittedAt | Date \| Timestamp | ✓ | | 系统: 提交反馈时生成 | 反馈排序与审计 |

---

## `eventBudgets`
> **TS Interface:** `EventBudget` | **Constants key:** `COLLECTIONS.EVENT_BUDGETS`

| 字段路径 | 类型 | 必填 | 枚举值 / 说明 | 来 | 往 |
|--------|------|:----:|------------|----|----|
| id | string | ✓ | Firestore doc ID | 系统: Firestore doc id，通常与 `eventId` 相同 | 预算记录关联 |
| eventId | string | ✓ | | 系统: 当前 `events.id` | 关联 `events/{eventId}` |
| plannedIncome | EventBudgetCategory[] | ✓ | 见子字段 | 角色: B+ / Finance；系统: 预算表单 | 活动收入预算 |
| plannedIncome[].category | string | ✓ | | 角色: B+ / Finance；系统: 预算表单 | 收入分类展示 |
| plannedIncome[].plannedAmount | number | ✓ | | 角色: B+ / Finance；系统: 预算表单 | 收入预算合计 |
| plannedIncome[].actualAmount | number | ✓ | | 系统: 财务交易对账 | 实际收入与预算差异 |
| plannedIncome[].description | string | — | | 角色: B+ / Finance；系统: 预算表单 | 收入说明展示 |
| plannedIncome[].transactions | string[] | — | 关联 transaction IDs | 系统: 财务交易关联 | 收入实际金额与交易明细 |
| plannedExpense | EventBudgetCategory[] | ✓ | 结构同 plannedIncome | 角色: B+ / Finance；系统: 预算表单 | 活动支出预算 |
| plannedExpense[].category | string | ✓ | | 角色: B+ / Finance；系统: 预算表单 | 支出分类展示 |
| plannedExpense[].plannedAmount | number | ✓ | | 角色: B+ / Finance；系统: 预算表单 | 支出预算合计 |
| plannedExpense[].actualAmount | number | ✓ | | 系统: 财务交易对账 | 实际支出与预算差异 |
| plannedExpense[].description | string | — | | 角色: B+ / Finance；系统: 预算表单 | 支出说明展示 |
| plannedExpense[].transactions | string[] | — | | 系统: 财务交易关联 | 支出实际金额与交易明细 |
| actualIncome | number | ✓ | | 系统: `plannedIncome[].actualAmount` 汇总 | 预算状态与财务统计 |
| actualExpense | number | ✓ | | 系统: `plannedExpense[].actualAmount` 汇总 | 预算状态与财务统计 |
| status | enum | ✓ | `on_track` \| `warning` \| `exceeded` | 系统: 实际金额与 `warningThreshold` 计算 | 预算状态展示与提醒 |
| createdAt | Date | ✓ | | 系统: `saveEventBudget()` 首次保存 | 预算审计记录 |
| updatedAt | Date | ✓ | | 系统: `saveEventBudget()` / 对账更新 | 缓存失效与最后更新时间 |
| warningThreshold | number | — | | 角色: B+ / Finance；系统: 预算设置 | `status` 预警计算 |

---

## `zoomBookings`
> **TS Interface:** `ZoomBooking` | **Constants key:** `COLLECTIONS.ZOOM_BOOKINGS`

| 字段路径 | 类型 | 必填 | 枚举值 / 说明 | 来 | 往 |
|--------|------|:----:|------------|----|----|
| id | string | ✓ | Firestore doc ID | 系统: Firestore doc id | 预约查询与更新 |
| memberId | string | ✓ | | 系统: 当前 `members.id` | 关联 `members/{memberId}`；个人预约查询 |
| memberName | string | ✓ | | 系统: 从当前会员资料 `members.general.name` 传入 | 预约列表展示 |
| memberEmail | string | ✓ | | 系统: 从当前会员资料 `members.contact.email` 传入 | Zoom 通知/预约展示 |
| topic | string | ✓ | | 角色: 会员；系统: 预约表单 | Zoom 会议主题 |
| startTime | string | ✓ | ISO 8601 | 角色: 会员；系统: 预约表单 | Zoom 会议开始时间 |
| duration | number | ✓ | 分钟数 | 角色: 会员；系统: 预约表单 | Zoom 会议时长 |
| zoomMeetingId | number | ✓ | | 系统: Zoom API 创建会议返回 | Zoom 取消会议与会议链接 |
| zoomJoinUrl | string | ✓ | | 系统: Zoom API 创建会议返回 | 会议加入链接 |
| zoomPassword | string | ✓ | | 系统: Zoom API 创建会议返回 | 会议加入凭证 |
| status | enum | ✓ | `confirmed` \| `cancelled` | 系统: 创建成功为 `confirmed`；取消预约更新为 `cancelled` | 预约状态展示与可用性判断 |
| createdAt | string | ✓ | | 系统: 创建预约时生成 | 预约历史排序与审计 |

---

## `activityPlans`
> **TS Interface:** `ActivityPlan` | **Constants key:** `COLLECTIONS.ACTIVITY_PLANS`

接口定义于 `services/activityPlansService.ts`，未收录到 `types/` 目录。

| 字段路径 | 类型 | 必填 | 枚举值 / 说明 | 来 | 往 |
|--------|------|:----:|------------|----|----|
| id | string | — | Firestore doc ID；create 时可选 | 系统: Firestore doc id | 活动计划查询与版本关联 |
| title | string | ✓ | | 角色: B+ / A+；系统: 活动计划表单 | 计划列表与详情展示 |
| description | string | ✓ | | 角色: B+ / A+；系统: 活动计划表单 | 计划详情与审核 |
| type | enum | — | @deprecated: `Community` \| `Business` \| `Individual` \| `International` | 角色: B+ / A+；系统: 旧版表单 | 旧版分类兼容 |
| level | enum | — | `JCI` \| `National` \| `Area` \| `Local` | 角色: B+ / A+；系统: 活动计划表单 | 计划范围展示与筛选 |
| pillar | enum | — | `Individual` \| `Community` \| `Business` \| `International` \| `LOM` \| `Chapter` | 角色: B+ / A+；系统: 活动计划表单 | 活动支柱分类 |
| category | enum | — | `programs` \| `skill_development` \| `events` \| `projects` | 角色: B+ / A+；系统: 活动计划表单 | 计划分类与项目类型筛选 |
| projectType | string | — | 具体项目子类型（PROJECT_TYPES_BY_CATEGORY 值） | 角色: B+ / A+；系统: `category` 联动选项 | 项目类型展示 |
| proposedDate | string | ✓ | | 角色: B+ / A+；系统: 活动计划表单 | 计划时间线 |
| proposedBudget | number | ✓ | | 角色: B+ / A+；系统: 活动计划表单 | 预算审批与规划 |
| eventStartDate | string | — | | 角色: B+ / A+；系统: 活动计划表单 | 活动计划时间范围 |
| eventEndDate | string | — | | 角色: B+ / A+；系统: 活动计划表单 | 活动计划时间范围 |
| eventStartTime | string | — | | 角色: B+ / A+；系统: 活动计划表单 | 活动计划时间范围 |
| eventEndTime | string | — | | 角色: B+ / A+；系统: 活动计划表单 | 活动计划时间范围 |
| objectives | string | ✓ | | 角色: B+ / A+；系统: 活动计划表单 | 审核与项目详情 |
| expectedImpact | string | ✓ | | 角色: B+ / A+；系统: 活动计划表单 | 审核与项目详情 |
| targetAudience | string | — | | 角色: B+ / A+；系统: 活动计划表单 | 计划详情展示 |
| resources | string[] | — | | 角色: B+ / A+；系统: 活动计划表单 | 资源规划展示 |
| timeline | string | — | | 角色: B+ / A+；系统: 活动计划表单 | 计划进度展示 |
| status | enum | ✓ | `Draft` \| `Submitted` \| `Under Review` \| `Approved` \| `Rejected` \| `Active` | 角色: B+ / A+；系统: 提交/审核流程 | 计划状态、审核权限与展示 |
| submittedBy | string | ✓ | | 系统: 当前 `auth.uid` / 提交者 | 提交审计与审核通知 |
| submittedDate | Date \| Timestamp | — | | 系统: `submitActivityPlan()` 提交时生成 | 提交时间展示与排序 |
| reviewedBy | string | — | | 角色: B+ / A+；系统: `reviewActivityPlan()` | 审核审计 |
| reviewedDate | Date \| Timestamp | — | | 系统: `reviewActivityPlan()` 审核时生成 | 审核时间展示 |
| reviewComments | string | — | | 角色: B+ / A+；系统: 审核表单 | 审核意见展示 |
| version | number | ✓ | 版本号，从 1 开始 | 系统: 创建/新建版本时递增 | 版本链与当前版本识别 |
| previousVersionId | string | — | 上一版本 doc ID | 系统: `createNewVersion()` 生成 | 关联上一版 `activityPlans` 文档 |
| attachments | string[] | — | | 角色: B+ / A+；系统: 附件上传 | 计划附件展示 |
| createdAt | Date \| Timestamp | ✓ | | 系统: `createActivityPlan()` 创建时生成 | 创建审计与排序 |
| updatedAt | Date \| Timestamp | ✓ | | 系统: 活动计划更新/审核时生成 | 缓存失效与最后更新时间 |
| parentProjectId | string | — | 所属项目 doc ID | 系统: 从项目活动计划页指定 | 关联 `projects/{parentProjectId}`；项目删除时级联处理 |

---

## `flagship_projects`
> **TS Interface:** `FlagshipProject` | **Constants key:** `COLLECTIONS.FLAGSHIP_PROJECTS`

| 字段路径 | 类型 | 必填 | 枚举值 / 说明 | 来 | 往 |
|--------|------|:----:|------------|----|----|
| id | string | ✓ | Firestore doc ID | 系统: Firestore doc id | 旗舰项目查询与详情 |
| title | string | ✓ | | 角色: B+ / A+；系统: 项目表单 | Guest 旗舰项目展示 |
| description | string | ✓ | | 角色: B+ / A+；系统: 项目表单 | 项目详情展示 |
| logoUrl | string | — | | 角色: B+ / A+；系统: 图片上传 | 项目 Logo 展示 |
| galleryUrls | string[] | — | | 角色: B+ / A+；系统: 图片上传 | 项目图片画廊 |
| status | enum | ✓ | `Active` \| `Inactive` | 角色: B+ / A+；系统: 项目管理操作 | 活跃项目查询与展示 |
| teamSize | number | — | | 角色: B+ / A+；系统: 项目表单 | 项目规模展示 |
| completion | number | — | 0–100 百分比 | 角色: B+ / A+；系统: 项目进度更新 | 项目进度展示 |
| startDate | string | — | | 角色: B+ / A+；系统: 项目表单 | 项目时间线展示 |
| endDate | string | — | | 角色: B+ / A+；系统: 项目表单 | 项目时间线展示 |
| level | string | — | | 角色: B+ / A+；系统: 项目表单 | 项目分类展示 |
| pillar | string | — | | 角色: B+ / A+；系统: 项目表单 | 项目支柱筛选与展示 |
| unsdg | string[] | — | 联合国可持续发展目标编号列表 | 角色: B+ / A+；系统: 项目表单 | 可持续发展目标展示 |
| galleryByYear | map | — | \{ [folder: string]: string[] \}，key=年份文件夹 | 角色: B+ / A+；系统: 图片上传/整理 | 按年份展示项目图片 |
| createdAt | string | — | | 系统: `createProject()` 创建时生成 | 项目排序与审计 |
| updatedAt | string | — | | 系统: `updateProject()` 更新时生成 | 最后更新时间 |

---
## `transactions`
> **TS Interface:** `Transaction` | **Constants key:** `COLLECTIONS.TRANSACTIONS`

| 字段路径 | 类型 | 必填 | 枚举值 / 说明 | 来 | 往 |
|--------|------|:----:|------------|----|----|
| id | string | ✓ | Firestore doc ID | 系统: Firestore doc id | `transactionSplits.parentTransactionId`、财务关联 |
| date | string | ✓ | | 角色: B+ / Finance；系统: 银行导入/付款流程 | 财务报表与排序 |
| description | string | ✓ | | 角色: B+ / Finance；系统: 银行导入/付款流程 | 财务明细展示 |
| purpose | string \| null | — | | 角色: B+ / Finance；系统: 付款请求/项目流程 | 付款与报表说明 |
| amount | number | ✓ | | 角色: B+ / Finance；系统: 付款/银行导入 | 账户余额与财务汇总 |
| type | enum | ✓ | `Income` \| `Expense` | 角色: B+ / Finance；系统: 交易导入/付款流程 | 收入支出汇总 |
| category | enum | ✓ | `Projects & Activities` \| `Membership` \| `Administrative` \| `''`（split-parent 用空串） | 角色: B+ / Finance；系统: `transactionSplits.category` 汇总 | 财务分类与拆分判断 |
| status | enum | ✓ | `Pending` \| `Cleared` \| `Reconciled` \| `Partially Reconciled` \| `Voided` | 角色: Finance；系统: 对账/付款流程 | 财务状态筛选与对账 |
| projectId | string \| null | — | | 系统: 项目/付款流程指定 | 关联 `projects/{projectId}` |
| memberId | string \| null | — | | 系统: 会员付款/会费流程 | 关联 `members/{memberId}` |
| bankAccountId | string | — | | 系统: 银行导入/付款账户选择 | 关联 `bankAccounts/{bankAccountId}`；余额维护 |
| loId | string \| null | — | | 系统: `bankAccounts.loId` 解析 | LO 财务筛选 |
| reconciledAt | string | — | | 系统: 对账完成时写入 | 对账历史 |
| reconciledBy | string | — | | 系统: 对账操作人的 `auth.uid` | 对账审计 |
| referenceNumber | string \| null | — | | 系统: 付款请求/银行导入生成 | 付款与交易检索 |
| paymentRequestId | string \| null | — | | 系统: `paymentRequests` 付款流程 | 关联付款请求 |
| projectTransactionId | string \| null | — | | 系统: 项目交易匹配 | 关联 `projectTrx` |
| projectTransactionIds | string[] | — | | 系统: 项目交易匹配/拆分 | 关联多个 `projectTrx` |
| transactionType | enum | — | `project` \| `operations` \| `dues` \| `merchandise` | 角色: B+ / Finance；系统: 交易分类 | 财务筛选与报表 |
| splitIds | string[] | — | | 系统: `transactionSplits.id` 创建/更新 | 拆分交易查询 |
| splits | TransactionSplit[] | — | 展开见 transactionSplits | 系统: `transactionSplits` 读取展开 | 拆分明细展示 |
| isSplit | boolean | — | | 系统: 拆分流程计算 | 拆分显示与对账 |
| year | number | — | | 系统: `date` 年份解析 | 年度财务筛选 |
| isSplitChild | boolean | — | | 系统: 拆分交易创建 | 父子交易识别 |
| parentTransactionId | string | — | | 系统: 拆分交易创建 | 关联父 `transactions` 文档 |
| inventoryLinkId | string | — | | 系统: 库存交易流程 | 关联库存记录 |
| inventoryVariant | string | — | | 系统: 库存交易流程 | 库存变体扣减 |
| inventoryQuantity | number | — | | 系统: 库存交易流程 | 库存数量扣减 |
| createdAt | string | — | | 系统: 创建交易时生成 | 交易审计 |
| updatedAt | string | — | | 系统: 交易更新时生成 | 缓存失效与审计 |
| originalCategory | string | — | 作废/撤销前原始值 | 系统: 冲销交易保存原始值 | 冲销恢复 |
| originalProjectId | string | — | | 系统: 冲销交易复制原交易的 `projectId` | 恢复原交易项目归属 |
| originalMemberId | string | — | | 系统: 冲销交易复制原交易的 `memberId` | 恢复原交易会员归属 |
| originalPaymentRequestId | string | — | | 系统: 冲销交易复制原交易的 `paymentRequestId` | 追溯原付款请求 |
| originalPurpose | string | — | | 系统: 冲销交易复制原交易的 `purpose` | 冲销审计与原用途展示 |
| originalYear | number | — | | 系统: 从原交易 `date` 解析 | 原交易年度报表恢复 |
| matchedBankAmount | number | — | | 系统: 银行交易匹配流程计算 | 匹配差额与对账展示 |
| matchedBankTxIds | string[] | — | | 系统: 银行匹配记录的交易 ID | 关联匹配银行交易 |
| matchStatus | enum | — | `unmatched` \| `partial` \| `full` \| `over` | 系统: 银行交易匹配流程计算 | 匹配筛选与对账状态 |
| prevStatus | enum \| null | — | 同 status 枚举，unmatch 时还原用 | 系统: 对账前保存 `status` | 取消匹配时恢复交易状态 |
| source | enum | — | `bank_import` \| `manual` | 系统: 银行导入/手动创建流程 | 交易来源筛选与审计 |
| eventRegistrationId | string | — | | 系统: 活动报名付款流程 | 关联 `eventRegistrations` |
| paymentMethod | enum | — | `toyyib` \| `bank_transfer` \| `cash` | 角色: 会员 / Finance；系统: 付款流程 | 付款处理分支与展示 |
| toyyibBillCode | string | — | | 系统: ToyyibPay API 账单返回 | 付款账单关联 |
| reversalOf | string | — | 被冲销的原始交易 ID | 系统: 冲销交易复制原交易 ID | 关联原始 `transactions` |
| reversalReason | string | — | | 角色: Finance；系统: 冲销表单 | 冲销审计说明 |
| reversedBy | string | — | | 系统: 冲销操作人的 `auth.uid` | 冲销审计 |

---

## `transactionSplits`
> **TS Interface:** `TransactionSplit` | **Constants key:** `COLLECTIONS.TRANSACTION_SPLITS`

| 字段路径 | 类型 | 必填 | 枚举值 / 说明 | 来 | 往 |
|--------|------|:----:|------------|----|----|
| id | string | ✓ | Firestore doc ID | 系统: Firestore doc id | `transactions.splitIds`、父交易拆分明细 |
| parentTransactionId | string | ✓ | 指向 transactions 文档 | 系统: 拆分交易流程中的当前交易 | 关联 `transactions/{parentTransactionId}` |
| category | enum | ✓ | `Projects & Activities` \| `Membership` \| `Administrative` \| `''` | 角色: B+ / Finance；系统: 拆分表单 | 父交易分类汇总 |
| type | enum | ✓ | `Income` \| `Expense` | 系统: 父 `transactions.type` | 拆分金额汇总 |
| year | number | — | | 系统: 父交易 `date` 年份 | 年度财务筛选 |
| projectId | string \| null | — | | 系统: 父交易/项目流程指定 | 关联 `projects/{projectId}` |
| memberId | string \| null | — | | 系统: 父交易/会员付款流程指定 | 关联 `members/{memberId}` |
| purpose | string \| null | — | | 系统: 父交易/付款请求 | 拆分明细说明 |
| paymentRequestId | string | — | | 系统: 付款请求流程 | 关联 `paymentRequests` |
| amount | number | ✓ | | 角色: B+ / Finance；系统: 拆分表单 | 父交易金额校验与汇总 |
| description | string | ✓ | | 角色: B+ / Finance；系统: 拆分表单 | 拆分明细展示 |
| createdAt | string | ✓ | | 系统: 创建拆分时生成 | 拆分审计 |
| createdBy | string | ✓ | | 系统: 当前 `auth.uid` | 拆分审计 |
| inventoryLinkId | string | — | | 系统: 库存交易流程 | 关联库存记录 |
| inventoryVariant | string | — | | 系统: 库存交易流程 | 库存变体扣减/恢复 |
| inventoryQuantity | number | — | | 系统: 库存交易流程 | 库存数量扣减/恢复 |
| projectTransactionId | string \| null | — | | 系统: 项目交易匹配 | 关联 `projectTrx` |
| projectTransactionIds | string[] | — | | 系统: 项目交易匹配/拆分 | 关联多个 `projectTrx` |
| autoGenerated | boolean | — | | 系统: 拆分流程标记 | 自动拆分识别 |
| status | enum | — | `Reconciled` \| `Cleared` \| `Pending` | 系统: 父交易对账状态 | 对账筛选与状态同步 |
| reconciledAt | string | — | | 系统: 对账流程 | 对账审计 |
| reconciledBy | string | — | | 系统: 对账操作人的 `auth.uid` | 对账审计 |

---

## `projectTrx`
> **TS Interface:** `ProjectTransaction` | **Constants key:** `COLLECTIONS.PROJECT_TRANSACTIONS`

| 字段路径 | 类型 | 必填 | 枚举值 / 说明 | 来 | 往 |
|--------|------|:----:|------------|----|----|
| id | string | ✓ | Firestore doc ID | 系统: Firestore doc id | 项目财务查询与汇总 |
| projectId | string | ✓ | 指向 projects 文档 | 系统: 项目财务流程指定 | 关联 `projects/{projectId}` |
| financialAccountId | string | ✓ | | 系统: 项目财务账户选择 | 项目账户余额与汇总 |
| type | enum | ✓ | `income` \| `expense` | 角色: B+ / Finance；系统: 项目交易表单 | 项目收入支出汇总 |
| amount | number | ✓ | | 角色: B+ / Finance；系统: 项目交易表单 | 项目财务汇总 |
| categoryId | string | — | | 角色: B+ / Finance；系统: 项目财务分类选择 | 项目财务分类汇总 |
| description | string | ✓ | | 角色: B+ / Finance；系统: 项目交易表单 | 项目交易明细展示 |
| purpose | string | — | | 角色: B+ / Finance；系统: 项目交易表单 | 项目财务说明 |
| date | string | ✓ | | 角色: B+ / Finance；系统: 项目交易表单 | 项目财务报表排序 |
| createdBy | string | ✓ | | 系统: 创建操作人的 `auth.uid` | 交易审计 |
| createdAt | string | ✓ | | 系统: 项目交易创建时生成 | 交易审计与排序 |
| receiptUrl | string | — | | 角色: B+ / Finance；系统: 收据上传 | 项目交易凭证展示 |
| approvedBy | string | — | | 系统: 审批操作人的 `auth.uid` | 审批审计 |
| approvedAt | string | — | | 系统: 项目交易审批时生成 | 审批时间展示 |
| tags | string[] | — | | 角色: B+ / Finance；系统: 项目交易表单 | 项目交易筛选与分类 |
| status | string | — | 无枚举约束 | 角色: B+ / Finance；系统: 项目交易审批流程 | 项目交易状态展示与筛选 |

---

## `bankAccounts`
> **TS Interface:** `BankAccount` | **Constants key:** `COLLECTIONS.BANK_ACCOUNTS`

| 字段路径 | 类型 | 必填 | 枚举值 / 说明 | 来 | 往 |
|--------|------|:----:|------------|----|----|
| id | string | ✓ | Firestore doc ID | 系统: Firestore doc id | `transactions.bankAccountId` |
| name | string | ✓ | | 角色: B+ / Finance；系统: 银行账户表单 | 银行账户列表展示 |
| balance | number | — | 旧字段，已被 currentBalance 取代 | 系统: 旧版账户数据 | 兼容旧账户余额读取 |
| initialBalance | number | — | | 角色: B+ / Finance；系统: 银行账户表单 | 余额计算基准 |
| currentBalance | number | — | SYNC-002：由 createTransaction/deleteTransaction 原子维护的运行余额 | 系统: `transactions.amount` 创建/删除原子维护 | 账户余额展示与低余额提醒 |
| currency | string | ✓ | | 角色: B+ / Finance；系统: 银行账户表单 | 账户金额显示与财务报表币种 |
| lastReconciled | string | ✓ | | 角色: Finance；系统: 对账流程的 `reconciliationDate` | 最近对账日期展示 |
| lastReconciledAt | string | — | | 系统: 对账完成后写入当前时间 | 对账状态与审计展示 |
| lastReconciledBy | string | — | | 系统: 对账流程的 `reconciledBy` | 对账操作人展示与审计 |
| accountNumber | string | — | | 角色: B+ / Finance；系统: 银行账户表单 | 账户识别与付款账户选择 |
| bankName | string | — | | 角色: B+ / Finance；系统: 银行账户表单 | 银行账户列表与付款展示 |
| accountType | enum | — | `Current` \| `Savings` \| `Investment` \| `Fixed Deposit` \| `Cash` \| `Other` | 角色: B+ / Finance；系统: 银行账户表单 | 账户类型展示与校验 |
| loId | string | — | | 系统: 银行账户表单/LO 配置 | LO 范围查询与权限隔离 |
| createdAt | string | — | | 系统: `createBankAccount()` 创建时生成 | 账户审计与排序 |
| updatedAt | string | — | | 系统: `updateBankAccount()` / 对账更新 | 缓存失效与最后更新时间 |

---

## `paymentRequests`
> **TS Interface:** `PaymentRequest` | **Constants key:** `COLLECTIONS.PAYMENT_REQUESTS`

| 字段路径 | 类型 | 必填 | 枚举值 / 说明 | 来 | 往 |
|--------|------|:----:|------------|----|----|
| id | string | ✓ | Firestore doc ID | 系统: Firestore doc id | 付款请求查询 |
| applicantId | string | ✓ | | 系统: 当前 `members.id` | 关联 `members/{applicantId}` |
| applicantName | string \| null | — | | 系统: 从 `members.general.name` 复制 | 付款请求展示 |
| applicantEmail | string \| null | — | | 系统: 从 `members.contact.email` 复制 | 付款通知 |
| applicantPosition | string \| null | — | | 系统: `members.business.position` 复制 | 付款申请展示 |
| date | string | ✓ | | 角色: 申请人；系统: 付款申请表单 | 付款审批与交易日期 |
| time | string | ✓ | | 角色: 申请人；系统: 付款申请表单 | 付款审批与交易时间 |
| category | enum | ✓ | `administrative` \| `projects_activities` | 角色: 申请人；系统: 付款申请表单 | 审批路由与财务分类 |
| activityId | string \| null | — | | 系统: 当前 `events.id` / 活动申请 | 关联活动支出 |
| totalAmount | number | ✓ | | 系统: `items[].amount` 汇总 | 付款审批与交易金额 |
| remark | string \| null | — | | 角色: 申请人；系统: 付款申请表单 | 审批备注展示 |
| items | PaymentRequestItem[] | ✓ | 见下方子字段 | 角色: 申请人；系统: 付款申请表单 | 金额汇总与付款明细 |
| items[].purpose | string | ✓ | | 角色: 申请人；系统: 付款申请表单 | 付款用途展示 |
| items[].amount | number | ✓ | | 角色: 申请人；系统: 付款申请表单 | `totalAmount` 汇总 |
| items[].attachment | string \| null | — | | 角色: 申请人；系统: 文件上传 | 付款凭证展示 |
| claimFromBankAccountId | string \| null | — | | 角色: Finance；系统: 银行账户选择 | 关联 `bankAccounts/{id}` |
| bankName | string \| null | — | | 系统: `bankAccounts.bankName` 复制 | 付款信息展示 |
| accountHolder | string \| null | — | | 角色: Finance；系统: 银行账户选择 | 付款信息展示 |
| accountNumber | string \| null | — | | 系统: `bankAccounts.accountNumber` 复制 | 付款信息展示 |
| amount | number | ✓ | | 角色: 申请人；系统: 付款申请表单 | 付款审批与交易金额 |
| purpose | string | ✓ | | 角色: 申请人；系统: 付款申请表单 | 付款交易用途 |
| activityRef | string \| null | — | | 系统: 活动/项目关联 | 活动支出追踪 |
| referenceNumber | string | ✓ | 格式 `PR-{loId}-{YYYYMMDD}-{序号}` | 系统: `loId`、日期和计数器生成 | 付款请求与交易检索 |
| status | enum | ✓ | `draft` \| `submitted` \| `approved` \| `rejected` \| `cancelled` \| `paid` | 角色: 申请人 / Finance；系统: 审批付款流程 | 审批、付款和交易创建分支 |
| attachmentUrls | string[] | — | | 系统: 申请附件上传 | 审批凭证与付款记录 |
| loId | string | ✓ | | 系统: 申请人/活动的 LO 配置 | LO 范围查询与权限隔离 |
| createdAt | string | ✓ | | 系统: 创建付款请求时生成 | 请求审计 |
| updatedAt | string | ✓ | | 系统: 付款请求更新时生成 | 缓存与最后更新时间 |
| updatedBy | string \| null | — | | 系统: 当前操作人的 `auth.uid` | 更新审计 |
| reviewedBy | string \| null | — | | 系统: Finance/Board 审批人的 `auth.uid` | 审批审计 |
| reviewedAt | string \| null | — | | 系统: 审批操作时间 | 审批历史展示 |
| rejectionReason | string \| null | — | | 角色: 审批人；系统: 拒绝流程 | 拒绝原因展示 |
| paidAt | string \| null | — | | 系统: 付款完成时生成 | 付款历史展示 |
| expenseTxFailed | boolean | — | | 系统: 付款请求创建费用交易失败标记 | 异常重试与告警 |
| amountSyncFailed | boolean | — | | 系统: 金额同步失败标记 | 异常处理 |

---

## `reconciliations`
> **TS Interface:** `ReconciliationRecord` | **Constants key:** `COLLECTIONS.RECONCILIATIONS`

| 字段路径 | 类型 | 必填 | 枚举值 / 说明 | 来 | 往 |
|--------|------|:----:|------------|----|----|
| id | string | — | Firestore doc ID（可选，接口标注 `id?`） | 系统: Firestore doc id | 对账记录查询 |
| bankAccountId | string | ✓ | | 系统: 当前 `bankAccounts.id` | 关联银行账户并更新对账字段 |
| reconciliationDate | string | ✓ | | 角色: Finance；系统: 对账表单 | 对账范围与银行账户 |
| statementBalance | number | ✓ | | 角色: Finance；系统: 银行对账单 | 银行账户对账余额 |
| systemBalance | number | ✓ | | 系统: `transactions` 余额汇总 | 对账差异计算 |
| adjustedBalance | number | ✓ | | 角色: Finance；系统: 对账调整 | 银行账户调整余额 |
| discrepancies | ReconciliationDiscrepancy[] | ✓ | 见下方子字段 | 系统: 银行交易与 `transactions` 核对 | 差异处理与对账完成判断 |
| discrepancies[].id | string | ✓ | | 系统: 对账差异生成 | 差异记录追踪 |
| discrepancies[].transactionId | string | ✓ | | 系统: `transactions.id` | 交易核对与修正 |
| discrepancies[].type | enum | ✓ | `missing` \| `amount_mismatch` \| `duplicate` | 系统: 银行交易与 `transactions` 对账核对 | 差异处理分支与对账报告分类 |
| discrepancies[].expectedAmount | number | — | | 系统: `transactions` 汇总 | 差异计算 |
| discrepancies[].actualAmount | number | — | | 角色: Finance；系统: 银行对账单 | 差异计算 |
| discrepancies[].description | string | ✓ | | 系统: 对账差异生成 | 差异展示 |
| discrepancies[].resolved | boolean | — | | 角色: Finance；系统: 差异处理流程 | 对账完成判断 |
| discrepancies[].resolutionNotes | string | — | | 角色: Finance；系统: 差异处理表单 | 对账审计 |
| reconciledBy | string | ✓ | | 系统: 对账操作人的 `auth.uid` | 账户对账审计 |
| notes | string | — | | 角色: Finance；系统: 对账表单 | 对账说明展示 |
| status | enum | ✓ | `in_progress` \| `completed` | 系统: 差异处理流程 | 对账状态展示 |
| transactionTypeSummary | object | ✓ | | 系统: `transactions` 分类汇总 | 对账统计展示 |
| transactionTypeSummary.project | number | ✓ | | 系统: `transactions.category` 汇总 | 对账统计展示 |
| transactionTypeSummary.operations | number | ✓ | | 系统: `transactions.category` 汇总 | 对账统计展示 |
| transactionTypeSummary.dues | number | ✓ | | 系统: `transactions.category` 汇总 | 对账统计展示 |
| transactionTypeSummary.merchandise | number | ✓ | | 系统: `transactions.category` 汇总 | 对账统计展示 |
| createdAt | string | — | | 系统: 创建对账记录时生成 | 对账审计 |
| updatedAt | string | — | | 系统: 对账记录更新时生成 | 最后更新时间 |

---

## `inventory`
> **TS Interface:** `InventoryItem` | **Constants key:** `COLLECTIONS.INVENTORY`

| 字段路径 | 类型 | 必填 | 枚举值 / 说明 | 来 | 往 |
|--------|------|:----:|------------|----|----|
| id | string | ✓ | Firestore doc ID | 系统: Firestore doc id | `stock_movements.itemId`、库存查询 |
| name | string | ✓ | | 角色: B+ / Inventory；系统: 库存表单 | 库存列表与出入库展示 |
| category | enum | ✓ | `Electronics` \| `Furniture` \| `Merchandise` \| `Stationery` \| `Equipment` \| `Supplies` \| `Other` | 角色: B+ / Inventory；系统: 库存表单 | 库存分类筛选与报表 |
| quantity | number | ✓ | | 系统: `stock_movements.newQuantity` / 出入库流程 | 库存数量与告警计算 |
| location | string | ✓ | | 角色: B+ / Inventory；系统: 库存表单 | 库存位置展示 |
| status | enum | ✓ | `Available` \| `Low Stock` \| `Out of Stock` \| `Checked Out` | 系统: `quantity`、借出/归还流程 | 库存状态与告警 |
| lastAudit | string | — | | 系统: 库存盘点操作 | 盘点记录展示 |
| custodian | string | — | | 角色: Inventory；系统: 借出流程 | 当前保管人展示 |
| condition | string | — | | 角色: Inventory；系统: 库存表单 | 资产状态展示 |
| description | string | — | | 角色: B+ / Inventory；系统: 库存表单 | 库存详情展示 |
| lastCheckedOut | string | — | | 系统: 借出流程 | 最近借出记录 |
| expectedReturnDate | string | — | | 角色: 借用人/Inventory；系统: 借出表单 | 逾期提醒与借出展示 |
| checkedOutTo | string | — | | 系统: 借出操作关联 `members.id` | 借用人展示 |
| checkedOutDate | string | — | | 系统: 借出流程 | 借出历史展示 |
| returnedDate | string | — | | 系统: 归还流程 | 归还历史展示 |
| minQuantity | number | — | | 角色: Inventory；系统: 库存表单 | 库存告警阈值 |
| lastCheckedAt | string | — | | 系统: 库存盘点操作 | 最近盘点展示 |
| lastTransactionId | string | — | | 系统: 最新 `stock_movements.id` | 最近库存变动追踪 |
| lastTransactionDate | string | — | | 系统: 最新 `stock_movements.date` | 最近变动展示 |
| lastSaleDate | string | — | | 系统: 销售/出库流程 | 销售统计 |
| purchaseDate | string | — | | 角色: Inventory；系统: 采购入库流程 | 资产详情展示 |
| purchasePrice | number | — | | 角色: Finance / Inventory；系统: 采购入库流程 | 资产价值计算 |
| depreciationMethod | enum | — | `Straight Line` \| `Declining Balance` \| `Units of Production` \| `None` | 角色: Finance / Inventory；系统: 资产配置 | 折旧计算 |
| depreciationRate | number | — | | 角色: Finance / Inventory；系统: 折旧配置 | 当前价值计算 |
| currentValue | number | — | | 系统: 折旧计算 | 资产报表展示 |
| usefulLife | number | — | | 角色: Finance / Inventory；系统: 资产配置 | 折旧计算 |
| lastDepreciationUpdate | string | — | | 系统: 折旧计算 | 资产审计 |
| variants | object[] | — | 见下方子字段 | 角色: Inventory；系统: 库存表单 | SKU/规格库存展示与数量计算 |
| variants[].size | string | ✓ | | 角色: Inventory；系统: 库存表单 | 规格筛选与出入库 |
| variants[].quantity | number | ✓ | | 系统: 出入库流程 | 规格库存数量与告警 |
| variants[].sku | string | — | | 角色: Inventory；系统: 库存表单 | SKU 检索与出入库 |

---

## `stock_movements`
> **TS Interface:** `StockMovement` | **Constants key:** `COLLECTIONS.STOCK_MOVEMENTS`

| 字段路径 | 类型 | 必填 | 枚举值 / 说明 | 来 | 往 |
|--------|------|:----:|------------|----|----|
| id | string | ✓ | Firestore doc ID | 系统: Firestore doc id | `inventory.lastTransactionId` |
| itemId | string | ✓ | 指向 inventory 文档 | 系统: 当前库存项目 | 关联 `inventory/{itemId}` |
| itemName | string | ✓ | | 系统: 从 `inventory.name` 复制 | 出入库历史展示 |
| date | string | ✓ | | 系统: 库存变动时间 | 变动历史排序 |
| type | enum | ✓ | `In` \| `Out` \| `Adjustment` | 角色: B+ / Inventory；系统: 出入库操作 | 数量变更分支 |
| quantity | number | ✓ | | 角色: B+ / Inventory；系统: 出入库表单 | `inventory.quantity` 更新 |
| previousQuantity | number | ✓ | | 系统: 变更前 `inventory.quantity` | 变更审计 |
| newQuantity | number | ✓ | | 系统: 变更后 `inventory.quantity` | 回写库存数量 |
| variant | string | — | | 角色: Inventory；系统: 出入库表单 | 规格库存更新 |
| reason | string | ✓ | | 角色: Inventory；系统: 出入库表单 | 变动审计与库存详情 |
| referenceId | string | — | | 系统: 采购、销售、借出或调整流程 | 关联业务记录 |
| performedBy | string | ✓ | | 系统: 操作人的 `auth.uid` | 出入库审计 |

---

## `maintenance_schedules`
> **TS Interface:** `MaintenanceSchedule` | **Constants key:** `COLLECTIONS.MAINTENANCE_SCHEDULES`

| 字段路径 | 类型 | 必填 | 枚举值 / 说明 | 来 | 往 |
|--------|------|:----:|------------|----|----|
| id | string | — | Firestore doc ID（接口标注 `id?`） | 系统: Firestore doc id | 维护计划查询/更新 |
| itemId | string | ✓ | 指向 inventory 文档 | 角色: BOARD / ADMIN；系统: 维护计划表单 | `inventory/{itemId}`、`inventory_alerts.itemId` |
| type | enum | ✓ | `Preventive` \| `Corrective` \| `Inspection` \| `Calibration` | 角色: BOARD / ADMIN；系统: 维护计划表单 | 维护提醒类型 |
| frequency | enum | — | `Daily` \| `Weekly` \| `Monthly` \| `Quarterly` \| `Semi-Annual` \| `Annual` \| `Custom` | 角色: BOARD / ADMIN；系统: 维护计划表单 | 下次维护日期计算 |
| customDays | number | — | frequency=Custom 时使用 | 角色: BOARD / ADMIN；系统: 自定义周期输入 | 自定义维护周期计算 |
| lastMaintained | string | — | | 系统: 完成维护流程 | 下一次维护计算 |
| nextMaintenanceDate | string | — | | 系统: 维护周期计算 | 维护计划与逾期判断 |
| scheduledDate | string | — | | 角色: BOARD / ADMIN；系统: 维护计划流程 | `inventory_alerts` 到期判断 |
| assignedTo | string | — | | 角色: BOARD / ADMIN；系统: 维护人员分配 | 维护任务展示 |
| notes | string | — | | 角色: BOARD / ADMIN；系统: 维护计划表单 | 维护详情 |
| description | string | — | | 角色: BOARD / ADMIN；系统: 维护计划表单 | 维护详情与提醒 |
| status | enum | — | `Scheduled` \| `In Progress` \| `Completed` \| `Cancelled` | 角色: BOARD / ADMIN；系统: 维护状态流程 | 完成/取消判断 |
| estimatedDuration | number | — | 单位：分钟 | 角色: BOARD / ADMIN；系统: 维护计划表单 | 维护任务展示 |
| priority | enum | — | `Low` \| `Medium` \| `High` \| `Critical` | 角色: BOARD / ADMIN；系统: 维护计划表单 | 维护排序与提醒优先级 |
| createdAt | string | — | | 系统: 创建维护计划时生成 | 维护审计与排序 |
| completedDate | string | — | | 系统: status 变为 `Completed` | 维护历史 |
| active | boolean | — | | 系统: 创建/停用维护计划流程 | 活跃维护计划查询 |

---

## `inventory_alerts`
> **TS Interface:** `InventoryAlert` | **Constants key:** `COLLECTIONS.INVENTORY_ALERTS`

| 字段路径 | 类型 | 必填 | 枚举值 / 说明 | 来 | 往 |
|--------|------|:----:|------------|----|----|
| id | string | — | Firestore doc ID（接口标注 `id?`） | 系统: Firestore doc id | 告警确认/解决/删除 |
| itemId | string | ✓ | 指向 inventory 文档 | 系统: `inventory.id` / `maintenance_schedules.itemId` | 关联库存详情 |
| type | enum | ✓ | `Low Stock` \| `Overdue Return` \| `Maintenance Due` \| `Maintenance Overdue` \| `Out of Stock` | 系统: 库存数量、归还日期或维护日期判断 | 告警分类与 UI |
| severity | enum | ✓ | `Low` \| `Medium` \| `High` \| `Critical` | 系统: 库存数量/逾期程度计算 | 告警排序 |
| message | string | ✓ | | 系统: `inventory.name`、数量或维护信息生成 | 告警展示 |
| createdAt | string | ✓ | | 系统: `createAlert()` / `generateAlerts()` | 告警排序与审计 |
| acknowledged | boolean | — | | 系统: 创建默认 false；确认操作更新 | 未确认告警筛选 |
| acknowledgedBy | string | — | | 系统: 确认操作人的 `auth.uid` | 告警审计 |
| acknowledgedAt | string \| Date | — | | 系统: 确认操作时间 | 告警审计 |
| resolved | boolean | — | | 系统: 告警解决或库存状态恢复 | 未解决告警筛选 |
| loId | string | — | | 系统: 告警创建时 LO 上下文 | LO 告警筛选 |
| threshold | number | — | | 系统: `inventory.minQuantity` | 低库存判断 |
| currentValue | number | — | | 系统: `inventory.quantity` 或维护/归还值 | 阈值比较与告警详情 |

---

## `finance_alerts`
> **TS Interface:** `FinanceAlert` | **Constants key:** `COLLECTIONS.FINANCE_ALERTS`

| 字段路径 | 类型 | 必填 | 枚举值 / 说明 | 来 | 往 |
|--------|------|:----:|------------|----|----|
| id | string | ✓ | Firestore doc ID | 系统: Firestore doc id | 告警查询/解决 |
| type | string | ✓ | 无枚举约束，由服务端流程写入 | 系统: 财务异常检测流程 | 告警分类 |
| message | string | ✓ | | 系统: 财务异常流程生成 | 财务告警展示 |
| transactionId | string | — | | 系统: `transactions.id` | 相关交易查询/修复 |
| billCode | string | — | | 系统: `toyyibBills.billCode` / webhook | 账单查询 |
| eventRegistrationId | string | — | | 系统: `eventRegistrations.id` | 活动付款查询 |
| paymentRequestId | string | — | | 系统: `paymentRequests.id` | 付款申请查询 |
| resolved | boolean | ✓ | | 系统: 创建默认未解决；解决流程更新 | 未解决告警筛选 |
| resolvedAt | string | — | | 系统: 解决操作时间 | 告警审计 |
| resolvedBy | string | — | | 系统: 操作人的 `auth.uid` | 告警审计 |
| createdAt | string | ✓ | | 系统: 异常检测/回调处理时生成 | 告警排序 |
| updatedAt | string | — | | 系统: 告警解决或补充信息流程 | 告警更新时间 |

---

## `toyyibBills`
> **TS Interface:** `ToyyibBillRecord`（定义于 `services/toyyibService.ts`） | **Constants key:** `COLLECTIONS.TOYYIB_BILLS`

| 字段路径 | 类型 | 必填 | 枚举值 / 说明 | 来 | 往 |
|--------|------|:----:|------------|----|----|
| billCode | string | ✓ | Firestore doc ID 兼数据字段 | 系统: ToyyibPay API 返回 | `transactions.toyyibBillCode`、付款查询 |
| categoryCode | string | ✓ | 指向 toyyibCategories | 角色: BOARD / ADMIN；系统: 账单创建参数 | `toyyibCategories.categoryCode` |
| billName | string | ✓ | | 系统: 付款请求/活动报名流程 | 付款页面与交易说明 |
| billDescription | string | — | | 系统: 账单创建流程 | 付款说明 |
| billAmount | number | ✓ | 单位：分（sen） | 系统: 付款金额转换为 sen | 支付金额核对 |
| billTo | string | ✓ | 付款人姓名 | 系统: `members.general.name` / 报名姓名 | ToyyibPay 账单资料 |
| billEmail | string | ✓ | | 系统: `members.contact.email` / 访客邮箱 | ToyyibPay 通知 |
| billpaymentStatus | string | ✓ | `"1"`=paid, `"2"`=pending, `"3"`=failed, `"4"`=settling | 系统: ToyyibPay API / webhook | 付款状态、交易创建或退款 |
| billPaymentDate | string | — | | 系统: ToyyibPay 支付回调 | `transactions.date` |
| memberId | string | — | 会员 UID，用于重复账单检测 | 系统: `members.id` | 会员账单查询与去重 |
| projectId | string | — | 活动 ID，用于重复账单检测 | 系统: `events.id` / 项目付款流程 | 活动账单查询与去重 |
| createdAt | any | — | Firestore Timestamp | 系统: 创建账单时生成 | 账单排序与审计 |
| billExternalReferenceNo | string | — | webhook 回调后写入 | 系统: ToyyibPay webhook | `transactions.referenceNumber` |
| refundTransactionId | string | — | 支付撤销时写入被冲销的交易 ID | 系统: 退款/冲销流程的 `transactions.id` | 退款交易追踪 |
| refundedAt | any | — | Firestore Timestamp | 系统: 退款 webhook 处理时间 | 退款审计 |
| updatedAt | any | — | Firestore Timestamp | 系统: 支付/退款/webhook 更新 | 账单更新时间 |

---

## `toyyibCategories`
> **TS Interface:** `ToyyibCategory`（定义于 `services/toyyibService.ts`） | **Constants key:** `COLLECTIONS.TOYYIB_CATEGORIES`

| 字段路径 | 类型 | 必填 | 枚举值 / 说明 | 来 | 往 |
|--------|------|:----:|------------|----|----|
| categoryCode | string | ✓ | Firestore doc ID 兼数据字段 | 角色: BOARD / ADMIN；系统: 类别配置 | `toyyibBills.categoryCode`、ToyyibPay API |
| categoryName | string | ✓ | | 角色: BOARD / ADMIN；系统: 类别配置表单 | 类别列表与账单创建 |
| categoryDescription | string | ✓ | | 角色: BOARD / ADMIN；系统: 类别配置表单 | 类别详情与账单创建 |
| categoryStatus | string | — | | 角色: BOARD / ADMIN；系统: 启用/停用流程 | 可用类别筛选 |
| createdAt | any | — | Firestore Timestamp | 系统: 类别创建流程 | 类别审计 |
| billCount | number | — | | 系统: `toyyibBills.categoryCode` 聚合 | 类别账单数量统计 |
| totalAmount | number | — | | 系统: `toyyibBills.billAmount` 聚合 | 类别金额统计 |
| linkedType | enum | — | `membership` \| `project` | 角色: BOARD / ADMIN；系统: 类别配置 | 会员/项目账单分支 |
| linkedProjectId | string | — | | 系统: 项目类别配置 | `projects.id`、项目账单 |
| linkedProjectName | string | — | | 系统: `projects.name/title` 快照 | 类别及账单展示 |
| membershipType | string | — | 会员类型，金额由 MembershipConfigService 解析 | 角色: BOARD / ADMIN；系统: 会员类别配置 | `members.jciCareer.membershipType`、会费金额 |
| linkedYear | string | — | 例 `"2026"` | 角色: BOARD / ADMIN；系统: 年度配置 | 会费/项目年度筛选 |

---

## `toyyibpay_webhooks`
> 无专属 TS 接口（服务端工具集合）| **Constants key:** `COLLECTIONS.TOYYIBPAY_WEBHOOKS`

文档由 `netlify/functions/toyyibpay-callback.mjs` 的 Firestore Admin SDK 写入，客户端不可访问。字段从回调函数源码推断：

| 字段路径 | 类型 | 必填 | 枚举值 / 说明 | 来 | 往 |
|--------|------|:----:|------------|----|----|
| transactionId | string | ✓ | doc ID，用于幂等去重 | 系统: ToyyibPay webhook `transaction_id` | 回调幂等去重 |
| billCode | string | ✓ | ToyyibPay billcode | 系统: ToyyibPay webhook `billcode` | `toyyibBills.billCode` |
| orderId | string | — | ToyyibPay order_id | 系统: ToyyibPay webhook `order_id` | 回调审计 |
| receivedAt | Timestamp | ✓ | Firestore Admin Timestamp | 系统: webhook 接收时间 | 回调审计 |
| processed | boolean | ✓ | false=处理中/失败，true=已成功处理 | 系统: webhook 处理流程 | 重试与幂等控制 |

---

## `sponsorships`
> **TS Interface:** `SponsorshipRecord`（定义于 `types/gamification.ts`） | **Constants key:** `COLLECTIONS.SPONSORSHIPS`

| 字段路径 | 类型 | 必填 | 枚举值 / 说明 | 来 | 往 |
|--------|------|:----:|------------|----|----|
| id | string | — | Firestore doc ID（接口标注 `id?`） | 系统: Firestore doc id | 赞助记录查询 |
| memberId | string | ✓ | | 系统: 当前 `members.id` / 赞助流程 | 会员赞助记录 |
| memberName | string | ✓ | | 系统: `members.general.name` 复制 | 赞助记录展示 |
| sponsorName | string | ✓ | | 角色: 赞助人；系统: 赞助表单 | 赞助方展示 |
| amount | number | ✓ | | 角色: 赞助人/Finance；系统: 赞助表单 | 财务统计与赞助记录 |
| date | string | ✓ | | 系统: 赞助交易日期 | 赞助历史排序 |
| description | string | — | | 角色: 赞助人；系统: 赞助表单 | 赞助详情展示 |
| transactionId | string | — | 可选跨引用 transactions 文档 | 系统: `transactions.id` | 赞助交易追踪与对账 |
| createdAt | any | — | | 系统: 创建赞助记录时生成 | 审计与排序 |
| updatedAt | any | — | | 系统: 赞助记录更新时生成 | 最后更新时间展示 |

---

## `advertisements`
> **TS Interface:** `Advertisement`（定义于 `services/advertisementService.ts`） | **Constants key:** `COLLECTIONS.ADVERTISEMENTS`

| 字段路径 | 类型 | 必填 | 枚举值 / 说明 | 来 | 往 |
|--------|------|:----:|------------|----|----|
| id | string | — | Firestore doc ID（接口标注 `id?`） | 系统: Firestore doc id | 广告查询与投放 |
| title | string | ✓ | | 角色: 广告主；系统: 广告表单 | 广告展示 |
| description | string | ✓ | | 角色: 广告主；系统: 广告表单 | 广告详情展示 |
| type | enum | ✓ | `Banner` \| `Newsletter` \| `Event Sponsorship` \| `Social Media` \| `Website` |
| placement | enum[] | ✓ | `Homepage` \| `Events Page` \| `Newsletter Header` \| `Newsletter Footer` \| `Sidebar` \| `Popup` | 角色: 广告主；系统: 广告表单 | 广告位置筛选与投放 |
| targetAudience | enum | — | `All Members` \| `Specific Tier` \| `Specific Role` \| `Custom` | 角色: 广告主；系统: 广告表单 | 受众筛选与投放 |
| targetCriteria | object | — | | 系统: 受众配置表单 | 受众匹配 |
| targetCriteria.tiers | string[] | — | | 角色: 广告主；系统: 受众配置 | 会员等级筛选 |
| targetCriteria.roles | string[] | — | | 角色: 广告主；系统: 受众配置 | 会员角色筛选 |
| targetCriteria.memberIds | string[] | — | | 角色: 广告主；系统: 受众配置 | 指定会员投放 |
| businessProfileId | string | — | 链接到商业目录 | 系统: Business Directory 关联 | 广告主资料展示 |
| imageUrl | string | ✓ | | 角色: 广告主；系统: 媒体上传 | 广告渲染 |
| linkUrl | string | — | | 角色: 广告主；系统: 广告表单 | 点击跳转 |
| startDate | Date \| Timestamp \| string | ✓ | | 角色: 广告主；系统: 广告表单 | 投放时间校验 |
| endDate | Date \| Timestamp \| string | — | | 角色: 广告主；系统: 广告表单 | 投放结束与状态计算 |
| status | enum | ✓ | `Active` \| `Scheduled` \| `Expired` \| `Paused` | 系统: 投放时间与广告状态操作 | 广告展示资格判断 |
| impressions | number | ✓ | | 系统: 广告展示埋点 | 广告统计 |
| clicks | number | ✓ | | 系统: 广告点击埋点 | 广告统计与计费 |
| priority | number | ✓ | 数值越大优先级越高 | 角色: 广告管理员；系统: 广告表单 | 广告排序与投放优先级 |
| budget | number | — | | 角色: Finance / 广告主；系统: 广告表单 | 投放预算控制 |
| costPerImpression | number | — | | 角色: Finance；系统: 广告配置 | 投放计费统计 |
| costPerClick | number | — | | 角色: Finance；系统: 广告配置 | 点击计费统计 |
| provider | string | — | | 角色: 广告主；系统: 广告表单 | 广告主信息展示 |
| logoUrl | string | — | | 角色: 广告主；系统: 媒体上传 | 广告渲染 |
| usageLimit | number | — | | 角色: 广告主；系统: 广告配置 | 投放次数限制 |
| termsAndConditions | string | — | | 角色: 广告主；系统: 广告表单 | 广告详情展示 |
| createdAt | Date \| Timestamp | ✓ | | 系统: 创建广告时生成 | 审计与排序 |
| updatedAt | Date \| Timestamp | ✓ | | 系统: 广告更新时生成 | 最后更新时间展示 |

---

## `promotionPackages`
> **TS Interface:** `PromotionPackage`（定义于 `services/advertisementService.ts`） | **Constants key:** `COLLECTIONS.PROMOTION_PACKAGES`

| 字段路径 | 类型 | 必填 | 枚举值 / 说明 | 来 | 往 |
|--------|------|:----:|------------|----|----|
| id | string | — | Firestore doc ID（接口标注 `id?`） | 系统: Firestore doc id | 套餐查询与广告订单 |
| name | string | ✓ | | 角色: 广告管理员；系统: 套餐表单 | 套餐列表展示 |
| description | string | ✓ | | 角色: 广告管理员；系统: 套餐表单 | 套餐详情展示 |
| price | number | ✓ | | 角色: Finance / 广告管理员；系统: 套餐表单 | 订单金额与计费 |
| duration | number | ✓ | 单位：天 | 角色: 广告管理员；系统: 套餐表单 | 投放期限计算 |
| features | string[] | ✓ | | 角色: 广告管理员；系统: 套餐表单 | 套餐详情展示 |
| includes | object | ✓ | | 系统: 套餐配置 | 广告资源额度计算 |
| includes.bannerSlots | number | — | | 系统: 套餐配置 | Banner 额度校验 |
| includes.newsletterMentions | number | — | | 系统: 套餐配置 | Newsletter 额度校验 |
| includes.eventSponsorships | number | — | | 系统: 套餐配置 | 活动赞助额度校验 |
| includes.socialMediaPosts | number | — | | 系统: 套餐配置 | 社交媒体额度校验 |
| status | enum | ✓ | `Active` \| `Inactive` | 角色: 广告管理员；系统: 套餐状态操作 | 套餐可选性与投放校验 |
| createdAt | Date \| Timestamp | ✓ | | 系统: 创建套餐时生成 | 审计与排序 |
| updatedAt | Date \| Timestamp | ✓ | | 系统: 套餐更新时生成 | 最后更新时间展示 |

---

## `guestRegistrations`
> 无专属 TS 接口（字段从 `services/eventsService.ts` registerGuestForEvent 方法推断） | **Constants key:** `COLLECTIONS.GUEST_REGISTRATIONS`

| 字段路径 | 类型 | 必填 | 枚举值 / 说明 | 来 | 往 |
|--------|------|:----:|------------|----|----|
| eventId | string | ✓ | | 系统: `events.id` / 访客报名表单 | 活动报名关联 |
| name | string | ✓ | | 访客报名表单 | 报名列表展示 |
| email | string | ✓ | | 访客报名表单 | 报名确认与通知 |
| phone | string | ✓ | | 访客报名表单 | 重复报名查询与联系访客 |
| registeredAt | Timestamp | ✓ | | 系统: 访客报名提交时间 | 报名排序与活动签到 |
| status | enum | ✓ | `Pending`（唯一已观察到的值；cancelGuestRegistration 会将其变更为 `Cancelled`） | 系统: 报名创建/取消流程 | 报名状态与活动容量 |
| organization | string | — | | 访客报名表单 | 报名列表展示 |
| notes | string | — | | 访客报名表单 | 活动人员备注 |
| _indexFor | string | — | 电话索引哨兵文档专用字段，值为 `'phone'`；查询时需过滤掉此类文档 | 系统: 电话索引流程 | 电话重复报名查询 |

---

## `guestPageStats`
> **TS Interface:** `GuestPageDailyStats`（定义于 `services/guestAnalyticsService.ts`） | **Constants key:** `COLLECTIONS.GUEST_PAGE_STATS`

文档 ID 格式：`{YYYY-MM-DD}_{page}`，每页每日一条聚合记录。

| 字段路径 | 类型 | 必填 | 枚举值 / 说明 | 来 | 往 |
|--------|------|:----:|------------|----|----|
| page | enum | ✓ | `home` \| `events` \| `projects` \| `about` \| `enewsletters` \| `partnerships` | 系统: 访客页面埋点 | 页面访问统计分组 |
| date | string | ✓ | 格式 `YYYY-MM-DD` | 系统: 统计日期生成 | 每日统计查询 |
| views | number | ✓ | 使用 Firestore increment 累加 | 系统: 页面浏览埋点 | 访客分析报表 |
| dwellSeconds | number | ✓ | 使用 Firestore increment 累加 | 系统: 页面停留埋点 | 访客分析报表 |
| signupClicks | number | ✓ | 使用 Firestore increment 累加 | 系统: 注册点击埋点 | 转化率统计 |

---

## `emailLogs`
> **TS Interface:** `EmailLog`（定义于 `types/misc.ts`） | **Constants key:** `COLLECTIONS.EMAIL_LOGS`

| 字段路径 | 类型 | 必填 | 枚举值 / 说明 | 来 | 往 |
|--------|------|:----:|------------|----|----|
| id | string | ✓ | Firestore doc ID | 系统: Firestore doc id | 邮件日志查询 |
| recipientEmail | string | ✓ | | 系统: 邮件发送目标 | 邮件投递记录 |
| recipientMemberId | string | — | | 系统: `members.id` 邮件目标 | 成员邮件历史 |
| emailType | enum | ✓ | `invitation` \| `birthday` \| `promotion` \| `announcement` \| `payment` \| `other` |
| sentAt | Date \| string | ✓ | | 系统: 邮件发送时间 | 邮件日志排序 |
| success | boolean | ✓ | | 系统: 邮件服务返回结果 | 发送状态与重试 |
| errorMessage | string | — | | 系统: 邮件服务错误 | 失败诊断 |
| triggeredBy | string | — | | 系统: 触发邮件的业务流程 | 邮件审计 |
| subject | string | — | | 系统: 邮件模板/发送参数 | 邮件日志展示 |

---

## `projects`
> **TS Interface:** `Project` | **Constants key:** `COLLECTIONS.PROJECTS`

| 字段路径 | 类型 | 必填 | 枚举值 / 说明 | 来 | 往 |
|--------|------|:----:|------------|----|----|
| id | string | ✓ | Firestore doc ID | 系统: Firestore doc id | 项目查询与集合关联 |
| status | enum | ✓ | `Draft` \| `Submitted` \| `Under Review` \| `Rejected` \| `Approved` \| `Planning` \| `Active` \| `Completed` \| `Review` \| `Upcoming` \| `Cancelled` | 角色: B+ / Board；系统: 项目创建、审核与状态操作 | 项目列表、任务/报告流程与权限 |
| title | string | — | | 角色: B+；系统: 项目表单，或由 `name` 回填 | `projectReports.projectName`、项目展示 |
| name | string | — | | 角色: B+；系统: 项目表单，或由 `title` 回填 | `projectReports.projectName` |
| description | string | — | | 角色: B+；系统: 项目表单 | 项目详情与报告上下文 |
| logoUrl | string | — | | 角色: B+；系统: 项目表单/媒体上传 | 项目展示 |
| roadmapUrl | string | — | | 角色: B+；系统: 项目表单/媒体上传 | 项目路线图展示 |
| galleryUrls | string[] | — | | 角色: B+；系统: 项目媒体上传 | 项目图库展示 |
| lead | string | — | | 角色: B+ / Board；系统: 项目表单 | 项目负责人展示 |
| organizerId | string \| null | — | | 系统: `createProject(currentUserId)` / 当前 `auth.uid` | 项目负责人识别与权限 |
| level | enum | — | `JCI` \| `National` \| `Area` \| `Local` |
| pillar | enum | — | `Individual` \| `Community` \| `Business` \| `International` \| `LOM` \| `Chapter` |
| category | string | — | |
| type | enum | — | `program` \| `skill_development` \| `event` \| `project` |
| date | string | — | |
| startDate | string | — | |
| endDate | string | — | |
| time | string | — | |
| proposedDate | string | — | |
| eventStartDate | string | — | |
| eventEndDate | string | — | |
| eventStartTime | string | — | |
| eventEndTime | string | — | |
| budget | number | — | |
| spent | number | — | |
| proposedBudget | number | — | |
| priceMin | number | — | |
| priceMax | number | — | |
| completion | number | — | | 系统: `tasks.status` 汇总 / `updateProjectCompletion()` | 项目进度与报告 |
| teamSize | number | — | |
| team | string[] | — | | 角色: B+ / Project Lead；系统: 项目表单 | 项目团队展示与权限 |
| financialAccountId | string | — | | 系统: `bankAccounts` / 项目财务配置 | 项目财务关联 |
| objectives | string | — | | 角色: B+；系统: 项目表单 | 项目详情与报告上下文 |
| expectedImpact | string | — | | 角色: B+；系统: 项目表单 | 项目报告与成果展示 |
| targetAudience | string | — | | 角色: B+；系统: 项目表单 | 活动/项目受众展示 |
| resources | string[] | — | | 角色: B+；系统: 项目表单 | 项目资源展示 |
| timeline | string | — | | 角色: B+；系统: 项目表单 | 项目进度展示 |
| submittedBy | string | — | | 系统: 当前 `auth.uid` | 项目审核审计 |
| submittedDate | string | — | | 系统: 项目提交操作 | 审核排序 |
| reviewedBy | string | — | | 系统: 审核人的 `auth.uid` | 审核审计 |
| reviewedDate | string | — | | 系统: 项目审核操作 | 审核历史展示 |
| reviewComments | string | — | | 角色: Board / Admin；系统: 审核表单 | 项目审核详情 |
| version | number | — | | 系统: 项目版本更新 | 版本展示与审计 |
| previousVersionId | string | — | | 系统: 项目版本创建 | 版本链追踪 |
| attachments | string[] | — | | 角色: B+；系统: 附件上传 | 项目资料展示 |
| attendees | number | — | |
| maxAttendees | number | — | |
| location | string | — | |
| predictedDemand | enum | — | `Low` \| `Medium` \| `High` |
| registeredMembers | string[] | — | |
| committee | ProjectCommitteeMember[] | — | 见子字段 |
| committee[].role | string | ✓ | |
| committee[].memberId | string | ✓ | |
| committee[].tasks | ProjectCommitteeTask[] | — | |
| committee[].tasks[].taskId | string | — | |
| committee[].tasks[].title | string | ✓ | |
| committee[].tasks[].dueDate | string | — | |
| trainers | ProjectTrainer[] | — | 见子字段 | 角色: Project Lead；系统: 项目表单 | 项目培训安排与展示 |
| trainers[].name | string | ✓ | |
| trainers[].memberId | string | — | |
| trainers[].role | string | — | |
| trainers[].durationHours | number | — | |
| createdAt | string | — | |
| updatedAt | string | — | |

---

## `projectReports`
> **TS Interface:** `ProjectReport` | **Constants key:** `COLLECTIONS.PROJECT_REPORTS`
>
> 注意：分析显示服务层无持久化写入（报告仅在内存生成后丢弃），`projectReports` 集合实际为空壳。`ProjectReport` 接口定义于 `services/projectReportService.ts`。

| 字段路径 | 类型 | 必填 | 枚举值 / 说明 | 来 | 往 |
|--------|------|:----:|------------|----|----|
| projectId | string | ✓ | | 系统: `projects.id` | 报告所属项目 |
| projectName | string | ✓ | | 系统: `projects.name`，回退 `projects.title` | 报告标题 |
| reportType | enum | ✓ | `status` \| `progress` \| `financial` \| `comprehensive` | 角色: Project Lead / Board；系统: 报告生成服务 | 报告模板与展示分支 |
| generatedAt | string | ✓ | | 系统: 报告生成时间 | 报告排序与审计 |
| period | object | ✓ | | 角色: 报告筛选；系统: 报告生成参数 | 报告时间范围 |
| period.start | string | ✓ | |
| period.end | string | ✓ | |
| executiveSummary | object | ✓ | | 系统: `projects`、`tasks`、财务数据汇总 | 项目报告摘要展示 |
| executiveSummary.status | string | ✓ | |
| executiveSummary.completionPercentage | number | ✓ | |
| executiveSummary.totalTasks | number | ✓ | |
| executiveSummary.completedTasks | number | ✓ | |
| executiveSummary.inProgressTasks | number | ✓ | |
| executiveSummary.pendingTasks | number | ✓ | |
| executiveSummary.budgetStatus | object | — | |
| executiveSummary.budgetStatus.allocated | number | ✓ | |
| executiveSummary.budgetStatus.spent | number | ✓ | |
| executiveSummary.budgetStatus.remaining | number | ✓ | |
| executiveSummary.budgetStatus.utilizationPercentage | number | ✓ | |
| teamPerformance | object | ✓ | | 系统: `tasks` 与项目团队数据汇总 | 团队绩效展示 |
| teamPerformance.totalMembers | number | ✓ | |
| teamPerformance.activeMembers | number | ✓ | |
| teamPerformance.memberContributions | array | ✓ | 见子字段 |
| teamPerformance.memberContributions[].memberId | string | ✓ | |
| teamPerformance.memberContributions[].memberName | string | ✓ | |
| teamPerformance.memberContributions[].tasksCompleted | number | ✓ | |
| teamPerformance.memberContributions[].tasksInProgress | number | ✓ | |
| teamPerformance.memberContributions[].contributionPercentage | number | ✓ | |
| timeline | object | ✓ | | 系统: `projects`、`tasks` 时间线汇总 | 项目时间线展示 |
| timeline.startDate | string | ✓ | |
| timeline.expectedEndDate | string | — | |
| timeline.actualProgress | number | ✓ | |
| timeline.milestones | array | ✓ | |
| timeline.milestones[].name | string | ✓ | |
| timeline.milestones[].targetDate | string | ✓ | |
| timeline.milestones[].status | enum | ✓ | `completed` \| `pending` \| `overdue` |
| timeline.upcomingDeadlines | array | ✓ | |
| timeline.upcomingDeadlines[].taskId | string | ✓ | |
| timeline.upcomingDeadlines[].taskName | string | ✓ | |
| timeline.upcomingDeadlines[].dueDate | string | ✓ | |
| timeline.upcomingDeadlines[].assignee | string | — | |
| timeline.upcomingDeadlines[].priority | string | ✓ | |
| financialSummary | object | — | | 系统: `transactions` / 项目预算汇总 | 项目财务报告 |
| financialSummary.budget | number | ✓ | |
| financialSummary.totalIncome | number | ✓ | |
| financialSummary.totalExpenses | number | ✓ | |
| financialSummary.currentBalance | number | ✓ | |
| financialSummary.budgetUtilization | number | ✓ | |
| financialSummary.categoryBreakdown | array | ✓ | |
| financialSummary.varianceAnalysis | object | ✓ | |
| risksAndIssues | array | ✓ | | 角色: Project Lead / Board；系统: 报告分析 | 风险与问题展示 |
| risksAndIssues[].type | enum | ✓ | `risk` \| `issue` |
| risksAndIssues[].description | string | ✓ | |
| risksAndIssues[].severity | enum | ✓ | `low` \| `medium` \| `high` |
| risksAndIssues[].mitigation | string | — | |
| recommendations | string[] | ✓ | | 系统: 报告分析；角色: Project Lead / Board | 报告建议展示 |
| nextSteps | string[] | ✓ | | 角色: Project Lead / Board；系统: 报告生成 | 后续行动展示 |

---

## `tasks`
> **TS Interface:** `Task` | **Constants key:** `COLLECTIONS.TASKS`

| 字段路径 | 类型 | 必填 | 枚举值 / 说明 | 来 | 往 |
|--------|------|:----:|------------|----|----|
| id | string | ✓ | Firestore doc ID | 系统: Firestore doc id | `projects.committee[].tasks[].taskId` |
| projectId | string | ✓ | | 系统: 当前 `projects.id` | 项目进度与报告 |
| projectTitle | string | — | | 系统: 从 `projects.name/title` 复制 | 任务列表展示 |
| role | string | — | | 系统: `projects.committee[].role` | 任务负责人角色展示 |
| committeeMemberId | string | — | | 系统: `projects.committee[].memberId` | 委员会任务关联 |
| committeeName | string | — | | 系统: 项目委员会配置 | 任务列表展示 |
| title | string | ✓ | | 角色: B+ / Assignee；系统: 任务表单 | 任务列表与项目报告 |
| status | enum | ✓ | `Todo` \| `In Progress` \| `Done` | 角色: B+ / Assignee；系统: 任务更新流程 | `projects.completion`、报告与积分条件 |
| priority | enum | ✓ | `High` \| `Medium` \| `Low` | 角色: Project Lead / Assignee；系统: 任务表单 | 任务排序与报告 |
| dueDate | string | ✓ | | 角色: Project Lead / Assignee；系统: 任务表单 | 截止提醒与报告 |
| startDate | string | — | | 角色: Project Lead / Assignee；系统: 任务表单 | 任务时间线 |
| duration | number | — | | 角色: Project Lead / Assignee；系统: 任务表单 | 工期计算与报告 |
| assignee | string | ✓ | | 系统: `members.id` / 任务分配操作 | 任务负责人及权限 |
| dependencies | string[] | — | | 角色: Project Lead；系统: 任务表单 | 任务执行顺序 |
| progress | number | — | | 系统: 任务状态/进度更新 | 项目完成度与报告 |
| remarks | map | — | 动态 key = remarkId；值为 `{content: string; timestamp: string}` | 角色: Assignee；系统: 任务备注操作 | 任务详情与审计 |
| statusHistory | map | — | 动态 key = historyId；值为 `{status: string; timestamp: string}` | 系统: 任务状态更新 | 状态审计与项目报告 |

---

## `contracts`
> **TS Interface:** `CommitmentContract` | **Constants key:** `COLLECTIONS.CONTRACTS`
>
> 接口定义于 `services/contractService.ts`。

| 字段路径 | 类型 | 必填 | 枚举值 / 说明 | 来 | 往 |
|--------|------|:----:|------------|----|----|
| id | string | — | Firestore doc ID（写入时可选） | 系统: Firestore doc id | 合约查询与积分流程 |
| memberId | string | ✓ | | 系统: 当前 `members.id` | 会员合约关联 |
| memberName | string | ✓ | | 系统: `members.general.name` 复制 | 合约展示 |
| goalTitle | string | ✓ | | 角色: 会员；系统: 合约表单 | 合约目标展示 |
| goalDescription | string | ✓ | | 角色: 会员；系统: 合约表单 | 合约详情与验证 |
| stakedPoints | number | ✓ | | 角色: 会员；系统: 合约创建 | `pointEscrow` 锁定积分 |
| multiplier | number | ✓ | 完成时奖励倍数 | 角色: 会员；系统: 合约表单 | 履约奖励计算 |
| deadline | Timestamp \| Date \| null | ✓ | | 角色: 会员；系统: 合约表单 | 到期检查与履约验证 |
| status | enum | ✓ | `Active` \| `Verifying` \| `Fulfilled` \| `Failed` \| `Expired` | 系统: 合约创建、验证与到期流程 | 合约状态展示与积分结算 |
| proofUrl | string | — | | 角色: 会员；系统: 证明上传 | 履约验证 |
| escrowId | string | — | 关联 pointEscrow 文档 ID | 系统: `pointEscrow.id` | 托管积分释放或扣除 |
| signerId | string | — | | 系统: 合约签署操作的 `auth.uid` | 合约审计 |
| failurePenalty | number | — | | 系统: 合约配置 | 失败扣分计算 |
| remainingSlots | number | — | | 系统: 合约额度/履约计算 | 可用名额展示 |
| verifiedBy | string | — | | 系统: 验证人的 `auth.uid` | 履约审计 |
| verifiedAt | Timestamp \| Date \| null | — | | 系统: 合约验证操作 | 验证时间展示 |
| createdAt | Timestamp \| Date \| null | ✓ | | 系统: 创建合约时生成 | 审计与排序 |
| updatedAt | Timestamp \| Date \| null | ✓ | | 系统: 合约更新时生成 | 最后更新时间展示 |

---

## `pointEscrow`
> **TS Interface:** 无专属接口（字段从 `services/pointsService.ts` 写入代码推断）| **Constants key:** `COLLECTIONS.POINT_ESCROW`

| 字段路径 | 类型 | 必填 | 枚举值 / 说明 | 来 | 往 |
|--------|------|:----:|------------|----|----|
| memberId | string | ✓ | | 系统: 合约签署的 `memberId` | 关联 `members` |
| amount | number | ✓ | 锁定积分数 | 角色: 会员签约；系统: `lockPointsForEscrow()` | `points` 锁定交易 |
| purpose | string | ✓ | 锁定用途描述 | 角色: 合约表单 | 合约详情 |
| relatedEntityId | string | — | 关联实体 ID（如 contractId） | 系统: `contracts.id` | `contracts.escrowId` |
| status | enum | ✓ | `Locked` \| `Released`（从 releaseEscrow 逻辑推断） | 系统: 锁定/释放流程 | 合约状态与积分余额 |
| description | string | ✓ | | 角色: 会员/系统合约流程 | 托管详情展示 |
| createdAt | Timestamp | ✓ | | 系统: 锁定积分时生成 | 托管排序与审计 |
| expiresAt | Timestamp | ✓ | 默认 90 天后 | 系统: 锁定流程按规则计算 | 到期释放检查 |

---

## `points`
> **TS Interface:** `PointTransaction` | **Constants key:** `COLLECTIONS.POINTS`
>
> 接口定义于 `services/pointsService.ts`。

| 字段路径 | 类型 | 必填 | 枚举值 / 说明 | 来 | 往 |
|--------|------|:----:|------------|----|----|
| id | string | — | Firestore doc ID（写入时可选） | 系统: Firestore doc id | 积分交易查询 |
| memberId | string | ✓ | | 系统: 积分发放/扣除流程 | 关联 `members.id`、会员积分汇总 |
| points | number | ✓ | 积分数量（兼容别名，等同 amount） | 系统: 由 `amount` 映射 | 积分历史 |
| amount | number | — | 首选字段名 | 系统: 事件、任务、交易、激励或徽章计算 | `members.jciCareer.points` |
| category | string | ✓ | 见 `POINT_CATEGORIES` 常量；特殊值 `Escrow_Locked` | 系统: 积分事件分类 | 积分统计与规则筛选 |
| description | string | ✓ | | 系统: 积分事件/交易说明 | 积分历史展示 |
| sourceId | string | — | 积分来源 ID（兼容字段，等同 relatedEntityId） | 系统: `relatedEntityId` 兼容映射 | 来源详情查询 |
| relatedEntityId | string | — | 首选字段名 | 系统: 事件/任务/激励等来源记录 ID | 来源详情 |
| sourceType | string | — | 积分来源类型（兼容字段，等同 relatedEntityType） | 系统: `relatedEntityType` 兼容映射 | 来源分类展示 |
| relatedEntityType | string | — | 首选字段名 | 系统: 积分发放流程 | 来源分类与统计 |
| createdAt | string \| Date \| Timestamp | ✓ | | 系统: 积分交易创建时间 | 积分历史排序 |
| expiresAt | Date \| Timestamp | — | | 系统: 积分规则/有效期计算 | 过期积分处理 |
| metadata | map | — | 任意附加数据 | 系统: 积分事件上下文 | 详情展示与审计 |
| awardedBy | string | — | 授权发放人 UID | 系统: 管理员/奖励流程的 `auth.uid` | 发放审计 |

---

## `pointsRules`
> **TS Interface:** `PointsRule`（高级规则引擎，`types/gamification.ts`）/ `PointRule`（简化规则，`services/pointsService.ts`）| **Constants key:** `COLLECTIONS.POINTS_RULES`
>
> 注：分析显示该集合存在两套并行接口，互不知晓。主要接口为 `PointsRule`。

### PointsRule（主接口）

| 字段路径 | 类型 | 必填 | 枚举值 / 说明 | 来 | 往 |
|--------|------|:----:|------------|----|----|
| id | string | ✓ | Firestore doc ID | 系统: Firestore doc id | `pointsRuleExecutions.ruleId` |
| name | string | ✓ | | 角色: A+；系统: 规则管理表单 | 执行记录与规则展示 |
| description | string | — | | 角色: A+；系统: 规则管理表单 | 规则详情 |
| trigger | enum | ✓ | `event_attendance` \| `task_completion` \| `project_completion` \| `training_completion` \| `recruitment` \| `custom` | 角色: A+；系统: 规则配置 | 规则触发匹配 |
| conditions | PointsRuleCondition[] | ✓ | 见子字段 | 角色: A+；系统: 规则配置 | 条件评估器 |
| conditions[].id | string | ✓ | | 角色: A+；系统: 规则配置 | 条件编辑与执行日志 |
| conditions[].field | string | ✓ | | 角色: A+；系统: 规则配置 | 条件评估器 |
| conditions[].operator | enum | ✓ | `equals` \| `not_equals` \| `greater_than` \| `less_than` \| `contains` \| `not_contains` \| `in` \| `not_in` |
| conditions[].value | any | ✓ | | 角色: A+；系统: 规则配置 | 条件评估器 |
| conditions[].logicalOperator | enum | — | `AND` \| `OR` | 角色: A+；系统: 规则配置 | 条件组合 |
| pointValue | number | ✓ | | 角色: A+；系统: 规则配置 | 最终积分计算 |
| multiplier | number | ✓ | | 角色: A+；系统: 规则配置 | 最终积分计算 |
| weight | number | ✓ | | 角色: A+；系统: 规则配置 | 最终积分计算 |
| enabled | boolean | ✓ | | 角色: A+；系统: 启用/停用操作 | 执行前规则筛选 |
| isRepeatable | boolean | — | true 时同一会员可多次触发 | 角色: A+；系统: 规则配置 | 重复触发校验 |
| createdAt | string | — | |
| updatedAt | string | — | |
| createdBy | string | — | |

### PointRule（简化接口，同集合）

| 字段路径 | 类型 | 必填 | 枚举值 / 说明 | 来 | 往 |
|--------|------|:----:|------------|----|----|
| id | string | — | Firestore doc ID |
| category | string | ✓ | |
| name | string | ✓ | | 角色: A+；系统: 规则配置 | 规则展示与执行 |
| basePoints | number | ✓ | | 角色: A+；系统: 规则配置 | 基础积分计算 |
| multiplier | number | — | | 角色: A+；系统: 规则配置 | 最终积分计算 |
| conditions | map | — | 附加条件 | 角色: A+；系统: 规则配置 | 条件评估 |
| active | boolean | ✓ | | 角色: A+；系统: 启用/停用操作 | 执行前规则筛选 |
| priority | number | — | | 角色: A+；系统: 规则配置 | 规则执行顺序 |
| createdAt | string \| Date \| Timestamp | — | | 系统: 规则创建时间 | 审计与排序 |
| updatedAt | string \| Date \| Timestamp | — | |

---

## `pointsRuleExecutions`
> **TS Interface:** `PointsRuleExecution` | **Constants key:** `COLLECTIONS.POINTS_RULE_EXECUTIONS`

| 字段路径 | 类型 | 必填 | 枚举值 / 说明 | 来 | 往 |
|--------|------|:----:|------------|----|----|
| id | string | ✓ | Firestore doc ID | 系统: Firestore doc id | 执行记录查询 |
| ruleId | string | ✓ | | 系统: `pointsRules.id` | 规则执行关联 |
| ruleName | string | ✓ | | 系统: `pointsRules.name` | 执行记录展示 |
| memberId | string | ✓ | | 系统: 触发事件的 `memberId` | 关联 `members.id` |
| trigger | string | ✓ | | 系统: 规则触发事件类型 | 执行统计 |
| triggerData | map | ✓ | 触发时的上下文数据 | 系统: 规则触发事件上下文 | 条件评估与执行审计 |
| pointsAwarded | number | ✓ | | 系统: `calculation.finalPoints` | `points.amount` |
| calculation | PointsCalculationBreakdown | ✓ | 见子字段 | 系统: 规则计算器 | 积分发放审计 |
| calculation.basePoints | number | ✓ | | 系统: `pointsRules.pointValue/basePoints` | 最终积分计算 |
| calculation.multiplier | number | ✓ | | 系统: `pointsRules.multiplier` | 最终积分计算 |
| calculation.weight | number | ✓ | | 系统: `pointsRules.weight` | 最终积分计算 |
| calculation.finalPoints | number | ✓ | | 系统: 规则计算器 | `points.amount` |
| calculation.appliedRules | array | ✓ | | 系统: 匹配规则计算 | 执行明细展示 |
| calculation.appliedRules[].ruleId | string | ✓ | | 系统: `pointsRules.id` | 执行明细关联 |
| calculation.appliedRules[].ruleName | string | ✓ | | 系统: `pointsRules.name` | 执行明细展示 |
| calculation.appliedRules[].points | number | ✓ | | 系统: 规则计算器 | 积分明细展示 |
| calculation.appliedRules[].weight | number | ✓ | | 系统: 规则计算器 | 积分明细展示 |
| executedAt | string | ✓ | | 系统: `executeRules()` | 执行历史排序 |
| loId | string | — | 跨 LO 隔离查询 | 系统: `members.loId` / 触发上下文 | 跨 LO 查询隔离 |

---

## `badges`
> **TS Interface:** `AwardDefinition`（别名 `BadgeDefinition`）| **Constants key:** `COLLECTIONS.BADGES`

| 字段路径 | 类型 | 必填 | 枚举值 / 说明 | 来 | 往 |
|--------|------|:----:|------------|----|----|
| id | string | — | Firestore doc ID | 系统: Firestore doc id | `badgeAwards.awardId` |
| name | string | ✓ | | 角色: A+；系统: 徽章管理表单 | 徽章展示 |
| description | string | ✓ | | 角色: A+；系统: 徽章管理表单 | 徽章详情 |
| icon | string | ✓ | | 角色: A+；系统: 徽章管理表单 | 徽章展示 |
| category | enum | ✓ | `Event` \| `Project` \| `Leadership` \| `Training` \| `Recruitment` \| `Social` \| `Milestone` \| `Special` | 角色: A+；系统: 徽章配置 | 徽章分类筛选 |
| tier | enum | ✓ | `Bronze` \| `Silver` \| `Gold` \| `Platinum` \| `Legendary` | 角色: A+；系统: 徽章配置 | 徽章等级展示 |
| rarity | enum | ✓ | `Common` \| `Rare` \| `Epic` \| `Legendary` | 角色: A+；系统: 徽章配置 | 徽章稀有度展示 |
| pointsReward | number | ✓ | | 角色: A+；系统: 徽章配置 | `points.amount` |
| criteria | AwardCriteria | ✓ | 见子字段 | 角色: A+；系统: 徽章条件配置 | 徽章达成判断 |
| criteria.type | enum | ✓ | `points_threshold` \| `event_count` \| `project_count` \| `consecutive_attendance` \| `role_held` \| `training_completed` \| `recruitment_count` \| `custom` \| `event_attendance` \| `project_completion` | 角色: A+；系统: 徽章条件配置 | 达成条件评估 |
| criteria.value | number | ✓ | | 角色: A+；系统: 徽章条件配置 | 达成条件评估 |
| criteria.timeframe | enum | — | `lifetime` \| `monthly` \| `quarterly` \| `yearly` | 角色: A+；系统: 徽章条件配置 | 时间范围评估 |
| criteria.conditions | map | — | | 角色: A+；系统: 徽章条件配置 | 自定义条件评估 |
| criteria.description | string | — | | 角色: A+；系统: 徽章条件配置 | 徽章详情展示 |
| milestones | AwardMilestone[] | — | | 角色: A+；系统: 徽章配置 | 徽章里程碑展示 |
| milestones[].level | string | ✓ | | 系统: 徽章里程碑配置 | 里程碑展示 |
| milestones[].threshold | number | ✓ | | 系统: 徽章里程碑配置 | 达成判断 |
| milestones[].pointValue | number | ✓ | | 系统: 徽章里程碑配置 | 积分奖励计算 |
| milestones[].reward | string | — | | 系统: 徽章里程碑配置 | 奖励展示 |
| active | boolean | ✓ | | 角色: A+；系统: 启用/停用操作 | 徽章达成筛选 |
| createdAt | string \| Timestamp \| Date | — | | 系统: 徽章创建时间 | 审计与排序 |
| updatedAt | string \| Timestamp \| Date | — | | 系统: 徽章更新时间 | 缓存与审计 |

---

## `badgeAwards`
> **TS Interface:** `MemberAward`（别名 `BadgeAward`）| **Constants key:** `COLLECTIONS.BADGE_AWARDS`

| 字段路径 | 类型 | 必填 | 枚举值 / 说明 | 来 | 往 |
|--------|------|:----:|------------|----|----|
| id | string | — | Firestore doc ID | 系统: `${memberId}_${awardId}` | 唯一授予记录 |
| awardId | string | ✓ | 关联 badges 文档 ID | 系统: `badges.id` | 徽章详情查询 |
| memberId | string | ✓ | | 系统: 徽章授予流程 | 关联 `members.id`、会员徽章列表 |
| earnedAt | string \| Timestamp \| Date | ✓ | | 系统: 达成条件时生成 | 徽章历史 |
| progress | number | — | |
| completedMilestones | string[] | — | |
| awardedBy | string | — | |
| reason | string | — | | 系统: 成就达成流程；角色: 管理员说明 | 进度详情与审计 |
| metadata | map | — | | 系统: 成就计算上下文 | 详情展示与审计 |

---

## `achievements`
> **TS Interface:** `AwardDefinition`（别名 `Achievement`）| **Constants key:** `COLLECTIONS.ACHIEVEMENTS`
>
> 接口与 `badges` 集合完全相同（`AwardDefinition` 是两者的共用接口，`Achievement = AwardDefinition` 为类型别名）。

| 字段路径 | 类型 | 必填 | 枚举值 / 说明 | 来 | 往 |
|--------|------|:----:|------------|----|----|
| id | string | — | Firestore doc ID | 系统: Firestore doc id | `achievementAwards.awardId`、`achievementProgress.awardId` |
| name | string | ✓ | | 角色: A+；系统: 成就管理表单 | 成就展示 |
| description | string | ✓ | | 角色: A+；系统: 成就管理表单 | 成就详情 |
| icon | string | ✓ | | 角色: A+；系统: 成就管理表单 | 成就展示 |
| category | enum | ✓ | `Event` \| `Project` \| `Leadership` \| `Training` \| `Recruitment` \| `Social` \| `Milestone` \| `Special` | 角色: A+；系统: 成就配置 | 成就分类筛选 |
| tier | enum | ✓ | `Bronze` \| `Silver` \| `Gold` \| `Platinum` \| `Legendary` | 角色: A+；系统: 成就配置 | 成就等级展示 |
| rarity | enum | ✓ | `Common` \| `Rare` \| `Epic` \| `Legendary` | 角色: A+；系统: 成就配置 | 成就稀有度展示 |
| pointsReward | number | ✓ | | 角色: A+；系统: 成就配置 | `points.amount` |
| criteria | AwardCriteria | ✓ | 同 badges 集合 criteria 结构 | 角色: A+；系统: 成就条件配置 | 成就达成与进度计算 |
| milestones | AwardMilestone[] | — | | 角色: A+；系统: 成就配置 | 成就里程碑展示与达成判断 |
| active | boolean | ✓ | | 角色: A+；系统: 启用/停用操作 | 成就达成筛选 |
| createdAt | string \| Timestamp \| Date | — | | 系统: 成就创建时间 | 审计与排序 |
| updatedAt | string \| Timestamp \| Date | — | | 系统: 成就更新时间 | 缓存与审计 |

---

## `achievementAwards`
> **TS Interface:** `MemberAward`（别名 `AchievementAward`）| **Constants key:** `COLLECTIONS.ACHIEVEMENT_AWARDS`
>
> 接口与 `badgeAwards` 集合完全相同（`AchievementAward = MemberAward` 为类型别名）。

| 字段路径 | 类型 | 必填 | 枚举值 / 说明 | 来 | 往 |
|--------|------|:----:|------------|----|----|
| id | string | — | Firestore doc ID | 系统: `${memberId}_${awardId}` | 唯一授予记录 |
| awardId | string | ✓ | 关联 achievements 文档 ID | 系统: `achievements.id` | 成就详情查询 |
| memberId | string | ✓ | | 系统: 成就授予流程 | 关联 `members.id` |
| earnedAt | string \| Timestamp \| Date | ✓ | | 系统: 达成条件时生成 | 成就历史 |
| progress | number | — | | 系统: 成就条件评估 | 成就进度展示 |
| completedMilestones | string[] | — | | 系统: 成就里程碑评估 | 成就详情与奖励判断 |
| awardedBy | string | — | | 系统: 自动达成或管理员授予人的 `auth.uid` | 授予审计 |
| reason | string | — | | 系统: 成就达成流程；角色: 管理员授予说明 | 授予记录详情 |
| metadata | map | — | | 系统: 成就计算上下文 | 详情展示与审计 |

---

## `achievementProgress`
> **TS Interface:** `MemberAward`（别名 `MemberAchievementProgress`）| **Constants key:** `COLLECTIONS.ACHIEVEMENT_PROGRESS`
>
> 与 `achievementAwards` 使用同一接口 `MemberAward`；语义上表示进行中的进度快照，而非已完成颁发记录。

| 字段路径 | 类型 | 必填 | 枚举值 / 说明 | 来 | 往 |
|--------|------|:----:|------------|----|----|
| id | string | — | Firestore doc ID | 系统: `${memberId}_${awardId}` | 唯一进度记录 |
| awardId | string | ✓ | 关联 achievements 文档 ID | 系统: `achievements.id` | 成就条件查询 |
| memberId | string | ✓ | | 系统: 当前会员 `members.id` | 成员成就进度查询 |
| earnedAt | string \| Timestamp \| Date | ✓ | | 系统: 成就进度记录创建/完成时间 | 成就历史与完成状态 |
| progress | number | — | 当前进度值（0–100 或原始计数） | 系统: 成就条件与会员数据计算 | 成就进度 UI |
| completedMilestones | string[] | — | | 系统: 成就里程碑评估 | 成就进度与奖励判断 |
| awardedBy | string | — | | 系统: 自动达成或管理员授予人的 `auth.uid` | 授予审计 |
| reason | string | — | | 系统: 成就达成流程；角色: 管理员说明 | 进度详情与审计 |
| metadata | map | — | | 系统: 成就计算上下文 | 详情展示与审计 |

---

## `incentivePrograms`
> **TS Interface:** `IncentiveProgram` | **Constants key:** `COLLECTIONS.INCENTIVE_PROGRAMS`

| 字段路径 | 类型 | 必填 | 枚举值 / 说明 | 来 | 往 |
|--------|------|:----:|------------|----|----|
| id | string | ✓ | Firestore doc ID | 系统: Firestore doc id | `incentiveStandards.programId` |
| year | number | ✓ | | 角色: B+ / A+；系统: 激励计划表单 | 年度进度查询 |
| name | string | ✓ | | 角色: B+ / A+；系统: 计划管理表单 | 计划展示 |
| isActive | boolean | ✓ | | 角色: B+ / A+；系统: 年度计划启停 | 当前计划筛选 |
| categories | map | ✓ | 动态 key = 类别名；值为 `{label: string; minScore: number; isFundamental?: boolean}` | 角色: B+ / A+；系统: 计划配置 | 类别分数与星级计算 |
| specialAwards | array | ✓ | | 角色: B+ / A+；系统: 计划配置 | 特别奖项评估与展示 |
| specialAwards[].name | string | ✓ | | 系统: `incentivePrograms` 计划配置 | 特别奖项展示 |
| specialAwards[].criteria | string[] | ✓ | | 系统: `incentivePrograms` 计划配置 | 特别奖项规则 |

---

## `incentiveStandards`
> **TS Interface:** `IncentiveStandard` | **Constants key:** `COLLECTIONS.INCENTIVE_STANDARDS`

| 字段路径 | 类型 | 必填 | 枚举值 / 说明 | 来 | 往 |
|--------|------|:----:|------------|----|----|
| id | string | ✓ | Firestore doc ID | 系统: Firestore doc id | 标准查询 |
| programId | string | ✓ | 关联 incentivePrograms 文档 ID | 系统: `incentivePrograms.id` | 计划标准查询 |
| category | string | ✓ | | 系统: `incentivePrograms.categories` / 标准配置 | 标准分类 |
| order | number | ✓ | | 角色: B+ / A+；系统: 标准配置 | 标准排序 |
| title | string | ✓ | | 角色: B+ / A+；系统: 标准配置 | 标准展示 |
| remarks | string | — | | 角色: B+ / A+；系统: 标准配置 | 标准详情展示 |
| targetType | enum | ✓ | `LO` \| `MEMBER` | 角色: B+ / A+；系统: 标准配置 | 目标范围与审核路由 |
| pointCap | number | — | | 角色: B+ / A+；系统: 标准配置 | 积分上限校验 |
| verificationType | enum | ✓ | `AUTO_SYSTEM` \| `MANUAL_UPLOAD` \| `HYBRID` | 系统: 标准配置 | 自动/手动审核分支 |
| autoTriggerEvent | string | — | | 系统: 标准配置 | 自动提交触发匹配 |
| autoLogicId | enum | — | 见 `IncentiveLogicId` enum（10 个值） | 系统: 标准配置 | 激励计算逻辑 |
| logicParams | map | — | | 系统: 标准配置 | `incentiveCalculatorService` |
| evidenceRequirements | string[] | — | | 系统: 标准配置 | 提交证据校验 |
| milestones | IncentiveMilestone[] | — | 见子字段 | 角色: B+ / A+；系统: 标准配置 | 阶段达成与积分计算 |
| milestones[].id | string | ✓ | | 系统: 标准配置 | 阶段记录关联 |
| milestones[].label | string | ✓ | | 系统: 标准配置 | 阶段展示 |
| milestones[].points | number | ✓ | | 系统: 标准配置 | 积分奖励计算 |
| milestones[].deadline | string | — | | 系统: 标准配置 | 截止检查 |
| milestones[].logicThreshold | number | — | | 系统: 标准配置 | 达成条件计算 |
| milestones[].activityType | string | — | | 系统: 标准配置 | 活动类型匹配 |
| milestones[].minParticipants | number | — | | 系统: 标准配置 | 参与人数条件 |
| isTiered | boolean | — | | 系统: 标准配置 | 阶梯激励计算 |

---

## `incentiveSubmissions`
> **TS Interface:** `IncentiveSubmission` | **Constants key:** `COLLECTIONS.INCENTIVE_SUBMISSIONS`

| 字段路径 | 类型 | 必填 | 枚举值 / 说明 | 来 | 往 |
|--------|------|:----:|------------|----|----|
| id | string | ✓ | Firestore doc ID | 系统: Firestore doc id | 积分发放和进度计算 |
| standardId | string | ✓ | 关联 incentiveStandards 文档 ID | 系统: `incentiveStandards.id` | 标准详情查询 |
| milestoneId | string | — | | 系统: `incentiveStandards.milestones[].id` | 里程碑匹配 |
| loId | string | ✓ | | 系统: `members.loId` / LO 上下文 | `loStarProgress.loId` |
| memberId | string | — | | 系统: `members.id`；LO 级提交可为空 | 会员提交记录 |
| status | enum | ✓ | `DRAFT` \| `PENDING` \| `APPROVED` \| `REJECTED` | 角色: B+ / A+；系统: 提交/审批流程 | 得分与进度计算 |
| evidenceFiles | string[] | ✓ | | 角色: B+；系统: Storage 上传结果 | 证据预览与审核 |
| evidenceText | string | — | | 角色: B+ | 审核详情 |
| quantity | number | ✓ | | 角色: B+；系统: 自动逻辑计算 | 得分计算 |
| submittedAt | string | ✓ | | 系统: 提交时间 | 提交排序与审计 |
| scoreAwarded | number | ✓ | | 系统: 审核/计算结果 | `points.amount`、`loStarProgress.categories` |
| approvedBy | string | — | | 系统: 审核人的 `auth.uid` | 审核审计 |
| rejectionReason | string | — | | 角色: B+ / A+；系统: 拒绝流程 | 拒绝通知与详情 |

---

## `loStarProgress`
> **TS Interface:** `LOStarProgress` | **Constants key:** `COLLECTIONS.LO_STAR_PROGRESS`

| 字段路径 | 类型 | 必填 | 枚举值 / 说明 | 来 | 往 |
|--------|------|:----:|------------|----|----|
| loId | string | ✓ | Firestore doc ID（兼作字段） | 系统: `incentiveSubmissions.loId` / LO 上下文 | LO 进度查询 |
| year | number | ✓ | | 系统: `incentivePrograms.year` / 当前年度 | 年度进度查询 |
| categories | map | ✓ | 动态 key = 类别名；值为 `{current: number; total: number; stars: number}` | 系统: `incentiveSubmissions.scoreAwarded` + 计划类别 | LO Star 仪表板 |
| details | map | ✓ | 动态 key = 详情项；值为 `boolean \| number` | 系统: 已批准提交和标准逻辑 | LO Star 详情 |
| totalPoints | number | ✓ | | 系统: 各类别分数汇总 | 总分展示 |
| starsUnlocked | number | ✓ | | 系统: 类别星级汇总 | LO Star 仪表板 |
| lastUpdated | string | ✓ | | 系统: 计算/持久化快照时间 | 快照排序与缓存 |

---

## `workflows`
> **TS Interface:** `Workflow` | **Constants key:** `COLLECTIONS.WORKFLOWS`

| 字段路径 | 类型 | 必填 | 枚举值 / 说明 | 来 | 往 |
|--------|------|:----:|------------|----|----|
| id | string | ✓ | Firestore doc ID | 系统: Firestore doc id | `workflow_executions.workflowId` |
| name | string | ✓ | | Automation Studio 流程表单 | 执行记录 `workflowName` |
| description | string | — | | 流程创建/编辑表单 | 流程详情展示 |
| nodes | WorkflowNode[] | ✓ | 见子字段 | Workflow Designer 节点配置 | `executeWorkflow()` 执行步骤 |
| nodes[].id | string | ✓ | | 系统: Workflow Designer 节点配置 | 节点执行与日志关联 |
| nodes[].type | enum | ✓ | `trigger` \| `action` \| `condition` \| `delay` \| `email` \| `notification` \| `data_update` \| `task_create` \| `webhook` \| `approval` \| `loop` \| `end` |
| nodes[].position | object | ✓ | `{x: number; y: number}` | 系统: Workflow Designer 画布 | 流程编辑器布局 |
| nodes[].data | WorkflowNodeData | ✓ | label、description、category、icon、configSchema 等 | 系统: 节点类型配置 | 节点渲染与执行配置 |
| nodes[].connections | WorkflowConnection[] | ✓ | 见子字段 | 系统: Workflow Designer 连线配置 | 节点执行顺序 |
| nodes[].status | enum | — | `idle` \| `running` \| `completed` \| `error` |
| nodes[].config | map | — | | 系统: 节点配置表单 | 节点执行参数 |
| connections | WorkflowConnection[] | ✓ | 见子字段 | Workflow Designer 连线配置 | 节点执行顺序 |
| connections[].id | string | ✓ | | 系统: Workflow Designer 连线配置 | 连线查询与执行图构建 |
| connections[].sourceNodeId | string | ✓ | | 系统: Workflow Designer 连线配置 | 来源节点定位 |
| connections[].targetNodeId | string | ✓ | | 系统: Workflow Designer 连线配置 | 目标节点定位 |
| connections[].sourceHandle | string | — | | 系统: Workflow Designer 连线配置 | 分支出口选择 |
| connections[].targetHandle | string | — | | 系统: Workflow Designer 连线配置 | 节点入口选择 |
| connections[].condition | WorkflowCondition | — | | 系统: 流程条件配置 | 条件分支执行 |
| triggers | WorkflowTrigger[] | ✓ | 见子字段 | Workflow Designer 触发器配置 | 手动、事件、排程、Webhook 入口 |
| triggers[].id | string | ✓ | | 系统: 触发器配置 | 触发器定位与日志 |
| triggers[].type | enum | ✓ | `manual` \| `schedule` \| `event` \| `webhook` \| `data_change` |
| triggers[].config | map | ✓ | | 角色: 流程管理员；系统: 触发器配置表单 | 触发条件匹配 |
| triggers[].enabled | boolean | ✓ | | 角色: 流程管理员；系统: 触发器启停 | 触发前启用检查 |
| status | enum | ✓ | `draft` \| `active` \| `paused` \| `archived` | 流程创建/编辑操作 | 执行前 active 状态检查 |
| version | number | ✓ | | 系统: 流程保存/发布 | 执行版本与审计 |
| createdBy | string | ✓ | | 系统: 创建人的 `auth.uid` | 权限与审计 |
| createdAt | string | ✓ | | 系统: 创建流程时生成 | 审计与排序 |
| updatedAt | string | ✓ | | 系统: 更新流程时生成 | 缓存与审计 |
| lastExecuted | string | — | | 系统: `executeWorkflow()` | 流程统计展示 |
| executionCount | number | ✓ | | 系统: 流程执行计数 | 流程统计展示 |
| tags | string[] | — | | 角色: 流程管理员；系统: 流程表单 | 流程筛选与分类 |

---

## `automationRules`
> **TS Interface:** `AutomationRule` | **Constants key:** `COLLECTIONS.AUTOMATION_RULES`

| 字段路径 | 类型 | 必填 | 枚举值 / 说明 | 来 | 往 |
|--------|------|:----:|------------|----|----|
| id | string | ✓ | Firestore doc ID | 系统: Firestore doc id | 规则执行查询 |
| name | string | ✓ | | Automation Studio 规则表单 | 规则列表 |
| trigger | string | ✓ | 触发事件名称 | 规则配置表单 | `evaluateAutomationRules()` |
| action | string | ✓ | 动作名称 | 规则配置表单 | 规则执行器 |
| active | boolean | ✓ | | 规则启用/停用操作 | 执行前启用检查 |
| executions | number | ✓ | 执行次数计数 | 系统: 规则执行计数 | 规则统计展示 |
| conditions | RuleCondition[] | — | 见子字段 | 角色: 规则管理员；系统: 规则配置表单 | 条件评估器 |
| conditions[].id | string | ✓ | | 系统: 规则配置 | 条件定位与审计 |
| conditions[].field | string | ✓ | | 角色: 规则管理员；系统: 规则配置 | 条件评估器 |
| conditions[].operator | enum | ✓ | `equals` \| `not_equals` \| `greater_than` \| `less_than` \| `greater_equal` \| `less_equal` \| `contains` \| `not_contains` \| `starts_with` \| `ends_with` \| `exists` \| `not_exists` \| `in` \| `not_in` |
| conditions[].value | any | ✓ | | 角色: 规则管理员；系统: 规则配置 | 条件评估器 |
| conditions[].dataType | enum | — | `string` \| `number` \| `boolean` \| `date` \| `array` \| `object` |
| conditions[].logicalOperator | enum | — | `AND` \| `OR` | 角色: 规则管理员；系统: 规则配置 | 条件组合 |
| actions | RuleAction[] | — | 见子字段 | 角色: 规则管理员；系统: 规则配置表单 | 规则执行器 |
| actions[].id | string | ✓ | | 系统: 规则配置 | 动作定位与审计 |
| actions[].type | enum | ✓ | `send_email` \| `send_notification` \| `update_field` \| `update_member` \| `create_task` \| `award_points` \| `award_badge` \| `trigger_workflow` \| `webhook` \| `send_webhook` \| `log_event` |
| actions[].config | map | ✓ | | 角色: 规则管理员；系统: 规则配置 | 动作执行参数 |
| actions[].enabled | boolean | — | | 角色: 规则管理员；系统: 动作启停 | 执行前动作筛选 |
| actions[].order | number | — | | 系统: 规则配置 | 动作执行顺序 |
| logicalOperator | enum | — | `AND` \| `OR` | 角色: 规则管理员；系统: 规则配置 | 条件组合 |

---

## `workflow_executions`
> **TS Interface:** `WorkflowExecution` | **Constants key:** `COLLECTIONS.WORKFLOW_EXECUTIONS`

| 字段路径 | 类型 | 必填 | 枚举值 / 说明 | 来 | 往 |
|--------|------|:----:|------------|----|----|
| id | string | — | Firestore doc ID | 系统: Firestore doc id | 执行日志查询 |
| workflowId | string | ✓ | | 系统: `workflows.id` | 指定流程执行记录 |
| workflowName | string | ✓ | | 系统: `workflows.name` | 执行日志展示 |
| status | enum | ✓ | `success` \| `failed` \| `running` \| `cancelled` | 系统: `executeWorkflow()` 执行结果 | 执行日志与失败统计 |
| startedAt | string | ✓ | | 系统: `executeWorkflow()` 开始时间 | 执行耗时与日志展示 |
| completedAt | string | — | | 系统: 工作流完成/失败时间 | 执行耗时与日志展示 |
| duration | number | — | 毫秒 | 系统: 开始与完成时间计算 | 执行性能统计 |
| triggeredBy | enum | ✓ | `manual` \| `event` \| `schedule` \| `webhook` \| `condition` | 系统: 触发器上下文 | 执行统计与审计 |
| triggerData | map | — | | 系统: 触发器上下文 | 条件评估与审计 |
| nodeExecutions | WorkflowNodeExecution[] | ✓ | 见子字段 |
| nodeExecutions[].id | string | — | |
| nodeExecutions[].nodeId | string | ✓ | |
| nodeExecutions[].nodeType | string | ✓ | |
| nodeExecutions[].status | enum | ✓ | `success` \| `failed` \| `running` \| `pending` \| `skipped` \| `completed` |
| nodeExecutions[].startedAt | string | — | |
| nodeExecutions[].completedAt | string | — | |
| nodeExecutions[].input | map | — | |
| nodeExecutions[].output | map | — | |
| nodeExecutions[].error | string | — | |
| nodeExecutions[].duration | number | — | |
| executedSteps | WorkflowExecutionStep[] | ✓ | 见子字段 |
| executedSteps[].stepId | string | ✓ | |
| executedSteps[].stepType | string | ✓ | |
| executedSteps[].stepOrder | number | ✓ | |
| executedSteps[].status | enum | ✓ | `pending` \| `running` \| `completed` \| `success` \| `failed` \| `skipped` |
| executedSteps[].startedAt | string | — | |
| executedSteps[].completedAt | string | — | |
| executedSteps[].duration | number | — | |
| executedSteps[].error | string | — | |
| executedSteps[].output | map | — | |
| error | object | — | | 系统: 工作流运行时错误 | 失败详情展示与重试 |
| error.message | string | ✓ | | 系统: 错误处理器 | 失败详情展示 |
| error.stepId | string | — | | 系统: 步骤执行器 | 失败步骤定位 |
| error.stepType | string | — | | 系统: 步骤执行器 | 失败类型展示 |
| error.stack | string | — | | 系统: 错误处理器 | 错误诊断 |
| context | map | — | | 系统: 工作流执行上下文 | 调试与审计 |
| createdAt | string | — | |

---

## `notifications`
> **TS Interface:** `Notification` | **Constants key:** `COLLECTIONS.NOTIFICATIONS`

| 字段路径 | 类型 | 必填 | 枚举值 / 说明 | 来 | 往 |
|--------|------|:----:|------------|----|----|
| id | string | ✓ | Firestore doc ID | 系统: Firestore doc id | 通知查询 |
| memberId | string | ✓ | | 系统: 通知流程传入目标 `members.id` | 会员通知列表 |
| title | string | ✓ | | 会费、晋升、活动、生日或自动化流程 | Notification Drawer |
| message | string | ✓ | | 对应业务流程生成 | Notification Drawer |
| type | enum | ✓ | `info` \| `success` \| `warning` \| `error` \| `ai` \| `dues_reminder` \| `event_reminder` \| `payment_request_cancelled` \| `payment_request_submitted` \| `payment_request_updated` \| `event_registration_cancelled` |
| read | boolean | ✓ | | 系统: 创建时 false；`markNotificationRead()` 更新 | 已读/未读显示 |
| timestamp | string | ✓ | | 系统: 通知创建时间 | 通知排序 |
| readAt | string | — | | 系统: `markNotificationRead()` | 已读时间展示 |
| isDismissible | boolean | — | |

---

## `errorLogs`
> **TS Interface:** `ErrorLogEntry` | **Constants key:** `COLLECTIONS.ERROR_LOGS`
>
> 接口定义于 `services/errorLoggingService.ts`。

| 字段路径 | 类型 | 必填 | 枚举值 / 说明 | 来 | 往 |
|--------|------|:----:|------------|----|----|
| id | string | ✓ | Firestore doc ID | 系统: Firestore doc id | 错误日志查询 |
| timestamp | string | ✓ | | 系统: 错误捕获时间 | 错误日志排序 |
| message | string | ✓ | | 系统: 错误处理器 | 错误详情展示 |
| stack | string | — | | 系统: JavaScript 错误对象 | 错误诊断 |
| componentStack | string | — | React 组件堆栈 |
| url | string | ✓ | 发生错误时的页面 URL |
| userAgent | string | ✓ | | 系统: 浏览器运行时 | 错误诊断 |
| userId | string | — | | 系统: 当前登录 `auth.uid` | 用户范围错误查询 |
| sessionId | string | ✓ | |
| level | enum | ✓ | `error` \| `warning` \| `info` |
| context | map | — | 附加上下文数据 | 系统: 错误捕获上下文 | 错误诊断 |
| resolved | boolean | — | | 角色: Admin；系统: 错误处理操作 | 错误处理状态 |

---

## `systemLogs`
> **TS Interface:** 无专属导出接口（写入结构由 `services/firestoreLogger.ts` 的 `flush()` 函数定义）| **Constants key:** `COLLECTIONS.SYSTEM_LOGS`
>
> 每条文档为一次缓冲批次（3 秒窗口内所有 Firestore 操作聚合后写入一条）。

| 字段路径 | 类型 | 必填 | 枚举值 / 说明 | 来 | 往 |
|--------|------|:----:|------------|----|----|
| flushedAt | Timestamp | ✓ | 批次刷写时间 | 系统: `firestoreLogger.flush()` | 系统日志排序与监控 |
| userId | string \| null | ✓ | 当前登录用户 UID | 系统: 当前登录 `auth.uid` | 用户范围日志查询 |
| windowMs | number | ✓ | 批次时间窗口（毫秒） | 系统: 日志缓冲配置 | 批次性能统计 |
| totalOps | number | ✓ | 批次内原始操作条数 | 系统: 缓冲操作计数 | 日志统计展示 |
| entries | array | ✓ | 按 (operation, source, caller) 聚合后的条目 | 系统: 日志聚合流程 | 操作统计与诊断 |
| entries[].operation | enum | ✓ | `READ` \| `WRITE` \| `DELETE` \| `LISTENER` \| `PERF` \| `ERROR` |
| entries[].source | string | ✓ | 操作的集合或资源名称 | 系统: Firestore 操作拦截器 | 来源集合统计 |
| entries[].caller | string | ✓ | 调用方标识（服务方法名） | 系统: 操作调用上下文 | 调用方诊断 |
| entries[].count | number | ✓ | 聚合次数 | 系统: 日志聚合流程 | 操作统计 |
| entries[].firstAt | Timestamp | ✓ | 批次内首次发生时间 | 系统: 操作记录时间 | 时间窗口展示 |
| entries[].lastAt | Timestamp | ✓ | 批次内末次发生时间 | 系统: 操作记录时间 | 时间窗口展示 |
| entries[].avgDurationMs | number | — | 仅 PERF 类型，平均耗时 | 系统: 性能日志聚合 | 性能监控 |
| entries[].maxDurationMs | number | — | 仅 PERF 类型，最大耗时 | 系统: 性能日志聚合 | 性能监控 |

---

## `auditLog`
> **TS Interface:** `AuditEntry`（`services/auditLogService.ts` 为写入接口；`types/misc.ts` 含扩展版本含 `id`、`timestamp`、`loId`）| **Constants key:** `COLLECTIONS.AUDIT_LOG`

| 字段路径 | 类型 | 必填 | 枚举值 / 说明 | 来 | 往 |
|--------|------|:----:|------------|----|----|
| id | string | — | Firestore doc ID（types/misc.ts 版本含此字段） | 系统: Firestore doc id | 审计记录查询 |
| action | string | ✓ | 操作名称；types/misc.ts 定义枚举 `CREATE` \| `UPDATE` \| `DELETE` \| `APPROVE` \| `REJECT` \| `RESTORE`，service 层允许任意字符串 | 系统: 业务操作记录 | 审计动作筛选 |
| performedBy | string | ✓ | 操作人 UID | 系统: 当前操作人的 `auth.uid` | 审计展示与权限追踪 |
| targetCollection | string | ✓ | 被操作的 Firestore 集合名 | 系统: 审计调用上下文 | 目标集合筛选 |
| targetId | string | ✓ | 被操作的文档 ID | 系统: 审计调用上下文 | 目标记录追踪 |
| before | map | — | 操作前快照 | 系统: 写入前文档读取 | 变更审计与回溯 |
| after | map | — | 操作后快照 | 系统: 写入后文档数据 | 变更审计与回溯 |
| metadata | map | — | 附加信息 | 系统: 审计上下文 | 审计详情展示 |
| timestamp | Date \| string | — | 写入时间（types/misc.ts 版本含此字段） |
| loId | string | — | LO 归属（types/misc.ts 版本含此字段） |

---

## `communication`
> **TS Interface:** `NewsPost` | **Constants key:** `COLLECTIONS.COMMUNICATION`

| 字段路径 | 类型 | 必填 | 枚举值 / 说明 | 来 | 往 |
|--------|------|:----:|------------|----|----|
| id | string | ✓ | Firestore doc ID | 系统: Firestore doc id | 通信流查询 |
| author | object | ✓ | | 角色: 发帖会员；系统: 通信发布表单 | 帖子作者展示 |
| author.id | string | — | 作者会员 ID（注：分析发现此字段从未写入，导致会员无法删除自己的帖子） | 系统: 预期来自当前 `members.id`，但现有写入代码未写入该字段 | 预期用于会员本人帖子权限；当前无法可靠使用 |
| author.name | string | ✓ | | 系统: 当前会员资料快照 | 帖子作者展示 |
| author.avatar | string | ✓ | | 系统: 当前会员头像快照 | 帖子作者头像展示 |
| author.role | string | ✓ | | 系统: 当前会员角色快照 | 作者角色展示与内容渲染 |
| content | string | ✓ | | 角色: 发帖会员；系统: 通信发布表单 | 通信内容展示 |
| timestamp | string | ✓ | | 系统: 发帖时间 | 通信流排序 |
| likes | number | ✓ | | 系统: 点赞操作 | 点赞数展示 |
| comments | number | ✓ | | 系统: 评论操作 | 评论数展示 |
| type | enum | ✓ | `Announcement` \| `Update` \| `Poll` | 角色: 发帖会员；系统: 通信发布表单 | 类型筛选与渲染 |
| image | string | — | | 角色: 发帖会员；系统: 媒体上传 | 帖子媒体展示 |

---
## `surveys`
> **TS Interface:** `Survey` (full version in `services/surveysService.ts`) | **Constants key:** `COLLECTIONS.SURVEYS`

| 字段路径 | 类型 | 必填 | 枚举值 / 说明 | 来 | 往 |
|--------|------|:----:|------------|----|----|
| id | string | ✓ | Firestore doc ID | 系统: Firestore doc id | `surveyResponses.surveyId`、调查链接 |
| title | string | ✓ | | 创建/编辑调查表单 | 调查列表、填写页 |
| description | string | ✓ | | 创建/编辑调查表单 | 调查详情、填写页 |
| questions | SurveyQuestion[] | ✓ | 见下方子字段 | 调查设计器 | 填写页、`surveyResponses.responses` |
| questions[].id | string | ✓ | | 系统: 调查设计器生成 | `surveyResponses.responses` 键 |
| questions[].type | enum | ✓ | `text` \| `multiple-choice` \| `rating` \| `yes-no` \| `date` \| `number` \| `email` \| `phone` \| `matrix` \| `ranking` \| `file-upload` |
| questions[].question | string | ✓ | | 角色: 调查创建者；系统: 调查设计器 | 填写页题目展示 |
| questions[].options | string[] | — | 用于 multiple-choice / matrix / ranking | 角色: 调查创建者；系统: 调查设计器 | 填写页选项与响应校验 |
| questions[].matrixRows | string[] | — | matrix 题行标签 | 系统: 调查设计器 | 矩阵题渲染 |
| questions[].matrixColumns | string[] | — | matrix 题列标签 | 系统: 调查设计器 | 矩阵题渲染 |
| questions[].placeholder | string | — | text/number/email/phone 输入提示 | 系统: 调查设计器 | 填写页输入提示 |
| questions[].min | number | — | number/rating 最小值 | 系统: 调查设计器 | 响应校验 |
| questions[].max | number | — | number/rating 最大值 | 系统: 调查设计器 | 响应校验 |
| questions[].step | number | — | number 步长 | 系统: 调查设计器 | 数值输入控制 |
| questions[].required | boolean | ✓ | | 系统: 调查设计器 | 提交前响应校验 |
| questions[].conditionalLogic | ConditionalLogic | — | 条件显示逻辑 | 系统: 调查设计器 | 填写页条件渲染 |
| questions[].conditionalLogic.showIf.questionId | string | ✓ | 依赖的问题 ID |
| questions[].conditionalLogic.showIf.operator | enum | ✓ | `equals` \| `not_equals` \| `contains` \| `greater_than` \| `less_than` \| `is_empty` \| `is_not_empty` |
| questions[].conditionalLogic.showIf.value | any | ✓ | 比对值 |
| questions[].helpText | string | — | | 角色: 调查创建者；系统: 调查设计器 | 填写页辅助说明 |
| targetAudience | enum | ✓ | `All Members` \| `Board` \| `Project Leads` \| `Specific Group` | 调查发布设置 | 调查分发目标筛选 |
| specificMemberIds | string[] | — | 当 targetAudience = Specific Group 时使用 | 分组/成员选择器 | 指定成员调查入口 |
| status | enum | ✓ | `Draft` \| `Active` \| `Closed` | 发布、关闭调查操作 | 列表状态、填写权限 |
| startDate | string | ✓ | ISO date string |
| endDate | string | ✓ | ISO date string |
| responsesCount | number | ✓ | 统计快照 | `surveyResponses` 提交后计数 | 调查统计页 |
| createdBy | string | ✓ | 创建者 member ID | 当前登录 `members.id` | 权限校验、审计 |
| createdAt | string | ✓ | ISO date string |
| distributionChannels | enum[] | — | `email` \| `in-app` \| `link` |
| shareableLink | string | — | 分享链接 |

---

## `surveyResponses`
> **TS Interface:** `SurveyResponse` (`services/surveysService.ts`) | **Constants key:** `COLLECTIONS.SURVEY_RESPONSES`

| 字段路径 | 类型 | 必填 | 枚举值 / 说明 | 来 | 往 |
|--------|------|:----:|------------|----|----|
| id | string | ✓ | Firestore doc ID | 系统: Firestore doc id | 响应详情查询 |
| surveyId | string | ✓ | 关联的 Survey doc ID | `surveys.id` | 调查响应列表、`surveys.responsesCount` |
| memberId | string | ✓ | 提交者 member ID | 当前登录 `members.id` | 成员响应记录、重复提交校验 |
| responses | map | ✓ | `Record<questionId, any>` — P0 fix 注释：Firestore rules 要求字段名为 `responses` | 填写页按 `surveys.questions[].id` 生成 | 调查统计、导出 |
| submittedAt | string | ✓ | ISO timestamp | 提交响应操作 | 响应排序、统计 |

---

## `documents`
> **TS Interface:** `Document` (`types/misc.ts`) | **Constants key:** `COLLECTIONS.DOCUMENTS`

| 字段路径 | 类型 | 必填 | 枚举值 / 说明 | 来 | 往 |
|--------|------|:----:|------------|----|----|
| id | string | ✓ | Firestore doc ID | 系统: Firestore doc id | `documentVersions.documentId` |
| name | string | ✓ | 文件显示名 | 上传/编辑文件表单 | 文件列表、详情 |
| purpose | string | — | 用途说明，如 `Board Reference` | 上传/编辑文件表单 | 文件筛选、详情 |
| tags | string[] | — | | 上传/编辑文件表单 | 标签筛选 |
| loId | string | — | Local Organisation ID | 当前成员/组织上下文 | LO 文件筛选 |
| uploadedBy | string | — | 上传者 member ID | 当前登录 `members.id` | 权限校验、审计 |
| uploadedDate | string \| Date | ✓ | | 文件上传流程 | 文件列表排序 |
| createdAt | Date | — | | 创建文件操作 | 审计、排序 |
| updatedAt | Date | — | | 文件或版本更新 | 最新更新时间展示 |

---

## `documentVersions`
> **TS Interface:** `DocumentVersion` (`services/documentsService.ts`) | **Constants key:** `COLLECTIONS.DOCUMENT_VERSIONS`

| 字段路径 | 类型 | 必填 | 枚举值 / 说明 | 来 | 往 |
|--------|------|:----:|------------|----|----|
| id | string | — | Firestore doc ID（可选，由 Firestore 自动生成） | 系统: Firestore doc id | 版本查询、删除 |
| documentId | string | ✓ | 关联的父 Document doc ID | `documents.id` | 文档版本列表 |
| version | number | ✓ | 版本号，递增整数 | 新版本上传时递增 | 版本排序、当前版本选择 |
| fileName | string | ✓ | 原始文件名 | 角色: 文档上传者；系统: 文件上传元数据 | 文件列表与下载 |
| fileUrl | string | ✓ | Storage 下载 URL | 系统: Storage 上传流程 | 文件下载与预览 |
| fileSize | number | ✓ | 字节数 | 系统: 文件上传元数据 | 文件详情展示 |
| mimeType | string | ✓ | MIME 类型 | 系统: 文件上传元数据 | 预览类型判断 |
| uploadedBy | string | ✓ | 上传者 member ID | 系统: 当前 `members.id` | 权限与审计 |
| uploadedAt | Date \| Timestamp | ✓ | | 系统: 版本上传时间 | 版本排序 |
| changeLog | string | — | 版本变更说明 | 角色: 文档上传者；系统: 版本表单 | 版本详情展示 |
| isCurrent | boolean | ✓ | 是否为当前版本 | 新版本上传/版本切换 | 文档下载、详情展示 |

---

## `learningPaths`
> **TS Interface:** `LearningPath` (`services/learningPathsService.ts`) | **Constants key:** `COLLECTIONS.LEARNING_PATHS`

| 字段路径 | 类型 | 必填 | 枚举值 / 说明 | 来 | 往 |
|--------|------|:----:|------------|----|----|
| id | string | — | Firestore doc ID | 系统: Firestore doc id | `learningProgress.pathId`、`certificates.pathId` |
| name | string | ✓ | | 学习路径管理表单 | 路径列表、`certificates.pathName` |
| description | string | ✓ | | 学习路径管理表单 | 路径详情 |
| category | enum | ✓ | `JCI Official` \| `Leadership` \| `Business` \| `Personal Development` \| `Technical` | 角色: 学习管理员；系统: 路径配置 | 路径分类筛选 |
| modules | string[] | ✓ | 按顺序排列的 trainingModule ID 数组 | 路径模块配置 | 学习内容、进度计算 |
| estimatedDuration | number | ✓ | 小时数 | 角色: 学习管理员；系统: 路径配置 | 学习计划展示 |
| difficulty | enum | ✓ | `Foundation` \| `Intermediate` \| `Advance` |
| pointsReward | number | ✓ | 完成后奖励积分 | 角色: 学习管理员；系统: 路径配置 | 完成奖励计算 |
| certificateIssued | boolean | ✓ | 是否颁发证书 | 角色: 学习管理员；系统: 路径配置 | 证书发放流程 |
| prerequisites | string[] | — | 前置 learningPath ID 数组 | 路径配置 | 开始学习资格校验 |
| materials | string[] | — | 外部资源 URL 数组 | 角色: 学习管理员；系统: 路径配置 | 学习材料展示 |
| status | enum | ✓ | `Active` \| `Draft` \| `Archived` | 角色: 学习管理员；系统: 路径状态操作 | 学习路径可用性筛选 |
| createdAt | Date \| Timestamp | ✓ | | 系统: 创建学习路径时生成 | 审计与排序 |
| updatedAt | Date \| Timestamp | ✓ | | 系统: 更新学习路径时生成 | 缓存与审计 |

---

## `learningProgress`
> **TS Interface:** `LearningProgress` (`services/learningPathsService.ts`) | **Constants key:** `COLLECTIONS.LEARNING_PROGRESS`

| 字段路径 | 类型 | 必填 | 枚举值 / 说明 | 来 | 往 |
|--------|------|:----:|------------|----|----|
| id | string | — | Firestore doc ID | 系统: `${memberId}_${pathId}` | 进度查询 |
| memberId | string | ✓ | | 当前登录 `members.id` | 成员学习记录 |
| pathId | string | ✓ | 关联的 learningPath doc ID | `learningPaths.id` | 路径进度详情 |
| currentModuleIndex | number | ✓ | 当前进行到第几个模块（0-indexed） | 系统: 学习模块进度更新 | 当前模块展示 |
| completedModules | string[] | ✓ | 已完成的 trainingModule ID 数组 | 模块完成操作 | 学习进度、奖励计算 |
| startedAt | Date \| Timestamp | ✓ | | 系统: 开始学习操作 | 学习记录排序 |
| completedAt | Date \| Timestamp | — | 学习路径完成时间 | 系统: 所有模块完成 | 证书发放触发 |
| progress | number | ✓ | 0-100 百分比 | 系统: `learningPaths.modules` 完成度计算 | 进度条与完成判断 |
| certificateIssued | boolean | ✓ | 证书是否已颁发 | 系统: 学习路径完成与证书发放流程 | 证书状态展示 |
| certificateId | string | — | 对应的 certificate doc ID | `certificates.id` | 证书详情入口 |

---

## `certificates`
> **TS Interface:** `Certificate` (`services/learningPathsService.ts`) | **Constants key:** `COLLECTIONS.CERTIFICATES`

| 字段路径 | 类型 | 必填 | 枚举值 / 说明 | 来 | 往 |
|--------|------|:----:|------------|----|----|
| id | string | — | Firestore doc ID | 系统: Firestore doc id | `learningProgress.certificateId` |
| memberId | string | ✓ | | `learningProgress.memberId` | 成员证书列表 |
| pathId | string | ✓ | 关联的 learningPath doc ID | `learningProgress.pathId` / `learningPaths.id` | 证书对应路径 |
| pathName | string | ✓ | 证书对应的课程名称 | `learningPaths.name` | 证书展示 |
| issuedAt | Date \| Timestamp | ✓ | | 系统: 学习路径完成流程 | 证书排序与展示 |
| issuedBy | string | ✓ | 颁发者 member ID | 系统: 证书颁发人的 `auth.uid` | 证书审计 |
| certificateNumber | string | ✓ | 证书编号 | 系统: 证书生成流程 | 证书展示与检索 |
| verificationCode | string | ✓ | 验证码 | 系统: 证书生成流程 | 证书验证 |
| fileUrl | string | — | PDF 文件 URL | 系统: 证书 PDF 生成/上传 | 证书下载 |
| status | enum | ✓ | `Active` \| `Revoked` | 系统: 颁发/撤销流程 | 证书有效性判断 |
| isDeleted | boolean | — | 软删除标记；learningPath 删除时级联软删 | 系统: `learningPaths` 删除同步 | 证书列表过滤 |

---

## `trainingModules`
> **TS Interface:** `TrainingModule` (`types/misc.ts`) | **Constants key:** `COLLECTIONS.TRAINING_MODULES`

| 字段路径 | 类型 | 必填 | 枚举值 / 说明 | 来 | 往 |
|--------|------|:----:|------------|----|----|
| id | string | ✓ | Firestore doc ID | 系统: Firestore doc id | `learningPaths.modules`、`learningProgress.completedModules` |
| title | string | ✓ | | 模块管理表单 | 学习路径与模块详情 |
| type | enum | ✓ | `JCI Official` \| `Local Skill` \| `Leadership` | 角色: 学习管理员；系统: 模块配置 | 模块分类筛选与展示 |
| duration | string | ✓ | 时长描述，如 `2 hours` | 角色: 学习管理员；系统: 模块配置 | 学习计划展示 |
| completionStatus | enum | ✓ | `Not Started` \| `In Progress` \| `Completed` | 系统: 会员学习进度更新 | 学习进度展示 |
| pointsReward | number | ✓ | | 角色: 学习管理员；系统: 模块配置 | 模块完成奖励计算 |
| image | string | ✓ | 封面图 URL | 角色: 学习管理员；系统: 媒体上传 | 模块封面展示 |

---

## `hobbyClubs`
> **TS Interface:** `HobbyClub` (`types/misc.ts`) | **Constants key:** `COLLECTIONS.HOBBY_CLUBS`

| 字段路径 | 类型 | 必填 | 枚举值 / 说明 | 来 | 往 |
|--------|------|:----:|------------|----|----|
| id | string | ✓ | Firestore doc ID | 系统: Firestore doc id | 社团查询与成员关联 |
| name | string | ✓ | 社团名称 | 角色: 社团负责人；系统: 社团表单 | 社团列表与详情 |
| category | string | — | 社团分类 | 角色: 社团负责人；系统: 社团表单 | 社团分类筛选 |
| membersCount | number | ✓ | 当前成员数（冗余快照） | 系统: 加入/退出社团流程 | 成员数量展示与容量检查 |
| nextActivity | string | — | 下一次活动描述 | 角色: 社团负责人；系统: 活动安排 | 社团详情展示 |
| activities | ClubActivity[] | — | 活动历史 | 角色: 社团负责人；系统: 活动记录 | 社团活动历史展示 |
| activities[].id | string | ✓ | | 系统: 活动记录生成 | 活动详情定位 |
| activities[].date | string | ✓ | | 角色: 社团负责人；系统: 活动表单 | 活动排序 |
| activities[].description | string | ✓ | | 角色: 社团负责人；系统: 活动表单 | 活动详情展示 |
| lead | string | ✓ | 负责人姓名（冗余） | 系统: `members.general.name` 复制 | 社团负责人展示 |
| leadId | string | — | 负责人 member UID，用于 leaveClub 权限守卫 | 系统: `members.id` / 社团负责人设置 | 负责人权限校验 |
| image | string | ✓ | 封面图 URL | 角色: 社团负责人；系统: 媒体上传 | 社团封面展示 |
| memberIds | string[] | — | 成员 member ID 数组 | 系统: 加入/退出社团流程 | 成员列表与权限校验 |
| description | string | — | | 角色: 社团负责人；系统: 社团表单 | 社团详情展示 |
| whatsappUrl | string | — | WhatsApp 群组链接 | 角色: 社团负责人；系统: 社团表单 | 社团联系入口 |
| capacity | number | — | 最大成员数，joinClub 时强制检查 | 角色: 社团负责人；系统: 社团表单 | 加入容量校验 |
| isDeleted | boolean | — | 软删除标记；getAllClubs 过滤掉此字段为 true 的记录 | 系统: 社团删除流程 | 社团列表过滤 |

---

## `socialPosts`
> **TS Interface:** `SocialPost` (`types/socialPost.ts`) | **Constants key:** `COLLECTIONS.SOCIAL_POSTS`

| 字段路径 | 类型 | 必填 | 枚举值 / 说明 | 来 | 往 |
|--------|------|:----:|------------|----|----|
| id | string | ✓ | Firestore doc ID | 系统: Firestore doc id | 社交内容查询与发布 |
| title | string | ✓ | | 角色: 内容创建者；系统: 内容表单/AI 工作流 | 帖子标题展示 |
| rawContent | string | ✓ | 原始素材内容 | 角色: 内容创建者；系统: 内容表单 | 内容生成与编辑 |
| contentType | enum | — | `recognition` \| `member_story` \| `event_highlight` \| `announcement_teaser` \| `educational_value` \| `impact_community` \| `promotion_recruitment` \| `corporate_organisational` | 角色: 内容创建者；系统: 内容分类 | 内容模板选择 |
| editedContent | string | — | 人工修改后的内容 | 角色: 内容编辑者；系统: 编辑器 | 审核与发布内容 |
| platformContent | map | — | `Partial<Record<platform, string>>` 各平台生成的内容 | 系统: AI/社交内容生成流程 | 平台发布内容 |
| platforms | enum[] | ✓ | `facebook` \| `instagram` \| `linkedin` \| `xiaohongshu` | 角色: 内容创建者；系统: 发布配置 | 平台发布路由 |
| status | enum | ✓ | `draft` \| `pending_review` \| `approved` \| `scheduled` \| `published` \| `rejected` |
| submittedBy | string | ✓ | 提交者 member ID | 系统: 当前 `members.id` | 内容审核审计 |
| submittedByName | string | ✓ | 提交者姓名（冗余） | 系统: `members.general.name` 复制 | 内容列表展示 |
| reviewedBy | string | — | 审核者 member ID | 系统: 审核人的 `auth.uid` | 审核审计 |
| rejectionReason | string | — | 拒绝原因 | 角色: 审核者；系统: 审核表单 | 审核详情 |
| scheduledAt | string | — | 计划发布时间 | 角色: 内容管理员；系统: 排程表单 | 排程发布 |
| publishedAt | string | — | 实际发布时间 | 系统: 社交平台发布结果 | 发布记录展示 |
| imageUrls | string[] | — | 图片 URL 数组 | 角色: 内容创建者；系统: 媒体上传 | 帖子媒体展示 |
| linkedEventId | string | — | 关联活动 ID | 系统: `events.id` / 内容表单 | 活动关联展示 |
| linkedEventName | string | — | 关联活动名称（冗余） | 系统: `events.name` 复制 | 帖子活动名称展示 |
| hashtags | string[] | — | | 系统: 内容生成/编辑流程 | 社交平台发布 |
| aiGenerated | boolean | — | 是否由 AI 生成 | 系统: AI 内容生成流程 | 内容来源标记 |
| createdAt | string | ✓ | ISO timestamp | 系统: 创建帖子时生成 | 审计与排序 |
| updatedAt | string | ✓ | ISO timestamp | 系统: 更新帖子时生成 | 缓存与审计 |

---

## `socialPersonas`
> **TS Interface:** `SocialPersona` (`types/socialPersona.ts`) | **Constants key:** `COLLECTIONS.SOCIAL_PERSONAS`

| 字段路径 | 类型 | 必填 | 枚举值 / 说明 | 来 | 往 |
|--------|------|:----:|------------|----|----|
| id | string | ✓ | = platform 值，如 `instagram` | 系统: 平台配置 ID | 社交内容生成时的平台配置查询 |
| platform | enum | ✓ | `facebook` \| `instagram` \| `linkedin` \| `xiaohongshu` | 角色: 内容管理员；系统: 平台配置表单 | 内容生成与发布路由 |
| systemPrompt | string | ✓ | AI 系统提示词 | 角色: 内容管理员；系统: Persona 配置 | AI 社交内容生成 |
| defaultTone | string | ✓ | 默认语气描述 | 角色: 内容管理员；系统: Persona 配置 | AI 内容风格控制 |
| maxLength | number | ✓ | 最大字符数 | 角色: 内容管理员；系统: Persona 配置 | 平台内容长度校验 |
| examplePost | string | ✓ | 示例帖子 | 角色: 内容管理员；系统: Persona 配置 | AI 生成参考 |
| isEnabled | boolean | ✓ | | 角色: 内容管理员；系统: Persona 启停操作 | 生成前平台筛选 |
| updatedAt | string | ✓ | ISO timestamp | 系统: Persona 配置更新时间 | 缓存与审计 |
| updatedBy | string | — | 最后修改者 member ID | 系统: 修改人的 `auth.uid` | 配置审计 |

---

## `nudges`
> **TS Interface:** `Nudge` (`services/behavioralNudgingService.ts`) | **Constants key:** `COLLECTIONS.NUDGES`

| 字段路径 | 类型 | 必填 | 枚举值 / 说明 | 来 | 往 |
|--------|------|:----:|------------|----|----|
| id | string | ✓ | Firestore doc ID | 系统: Firestore doc id | 会员 Nudge 查询 |
| memberId | string | ✓ | | 系统: 行为评估目标 `members.id` | 会员 Nudge 列表 |
| type | enum | ✓ | `positive_reinforcement` \| `inactivity_warning` \| `opportunity_suggestion` \| `goal_reminder` | 系统: `nudgeRules` 匹配结果 | Nudge 类型渲染与筛选 |
| title | string | ✓ | | 系统: `nudgeRules.title` 模板 | Nudge 展示 |
| message | string | ✓ | | 系统: `nudgeRules.message` 模板 | Nudge 展示 |
| priority | enum | ✓ | `low` \| `medium` \| `high` | 系统: `nudgeRules.priority` | Nudge 排序 |
| actionUrl | string | — | 点击跳转 URL | 系统: 行为建议生成流程 | Nudge 操作入口 |
| actionLabel | string | — | 按钮文字 | 系统: 行为建议生成流程 | Nudge 操作入口 |
| createdAt | Date | ✓ | | 系统: Nudge 创建时间 | Nudge 排序 |
| dismissed | boolean | ✓ | 是否已关闭 | 角色: 会员关闭操作 | Nudge 列表过滤 |

---

## `nudgeRules`
> **TS Interface:** `NudgeRule` (`services/behavioralNudgingService.ts`) | **Constants key:** `COLLECTIONS.NUDGE_RULES`

| 字段路径 | 类型 | 必填 | 枚举值 / 说明 | 来 | 往 |
|--------|------|:----:|------------|----|----|
| id | string | ✓ | Firestore doc ID | 系统: Firestore doc id | 规则查询 |
| name | string | ✓ | | 角色: Admin；系统: 规则表单 | 规则列表展示 |
| description | string | ✓ | | 角色: Admin；系统: 规则表单 | 规则详情展示 |
| condition | object | ✓ | 触发条件 | 角色: Admin；系统: 规则表单 | 行为数据评估 |
| condition.type | enum | ✓ | `points_threshold` \| `attendance_rate` \| `days_inactive` \| `goal_progress` \| `tier_upgrade` | 角色: Admin；系统: 规则表单 | 行为数据匹配 |
| condition.value | number | ✓ | 阈值 | 角色: Admin；系统: 规则表单 | 阈值判断 |
| condition.operator | enum | ✓ | `greater_than` \| `less_than` \| `equals` | 角色: Admin；系统: 规则表单 | 阈值判断 |
| nudgeType | enum | ✓ | 同 Nudge.type：`positive_reinforcement` \| `inactivity_warning` \| `opportunity_suggestion` \| `goal_reminder` | 角色: Admin；系统: 规则表单 | Nudge 类型生成 |
| title | string | ✓ | 生成 Nudge 的标题模板 | 角色: Admin；系统: 规则表单 | Nudge 标题生成 |
| message | string | ✓ | 生成 Nudge 的消息模板 | 角色: Admin；系统: 规则表单 | Nudge 内容生成 |
| priority | enum | ✓ | `low` \| `medium` \| `high` | 角色: Admin；系统: 规则表单 | Nudge 排序 |
| isActive | boolean | ✓ | | 角色: Admin；系统: 规则启停操作 | 规则执行前筛选 |

---

## `publications`
> **TS Interface:** `Publication` (`services/publicationService.ts`) | **Constants key:** `COLLECTIONS.PUBLICATIONS`

| 字段路径 | 类型 | 必填 | 枚举值 / 说明 | 来 | 往 |
|--------|------|:----:|------------|----|----|
| id | string | — | Firestore doc ID | 系统: Firestore doc id | 出版物查询 |
| year | string | ✓ | 如 `"2025"` | 角色: 内容管理员；系统: 出版物表单 | 年份筛选 |
| issue | string | ✓ | 如 `"Issue 1"`、`"E-Magazine"` | 角色: 内容管理员；系统: 出版物表单 | 期号展示 |
| title | string | ✓ | 完整显示标题 | 角色: 内容管理员；系统: 出版物表单 | 出版物标题展示 |
| pdfUrl | string | ✓ | Google Drive 分享 URL（读取时转换为 /preview 格式） | 角色: 内容管理员；系统: 文件上传 | PDF 预览与下载 |
| status | enum | ✓ | `Published` \| `Draft` | 角色: 内容管理员；系统: 发布状态操作 | 出版物可见性筛选 |
| sortOrder | number | ✓ | 同年份内排序，数字越小越靠前 | 角色: 内容管理员；系统: 出版物表单 | 出版物排序 |
| loId | string | — | Local Organisation ID | 系统: 当前 LO 上下文 | LO 范围查询 |
| createdAt | Timestamp \| Date | — | | 系统: 创建出版物时生成 | 审计与排序 |
| updatedAt | Timestamp \| Date | — | | 系统: 更新出版物时生成 | 缓存与审计 |

---

## `partnerships`
> **TS Interface:** `Partnership` (`types/misc.ts`) | **Constants key:** `COLLECTIONS.PARTNERSHIPS`

| 字段路径 | 类型 | 必填 | 枚举值 / 说明 | 来 | 往 |
|--------|------|:----:|------------|----|----|
| id | string | — | Firestore doc ID | 系统: `advertisements.id` / Firestore doc id | Partnerships 页面查询 |
| name | string | ✓ | 合作伙伴名称 | 系统: `advertisements.provider` / 商业资料映射 | 合作伙伴卡片展示 |
| period | PartnershipPeriod | ✓ | 合作期间 | 系统: 广告投放日期映射 | 合作期限展示 |
| period.startDate | string | ✓ | | 系统: `advertisements.startDate` | 合作期限展示 |
| period.endDate | string | ✓ | | 系统: `advertisements.endDate` | 合作期限展示 |
| redeemMethod | string | ✓ | 兑换方式说明 | 系统: 广告/合作伙伴配置 | 会员权益兑换说明 |
| memberBenefits | string | ✓ | 会员权益说明 | 系统: 合作伙伴配置 | 会员权益展示 |
| logo | string | — | Logo URL | 系统: `advertisements.logoUrl` / 媒体配置 | 合作伙伴卡片展示 |
| banner | string | ✓ | Banner 图 URL | 系统: `advertisements.imageUrl` | Partnerships 页面展示 |
| eligibleRoles | string[] | ✓ | 可享受权益的角色列表 | 系统: 合作伙伴受众配置 | 会员资格筛选 |
| status | enum | ✓ | `active` \| `inactive` | 系统: 广告投放状态映射 | 活跃合作伙伴筛选 |
| createdAt | any | — | Firestore Timestamp | 系统: 合作记录创建时间 | 审计与排序 |
| updatedAt | any | — | Firestore Timestamp | 系统: 合作记录更新时间 | 缓存与审计 |

---

## `businessProfiles`
> **TS Interface:** `BusinessProfile` (`types/member.ts`) | **Constants key:** `COLLECTIONS.BUSINESS_PROFILES`
> **注意：** 代码库注释标注此集合为死代码（no service / hook / UI），仅有 Firestore rules 和 indexes。

| 字段路径 | 类型 | 必填 | 枚举值 / 说明 | 来 | 往 |
|--------|------|:----:|------------|----|----|
| id | string | ✓ | Firestore doc ID | 系统: 仅见接口/Firestore 结构声明；未发现应用写入 | 未发现应用读取；仅规则与索引引用 |
| memberId | string | ✓ | 所有者 member ID | 系统: 仅见接口声明 | 未发现应用读取 |
| ownerName | string | ✓ | 所有者姓名（冗余） | 系统: 仅见接口声明 | 未发现应用读取 |
| companyName | string | ✓ | | 系统: 仅见接口声明 | 未发现应用读取 |
| industry | string | ✓ | 参见 `INDUSTRY_OPTIONS` | 系统: 仅见接口声明 | 未发现应用读取 |
| businessCategory | string | — | 参见 `BUSINESS_CATEGORIES_OPTIONS` | 系统: 仅见接口声明 | 未发现应用读取 |
| description | string | ✓ | | 系统: 仅见接口声明 | 未发现应用读取 |
| website | string | ✓ | | 系统: 仅见接口声明 | 未发现应用读取 |
| offer | string | ✓ | 特别优惠摘要 | 系统: 仅见接口声明 | 未发现应用读取 |
| offerTerms | string | — | 优惠条款 | 系统: 仅见接口声明 | 未发现应用读取 |
| offerExpiry | string | — | 优惠过期日期 | 系统: 仅见接口声明 | 未发现应用读取 |
| logo | string | ✓ | Logo URL | 系统: 仅见接口声明 | 未发现应用读取 |
| internationalConnections | InternationalConnection[] | — | 国际联系列表 | 系统: 仅见接口声明 | 未发现应用读取 |
| globalNetworkEnabled | boolean | — | | 系统: 仅见接口声明 | 未发现应用读取 |
| acceptsInternationalBusiness | enum \| boolean | — | `Yes` \| `No` \| `Willing to Explore` | 系统: 仅见接口声明 | 未发现应用读取 |
| idealReferralTypes | string[] | — | | 系统: 仅见接口声明 | 未发现应用读取 |
| interestedIndustries | string[] | — | | 系统: 仅见接口声明 | 未发现应用读取 |
| jciChapters | string[] | — | | 系统: 仅见接口声明 | 未发现应用读取 |

---

## `publicBusinessListings`
> **TS Interface:** `BusinessProfile` (`types/member.ts`，同上，通过 `mapMemberToBusinessProfile` 映射写入) | **Constants key:** `COLLECTIONS.PUBLIC_BUSINESS_LISTINGS`
> **注意：** 此集合是 `members` 集合 business 字段的公开去标准化副本，由 `businessDirectoryService.syncPublicListing` 维护。字段结构与 `businessProfiles` 完全相同，doc ID = memberId。

字段同 `businessProfiles`，见上方。

---

## `memberBenefits`
> **TS Interface:** `MemberBenefit` (`services/memberBenefitsService.ts`) | **Constants key:** `COLLECTIONS.MEMBER_BENEFITS`

| 字段路径 | 类型 | 必填 | 枚举值 / 说明 | 来 | 往 |
|--------|------|:----:|------------|----|----|
| id | string | — | Firestore doc ID | 系统: Firestore doc id | 福利查询与 `benefitUsage.benefitId` |
| name | string | ✓ | | 角色: 福利管理员；系统: 福利表单 | 福利列表展示 |
| description | string | ✓ | | 角色: 福利管理员；系统: 福利表单 | 福利详情展示 |
| type | enum | ✓ | `Discount` \| `Exclusive Access` \| `Free Service` \| `Priority` \| `Other` | 角色: 福利管理员；系统: 福利表单 | 福利类型展示与筛选 |
| category | enum | ✓ | `Event` \| `Training` \| `Business` \| `Social` \| `General` | 角色: 福利管理员；系统: 福利表单 | 福利分类筛选 |
| eligibilityCriteria | object | ✓ | | 角色: 福利管理员；系统: 资格配置 | 会员兑换资格校验 |
| eligibilityCriteria.tier | string[] | — | | 系统: 资格配置 | 等级资格校验 |
| eligibilityCriteria.role | string[] | — | | 系统: 资格配置 | 角色资格校验 |
| eligibilityCriteria.points | number | — | 最低积分要求 | 系统: 资格配置 | 积分资格校验 |
| eligibilityCriteria.joinDate | string | — | 最早入会日期 | 系统: 资格配置 | 入会日期资格校验 |
| eligibilityCriteria.custom | string | — | 自定义条件说明 | 角色: 福利管理员；系统: 资格配置 | 自定义资格校验 |
| validFrom | Date \| Timestamp \| string | ✓ | | 角色: 福利管理员；系统: 福利表单 | 福利有效期判断 |
| validUntil | Date \| Timestamp \| string | — | | 角色: 福利管理员；系统: 福利表单 | 福利过期判断 |
| usageLimit | number | — | 每人最多兑换次数 | 角色: 福利管理员；系统: 福利表单 | 兑换次数校验 |
| currentUsage | number | ✓ | 跨所有会员的总兑换次数 | 系统: `benefitUsage` 兑换计数 | 使用次数展示与额度校验 |
| status | enum | ✓ | `Active` \| `Inactive` \| `Expired` | 角色: 福利管理员；系统: 有效期/状态更新 | 福利可用性筛选 |
| provider | string | — | 提供商名称 | 角色: 福利管理员；系统: 福利表单 | 提供商展示 |
| termsAndConditions | string | — | | 角色: 福利管理员；系统: 福利表单 | 兑换条款展示 |
| bannerUrl | string | — | Banner 图 URL | 角色: 福利管理员；系统: 媒体上传 | 福利图片展示 |
| createdAt | Date \| Timestamp | ✓ | | 系统: 创建福利时生成 | 审计与排序 |
| updatedAt | Date \| Timestamp | ✓ | | 系统: 更新福利时生成 | 缓存与审计 |

---

## `benefitUsage`
> **TS Interface:** `BenefitUsage` (`services/memberBenefitsService.ts`) | **Constants key:** `COLLECTIONS.BENEFIT_USAGE`

| 字段路径 | 类型 | 必填 | 枚举值 / 说明 | 来 | 往 |
|--------|------|:----:|------------|----|----|
| id | string | — | Firestore doc ID | 系统: Firestore doc id | 使用记录查询 |
| memberId | string | ✓ | | 系统: 当前 `members.id` | 会员福利使用历史 |
| benefitId | string | ✓ | 关联的 memberBenefit doc ID | 系统: `memberBenefits.id` | 福利详情与使用次数统计 |
| usedAt | Date \| Timestamp \| string | ✓ | | 系统: 福利兑换操作时间 | 使用历史排序 |
| notes | string | — | 兑换备注（P0 fix：字段名由 `details` 改为 `notes` 以匹配 Firestore hasOnly 白名单） | 角色: 会员；系统: 福利兑换表单 | 使用记录详情 |

---

## `templates`
> **TS Interfaces:** `EventTemplate` / `ActivityPlanTemplate` / `EventBudgetTemplate` (`services/templatesService.ts`) | **Constants key:** `COLLECTIONS.TEMPLATES`
> **注意：** 三种模板类型共用同一 Firestore 集合，以不同字段组合区分。

### EventTemplate 子类型

| 字段路径 | 类型 | 必填 | 枚举值 / 说明 | 来 | 往 |
|--------|------|:----:|------------|----|----|
| id | string | — | Firestore doc ID | 系统: Firestore doc id | 活动模板查询 |
| name | string | ✓ | | 角色: Admin / Board；系统: 模板表单 | 模板列表展示 |
| description | string | — | | 角色: Admin / Board；系统: 模板表单 | 模板详情展示 |
| type | enum | ✓ | `Meeting` \| `Training` \| `Social` \| `Project` \| `International` | 角色: Admin / Board；系统: 模板表单 | 活动类型匹配 |
| defaultLocation | string | — | | 角色: Admin / Board；系统: 模板表单 | 活动实例默认地点 |
| defaultMaxAttendees | number | — | | 角色: Admin / Board；系统: 模板表单 | 活动容量默认值 |
| defaultBudget | number | — | | 角色: Finance / Board；系统: 模板表单 | 活动预算默认值 |
| checklist | string[] | — | | 角色: Admin / Board；系统: 模板表单 | 活动执行清单 |
| requiredResources | string[] | — | | 角色: Admin / Board；系统: 模板表单 | 活动资源清单 |
| estimatedDuration | number | — | 小时数 | 角色: Admin / Board；系统: 模板表单 | 活动时间估算 |
| createdAt | Date \| Timestamp | ✓ | | 系统: 创建模板时生成 | 审计与排序 |
| updatedAt | Date \| Timestamp | ✓ | | 系统: 更新模板时生成 | 缓存与审计 |
| createdBy | string | — | | 系统: 创建人的 `auth.uid` | 模板审计 |

### ActivityPlanTemplate 子类型

| 字段路径 | 类型 | 必填 | 枚举值 / 说明 | 来 | 往 |
|--------|------|:----:|------------|----|----|
| id | string | — | | 系统: Firestore doc id | 活动计划模板查询 |
| name | string | ✓ | | 角色: Admin / Board；系统: 模板表单 | 模板列表展示 |
| description | string | — | | 角色: Admin / Board；系统: 模板表单 | 模板详情展示 |
| type | enum | ✓ | `Community` \| `Business` \| `Individual` \| `International` |
| defaultObjectives | string | — | | 角色: Admin / Board；系统: 模板表单 | `activityPlans.objectives` 默认值 |
| defaultExpectedImpact | string | — | | 角色: Admin / Board；系统: 模板表单 | `activityPlans.expectedImpact` 默认值 |
| defaultResources | string[] | — | | 角色: Admin / Board；系统: 模板表单 | `activityPlans.resources` 默认值 |
| defaultTimeline | string | — | | 角色: Admin / Board；系统: 模板表单 | `activityPlans.timeline` 默认值 |
| createdAt | Date \| Timestamp | ✓ | | 系统: 创建模板时生成 | 审计与排序 |
| updatedAt | Date \| Timestamp | ✓ | | 系统: 更新模板时生成 | 缓存与审计 |
| createdBy | string | — | | 系统: 创建人的 `auth.uid` | 模板审计 |

### EventBudgetTemplate 子类型

| 字段路径 | 类型 | 必填 | 枚举值 / 说明 | 来 | 往 |
|--------|------|:----:|------------|----|----|
| id | string | — | | 系统: Firestore doc id | 活动预算模板查询 |
| name | string | ✓ | | 角色: Finance / Board；系统: 模板表单 | 模板列表展示 |
| description | string | — | | 角色: Finance / Board；系统: 模板表单 | 模板详情展示 |
| eventType | enum | — | `Meeting` \| `Training` \| `Social` \| `Project` \| `International` | 角色: Finance / Board；系统: 模板表单 | 活动类型匹配 |
| budgetCategories | array | ✓ | | 角色: Finance / Board；系统: 预算模板表单 | 活动预算明细生成 |
| budgetCategories[].category | string | ✓ | | 角色: Finance；系统: 预算模板配置 | 预算分类展示 |
| budgetCategories[].estimatedAmount | number | ✓ | | 角色: Finance；系统: 预算模板配置 | 预算汇总 |
| budgetCategories[].description | string | — | | 角色: Finance；系统: 预算模板配置 | 预算说明展示 |
| totalEstimatedBudget | number | ✓ | | 系统: 预算分类金额汇总 | 活动预算默认值 |
| createdAt | Date \| Timestamp | ✓ | | 系统: 创建模板时生成 | 审计与排序 |
| updatedAt | Date \| Timestamp | ✓ | | 系统: 更新模板时生成 | 缓存与审计 |
| createdBy | string | — | | 系统: 创建人的 `auth.uid` | 模板审计 |

---

## `inquiries`
> **TS Interface:** `Inquiry` (`services/inquiryService.ts`，内部接口，未暴露于 types.ts) | **Constants key:** `COLLECTIONS.INQUIRIES`

| 字段路径 | 类型 | 必填 | 枚举值 / 说明 | 来 | 往 |
|--------|------|:----:|------------|----|----|
| id | string | — | Firestore doc ID | 系统: Firestore doc id | 咨询记录查询 |
| senderId | string | ✓ | 发起方 member ID | 系统: 当前 `members.id` | 发起方权限与咨询历史 |
| senderName | string | ✓ | 发起方姓名（冗余） | 系统: `members.general.name` 复制 | 咨询详情展示 |
| senderPhone | string | ✓ | | 系统: `members.contact.phone` 复制 | 联系方式展示 |
| senderCompany | string | — | | 系统: `members.business.companyName` 复制 | 咨询详情展示 |
| recipientId | string | ✓ | 接收方 member ID | 系统: 商业目录所有者 `members.id` | 接收方通知与咨询历史 |
| recipientName | string | ✓ | 接收方姓名（冗余） | 系统: `members.general.name` 复制 | 咨询详情展示 |
| recipientPhone | string | ✓ | | 系统: `members.contact.phone` 复制 | 联系方式展示 |
| businessId | string | ✓ | 关联的 publicBusinessListing doc ID | 系统: `publicBusinessListings.id` | 商业资料关联 |
| businessName | string | ✓ | 商业名称（冗余） | 系统: 商业目录名称复制 | 咨询详情展示 |
| requirements | string | ✓ | 询问内容 | 角色: 会员；系统: 咨询表单 | 咨询内容与通知 |
| channel | enum | ✓ | `whatsapp_direct` \| `whapi_bot` \| `no_phone` | 系统: 联系方式可用性与发送流程 | 消息发送路由 |
| status | enum | ✓ | `sent` \| `pending` \| `failed` | 系统: 咨询发送结果 | 咨询状态展示与重试 |
| createdAt | Timestamp | ✓ | | 系统: 创建咨询时生成 | 咨询排序与审计 |

---

## `systemSettings`
> **TS Interface:** 无专属接口（键值配置集合）| **Constants key:** `COLLECTIONS.SYSTEM_SETTINGS`

多个固定 doc ID 的配置文档，无统一 TypeScript 接口。已知文档结构（从 Cloud Function 代码推断）：

| doc ID | 已知字段 | 说明 | 来 | 往 |
|--------|---------|------|----|----|
| `membershipRules` | `rules: Record<MembershipType, { duesAmount: number }>` | 各会员类型年费金额 | 系统: Cloud Function / 会员配置服务 | 会费计算与支付请求生成 |
| `pendingWhatsAppCampaign` | `year: number`, `memberIds: string[]`, `triggeredAt: Timestamp`, `dismissed: boolean` | 待发送的 WhatsApp 催缴活动标记 | 系统: 会费通知流程 | WhatsApp 催缴任务与发送去重 |

---

## `permissionCatalog`
> **TS Interface:** `PermissionCatalogItem` (`services/permissionConfigService.ts`) | **Constants key:** `COLLECTIONS.PERMISSION_CATALOG`

| 字段路径 | 类型 | 必填 | 枚举值 / 说明 | 来 | 往 |
|--------|------|:----:|------------|----|----|
| id | string | ✓ | Firestore doc ID | 系统: Firestore doc id | 权限目录查询 |
| key | string | ✓ | 权限标识符，如 `view_finance` | 角色: Admin；系统: 权限配置表单 | 权限检查与角色配置 |
| name | string | ✓ | 显示名称 | 角色: Admin；系统: 权限配置表单 | 权限管理界面 |
| category | string | ✓ | 权限分类 | 角色: Admin；系统: 权限配置表单 | 权限分类筛选 |
| description | string | — | | 角色: Admin；系统: 权限配置表单 | 权限说明展示 |
| active | boolean | ✓ | | 角色: Admin；系统: 权限启停操作 | 权限检查前筛选 |
| updatedAt | any | — | Firestore Timestamp | 系统: 权限配置更新时间 | 缓存与审计 |

---

## `RegistrationHistory`
> **TS Interface:** `RegistrationHistoryDoc`（内部接口，`services/engagementAutoSuggestService.ts`，非 types.ts 暴露）| **Constants key:** `COLLECTIONS.REGISTRATION_HISTORY`

| 字段路径 | 类型 | 必填 | 枚举值 / 说明 | 来 | 往 |
|--------|------|:----:|------------|----|----|
| id | string | ✓ | Firestore doc ID | 系统: Firestore doc id | 报名历史查询 |
| memberId | string | ✓ | | 系统: 当前 `members.id` | 会员参与度与推荐计算 |
| rawCategory | string | ✓ | 活动类别原始字符串，如 `JCIM Inspire`、`Area Convention` | 系统: 活动报名/参与记录 | 活动类别匹配与统计 |
| eventTitle | string | ✓ | 活动名称 | 系统: `events.title` / 报名记录 | 会员活动历史展示 |
| eventDate | string | ✓ | 可能包含日期范围，如 `"24 Apr 2026 08:00 am - 26 Apr 2026 23:00 pm"` | 系统: 活动日期快照 | 活动历史排序与推荐 |
| year | string | ✓ | 年份字符串，如 `"2026"` | 系统: `eventDate` 解析 | 年度参与度统计 |

---

## `counters`
> **TS Interface:** 无专属接口（原子计数器工具集合）| **Constants key:** `COLLECTIONS.COUNTERS`

用于原子生成序号（如付款申请参考编号 PR-{loId}-{YYYYMMDD}-{序号}）。Doc ID 为计数器名称，仅有 `value: number` 字段（通过 Firestore `increment()` 操作更新）。无 TypeScript 接口定义。CLAUDE.md 分析记录：P0（集合无 Firestore rules → 生产环境付款申请创建全部 PERMISSION_DENIED）。

---

## `system`
> **TS Interface:** 无统一专属接口（多种配置文档）| **Constants key:** `COLLECTIONS.SYSTEM`

系统级配置文档集合。已知 doc 结构：

| doc ID | TypeScript 接口 / 形状 | 说明 | 来 | 往 |
|--------|----------------------|------|----|----|
| `radar_points_config` | `RadarPointsConfig` (`types/gamification.ts`) | 见下 | 系统: 积分配置服务 | 雷达统计与会员画像计算 |

### RadarPointsConfig

| 字段路径 | 类型 | 必填 | 枚举值 / 说明 | 来 | 往 |
|--------|------|:----:|------------|----|----|
| leadership.exOfficio | number | ✓ | | 角色: Admin；系统: 积分配置 | 雷达领导力分数计算 |
| leadership.organisingChairman | number | ✓ | | 角色: Admin；系统: 积分配置 | 雷达领导力分数计算 |
| leadership.committee | number | ✓ | | 角色: Admin；系统: 积分配置 | 雷达领导力分数计算 |
| training.pointsPerHour | number | ✓ | | 角色: Admin；系统: 积分配置 | 雷达培训分数计算 |
| recruitment.pointsPerPax | number | ✓ | | 角色: Admin；系统: 积分配置 | 雷达招募分数计算 |
| sponsorship.pointsPer100 | number | ✓ | | 角色: Admin；系统: 积分配置 | 雷达赞助分数计算 |

---

## `system_config`
> **TS Interface:** 无专属接口（服务器端运行时配置）| **Constants key:** `COLLECTIONS.SYSTEM_CONFIG`

生日通知处理器及其他服务器端进程的运行时配置。无 TypeScript 接口定义。Doc 结构未在客户端代码中明确定义。

---

## `birthdayNotificationsSent`
> **TS Interface:** 无专属接口（去重标记文档）| **Constants key:** `COLLECTIONS.BIRTHDAY_NOTIFICATIONS_SENT`

去重文档集合，doc ID 格式为 `{memberId}_{YYYY-MM-DD}`（个人祝福）或 `announcements_{YYYY-MM-DD}`（公告）。由 Cloud Function `sendBirthdayNotifications` 写入。

| 字段路径 | 类型 | 必填 | 枚举值 / 说明 | 来 | 往 |
|--------|------|:----:|------------|----|----|
| sentAt | Timestamp | ✓ | 服务器时间戳 | 系统: `sendBirthdayNotifications` 写入时间 | 当日通知去重与发送审计 |
| type | string | — | `personal`（个人文档）；公告文档无此字段 | 系统: 生日通知流程 | 个人/公告通知类型判断 |
| count | number | — | 仅公告文档有：通知发送的其他会员数 | 系统: 公告通知发送统计 | 生日公告统计展示 |

---

## `conversations`（含 messages 子集合）
> **TS Interface:** 无专属接口（私信功能，无服务层）| **Constants key:** 无（collection name `conversations`，仅见于 firestoreLogger.ts 注释）

CLAUDE.md 分析记录为 `conversations+messages`，P0 × 2（任意用户可读所有私信；resource.data in list → 对话列表永远为空）。整个代码库无对应 Service 层、Hook 或 TypeScript 接口定义。`firestoreLogger.ts` 仅在示例注释中提及该集合名称，属于死代码或未完成功能。
