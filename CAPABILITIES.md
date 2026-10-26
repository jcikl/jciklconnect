# CAPABILITIES.md — JCIKL Connect 能力地圖

> **用途：** 寫任何新的函數 / hook / service / 元件之前，先在本文件搜尋。這是「系統已經有什麼」的唯一索引。
> **生成方式：** 由 `scripts/gen-capabilities` 掃描原始碼自動產生（重新生成後請以 git log 為準）。用途說明取自原始碼的檔頭註解；沒有註解的標記為「⚠️ 無說明」，需人工補上。
> **維護規則：** 新增或修改 export 的 PR，必須在同一個 PR 內更新本文件。

## 0. 使用方式（給人和 AI）

| 步驟 | 動作 |
|---|---|
| 1 | 用 Ctrl+F 或 `grep -n "關鍵字" CAPABILITIES.md` 找能力，例如 member、payment、format、attendance |
| 2 | 找到後，打開對應檔案的行號，確認簽名 |
| 3 | 在計畫中寫明：✅ 複用 / 🔧 擴充 / 🆕 新建（並列出查過的檔案） |
| 4 | 分層規則：元件 → hook → service → Firestore。**元件不得直接 import `firebase/firestore`** |

**規模總覽：**

| 層 | 檔案數 | 位置 |
|---|---|---|
| Service（業務邏輯與資料存取） | 77 | `services/` |
| Hook（React 資料綁定） | 46 | `hooks/` |
| Util（純函數工具） | 27 | `utils/` |
| UI 元件（通用） | 34 | `components/ui/` |
| 共用業務元件 | 10 | `components/shared/` |
| Context | 2 | `contexts/` |
| Cloud Functions | 0 | `functions/src/` |

## 1. ⚠️ 重複造輪子警示（先修正認知，不急著改碼）

### 1.1 已有標準版本，卻在元件內重寫

| 函數 | 標準版本（請用這個） | 重寫位置 |
|---|---|---|
| `formatCurrency` | `utils/formatUtils.ts` | `components/modules/SponsorshipView.tsx:10`<br>`components/modules/ProjectManagement/ProjectReportGenerator.tsx:181` |
| `formatDate` | `utils/dateUtils.ts` | `components/modules/Finance/BankMatchingModal.tsx:27`<br>`components/modules/MemberManagement/BoardTransitionTools.tsx:161` |
| `formatDateTime` | `utils/dateUtils.ts` | `components/modules/ZoomBookingView.tsx:59` |
| `getInitialsSvg` | `utils/avatarUtils.ts` | `components/layout/SearchDropdown.tsx:5`<br>`components/modules/CommunicationView.tsx:16`<br>`components/modules/HobbyClubsView.tsx:4`<br>`components/modules/BusinessDirectory/businessDirectoryUtils.ts:2`<br>`components/modules/Members/MemberCreateModal.tsx:4`<br>`components/modules/Members/MemberDetail.tsx:51`<br>`components/modules/Members/MemberDetailCareerTab.tsx:8`<br>`components/modules/Members/MemberTable.tsx:10`<br>`components/modules/Members/MentorMatchingModal.tsx:9` |
| `isFuture` | `utils/dateUtils.ts` | `components/modules/ZoomBookingView.tsx:65` |

### 1.2 同一函數在多個元件各寫一份（應抽出到 utils）

| 函數 | 出現次數 | 位置 |
|---|---|---|
| `getInitialsSvg` | 8 | `components/layout/SearchDropdown.tsx`<br>`components/modules/CommunicationView.tsx`<br>`components/modules/HobbyClubsView.tsx`<br>`components/modules/Members/MemberCreateModal.tsx`<br>`components/modules/Members/MemberDetail.tsx`<br>`components/modules/Members/MemberDetailCareerTab.tsx`<br>`components/modules/Members/MemberTable.tsx`<br>`components/modules/Members/MentorMatchingModal.tsx` |

### 1.3 元件直接存取 Firestore（繞過 service 層）

- `components/admin/RadarDataImporter.tsx`
- `components/dashboard/Analytics.tsx`
- `components/modules/DbMaintenanceView.tsx`
- `components/modules/Events/useEventParticipations.ts`
- `components/modules/Finance/TransactionSplitModal.tsx`
- `components/modules/Members/MemberDetail.tsx`
- `components/modules/MembersView.tsx`
- `components/modules/ProjectManagement/ProjectFinancialAccount.tsx`
- `components/modules/SystemLogsView.tsx`
- `components/modules/Toyyib/ToyyibSettingsPanel.tsx`

### 1.4 疑似未被使用（建新功能前先確認是否就是你要的）

| 檔案 | 行數 | 檔頭說明 |
|---|---|---|
| `hooks/useGuestAnalytics.ts` | 21 | ⚠️ 無說明 |
| `hooks/useMemberBenefits.ts` | 102 | Member Benefits Data Hook Wraps MemberBenefitsService with React state (loading / error / data). |
| `hooks/useMemberMutations.ts` | 107 | ⚠️ 無說明 |
| `hooks/useNotifications.ts` | 107 | ⚠️ 無說明 |
| `hooks/usePushNotifications.ts` | 63 | ⚠️ 無說明 |
| `services/pointsRuleService.ts` | 690 | Points Rule Service - Points Rule Configuration Management |
| `services/projectAccountsService.ts` | 236 | Project Financial Accounts Service |
| `services/reconciliationService.ts` | 861 | Reconciliation Service - Auto-matching & splitting bank transactions with project transactions |
| `services/workflowService.ts` | 815 | Workflow Service — CRUD + execution for the `workflows` collection. Fixes applied: P0-A  executeWorkflow idempotency guard (duplicate-trigge… |

### 1.5 超大檔案（> 1,500 行，修改時務必精準定位，勿整檔重寫）

| 檔案 | 行數 |
|---|---|
| `services/financeService.ts` | 5,325 |
| `services/pointsService.ts` | 2,492 |
| `services/membersService.ts` | 2,334 |
| `hooks/useFinanceData.ts` | 2,034 |
| `services/inventoryService.ts` | 1,638 |

## 2. Service 層（按業務領域）

> 欄位說明：**集合**＝此 service 讀寫的 Firestore 集合（`COLLECTIONS.*` 常數）；**引用**＝有多少檔案 import 它。

### 2.1 會員 Member

| Service | 行數 | 引用 | 用途 | 集合 |
|---|---|---|---|---|
| `engagementAutoSuggestService.ts` | 380 | 1 | ⚠️ 無說明 | REGISTRATION_HISTORY |
| `learningPathsService.ts` | 340 | 2 | Learning Paths & Learning Progress Service Fixes applied: P1 – startLearningPath uses runTransaction to prevent duplicate progress records P… | LEARNING_PATHS, LEARNING_PROGRESS |
| `memberAuthService.ts` | 91 | 2 | 会员登录账号（Firebase Auth）的建立与补建；调用 Netlify 函数 member-auth（uid = 会员文档 ID）。 | — |
| `memberBenefitsService.ts` | 329 | 1 | Member Benefits Service Handles the memberBenefits collection and benefitUsage write path. Read path for advertisements-as-benefits lives in… | ADVERTISEMENTS, BENEFIT_USAGE, MEMBER_BENEFITS |
| `memberCardsService.ts` | 136 | 9 | Member Cards Service — keeps `memberCards/{memberId}` (the public directory card, Phase 0 WP2) in sync with `members`. The card is written A… | MEMBER_CARDS |
| `memberJourneyService.ts` | 155 | 2 | Leadership Journey + Trainer Pathway derivation (dashboard journey card for pre-2025 members) | — |
| `memberStatsService.ts` | 319 | 2 | Member Statistics Service - Generates comprehensive member statistics and reports | — |
| `membersService.ts` | 2,334 | 45 | Members Service - CRUD Operations | BOARD_MEMBERS, EVENT_REGISTRATIONS, MEMBERS, MEMBER_EMAILS, NOTIFICATIONS, PAYMENT_REQUESTS … |
| `membershipConfigService.ts` | 373 | 17 | ⚠️ 無說明 | SYSTEM_SETTINGS |
| `mentorshipService.ts` | 638 | 4 | Mentorship Matching Service | MEMBERS, MENTORSHIP_FEEDBACK, MENTOR_MATCHES |
| `promotionService.ts` | 1,191 | 4 | ⚠️ 無說明 | MANUAL_PROMOTION_REQUESTS, MEMBERS, PROMOTION_HISTORY, SYSTEM |
| `senatorshipSyncService.ts` | 88 | 2 | Developer-only back-fill of JCI Malaysia senator numbers onto members. Runs in the Netlify function jci-malaysia-regcode (Admin SDK) so the … | — |

<details><summary><code>services/engagementAutoSuggestService.ts</code> — 0 個方法、1 個函數/常數</summary>


**其他 export：** `EngagementAutoSuggestService` (L121)

</details>

<details><summary><code>services/learningPathsService.ts</code> — 10 個方法</summary>

| 方法 | 行 | 說明 |
|---|---|---|
| `invalidateLearningPathsCache` | 88 | ── Cache helpers ─────────────────────────────────────────────────────────── |
| `invalidateProgressCache` | 92 |  |
| `getAllLearningPaths` | 98 | ── Read: Learning Paths ──────────────────────────────────────────────────── |
| `getLearningPathById` | 121 |  |
| `getMemberProgress` | 140 | ── Read: Progress ────────────────────────────────────────────────────────── |
| `createLearningPath` | 166 | ── Write: Learning Paths ─────────────────────────────────────────────────── |
| `updateLearningPath` | 185 |  |
| `deleteLearningPath` | 204 | P1 fix: cascade-delete all learningProgress records and soft-delete all certificates for this path before dele… |
| `startLearningPath` | 237 | P1 fix: use a deterministic doc ID (memberId_pathId) so startLearningPath can use tx.get() on a single documen… |
| `updateProgress` | 272 | P1 fix: when completion reaches 100% and a certificate is due, both the progress update and the certificate cr… |

</details>

<details><summary><code>services/memberAuthService.ts</code> — 2 個方法</summary>

| 方法 | 行 | 說明 |
|---|---|---|
| `createForMembers` | 54 | After a batch import: create Auth accounts for newly created member ids (ADMIN+). |
| `fixAll` | 70 | SUPER_ADMIN back-fill over all member profiles, page by page. |

</details>

<details><summary><code>services/memberBenefitsService.ts</code> — 7 個方法</summary>

| 方法 | 行 | 說明 |
|---|---|---|
| `invalidateBenefitsCache` | 72 | ── Cache helpers ────────────────────────────────────────────────────────── |
| `invalidateUsageCache` | 76 |  |
| `getMemberBenefits` | 83 | ── getMemberBenefits ────────────────────────────────────────────────────── Returns all active MemberBenefit r… |
| `getBenefitUsage` | 151 | ── getBenefitUsage ──────────────────────────────────────────────────────── Returns all benefitUsage docs for … |
| `claimBenefit` | 192 | ── claimBenefit ─────────────────────────────────────────────────────────── Atomically writes a benefitUsage d… |
| `getAllBenefits` | 282 | ── getAllBenefits (alias for backward compat) ───────────────────────────── |
| `getBenefitUsageHistory` | 289 | ── getBenefitUsageHistory (for admin views) ─────────────────────────────── Queries by benefitId and/or member… |

</details>

<details><summary><code>services/memberCardsService.ts</code> — 8 個方法</summary>

| 方法 | 行 | 說明 |
|---|---|---|
| `getInternationalCards` | 41 | Cards shared with other chapters (`international == true`), all chapters, including KL cards that opted in (ex… |
| `getCardsByChapters` | 59 | Cards of the given chapters (KL users only: rules let active KL members list any card, by `loId ==` or `in`; e… |
| `invalidateCardsCache` | 78 | Drop cached card lists (call after the viewer opts in, so a stale result is not served). |
| `buildCard` | 83 |  |
| `shouldHaveCard` | 87 |  |
| `applyUpdates` | 92 | Member snapshot after an updateDoc-style payload (dot-paths supported). |
| `plan` | 97 | Decide the card action for a before -> after member change (see planCardSync). |
| `syncCards` | 106 | Applies the planned card upserts/deletes for already-committed member writes, chunked (<= 400 per batch). Neve… |

</details>

<details><summary><code>services/memberJourneyService.ts</code> — 3 個方法</summary>

| 方法 | 行 | 說明 |
|---|---|---|
| `getLeadershipJourney` | 45 | Leadership Journey — derived from project committee assignments + Board of Directors records |
| `getTrainerJourney` | 134 | Trainer Pathway — derived from member skills + points (same criteria as the profile card) |
| `getJourney` | 149 |  |

</details>

<details><summary><code>services/memberStatsService.ts</code> — 2 個方法</summary>

| 方法 | 行 | 說明 |
|---|---|---|
| `generateStatistics` | 52 | Generate comprehensive member statistics |
| `generateReport` | 193 | Generate comprehensive member report with insights |

</details>

<details><summary><code>services/membersService.ts</code> — 32 個方法</summary>

| 方法 | 行 | 說明 |
|---|---|---|
| `syncComputedMembershipType` | 101 | Recompute membershipType from profile + promotion (Full); always persisted on save. |
| `invalidateMembersCache` | 128 | Invalidate all members cache (call after any write to members collection). |
| `getAllMembers` | 136 | Get all members, optionally filtered by loId (for multi-LO). |
| `getMemberById` | 181 | Get member by ID |
| `recalculateIntroducerStats` | 203 | Helper to recalculate radar stats for an introducer (dynamic import to avoid circular dependency) |
| `normalizeMemberData` | 250 | Helper to map flat properties to standard nested sub-objects (general, contact, etc.) for database consistency… |
| `createMember` | 566 | Create new member. Caller should pass loId (or use DEFAULT_LO_ID for single-LO). |
| `updateMember` | 647 | Update member. Sets updatedAt and optionally updatedBy (audit). |
| `validateSenatorshipByBoard` | 873 | Board of Directors validates a member's senatorship number (locks future edits). |
| `revokeSenatorshipValidation` | 899 | Revoke board validation (admin / board only). Clears certification. |
| `deleteMember` | 993 | Delete member |
| `searchMembers` | 1106 | Search members |
| `getMembersByRole` | 1125 | Get members by role |
| `getMemberByEmail` | 1156 | Get member by email (for account linking) |
| `getMembersAtRisk` | 1197 | Get members at risk (churn prediction) |
| `computeAttendanceMonths` | 1218 | 当年应计月份数：入会年份从入会月起算，否则从 1 月起算 |
| `recalculateAttendance` | 1232 | 按当年 checked_in 记录重算出席对比（签到次数 vs 已过月份），写回会员档案 |
| `updateMemberRole` | 1264 |  |
| `assignMentor` | 1333 | Assign mentor |
| `batchUpdateMembers` | 1356 | Batch update members — uses writeBatch for atomicity (E01) |
| `batchDeleteMembers` | 1529 | Batch delete members — uses writeBatch for atomicity (E02) |
| `getFirstMembershipYearKey` | 1697 | Earliest year key on member.jciCareer?.membershipDuesHistory (e.g. "2024"). |
| `statusFromMembershipAmount` | 1710 |  |
| `fixFirstMembershipDuesTo350` | 1728 | Set dues on each member's first membership year to RM350 and recalculate status from paid amount. SYNC-004 NOT… |
| `getEffectiveJoinYear` | 1835 | Effective membership start year (calendar Oct rollover or first payment year). |
| `inferMembershipType` | 1866 | Infer membershipType from role, senatorship, and membership[year].dues (Config rules). |
| `batchSyncMembershipTypes` | 1889 | Batch-sync members.jciCareer?.membershipType from membership dues + role + Config. Does not modify members.jci… |
| `batchSyncMembershipRecords` | 2001 | Batch-sync members.jciCareer?.membershipDuesHistory[year] from each member's membershipType + Membership Confi… |
| `syncMembershipFromMembershipType` | 2217 |  |
| `migrateMembershipTypeFullToOfficial` | 2224 | TEMP MIGRATION: membershipType 'Full' → 'Official' |
| `migrateDobToGeneralDob` | 2259 | TEMP MIGRATION: copy root-level dateOfBirth/dob into general.dob for members missing it |
| `getMembersPaginated` | 2301 | Cursor-based paginated member fetch (ordered by name). Pass `lastDoc` from the previous page's result to advan… |

</details>

<details><summary><code>services/membershipConfigService.ts</code> — 0 個方法、15 個函數/常數</summary>


**其他 export：** `getMemberAge` (L17), `isMalaysianNationality` (L32), `validateMembershipTypeEligibility` (L42), `suggestMembershipTypeForMember` (L86), `resolveEligibleMembershipType` (L117), `roleForMembershipType` (L135), `computeMembershipTypeFromMember` (L170), `getTargetDuesForMembershipType` (L220), `resolveMembershipTypeFromDues` (L235), `DEFAULT_MEMBERSHIP_RULES` (L257), `MembershipConfigService` (L269), `resolveMembershipPurpose` (L311), `getMembershipPurpose` (L339), `getPendingWhatsAppCampaign` (L355), `dismissWhatsAppCampaign` (L367)

</details>

<details><summary><code>services/mentorshipService.ts</code> — 13 個方法</summary>

| 方法 | 行 | 說明 |
|---|---|---|
| `invalidateMentorMatchesCache` | 57 | Invalidate all mentorMatches cache entries after any write. |
| `findPotentialMentors` | 63 | Enhanced mentor matching with sophisticated algorithm |
| `createMentorMatch` | 209 | Create a formal mentor match record |
| `approveMentorMatch` | 258 | Approve a mentor match and make it active |
| `autoMatchMentors` | 326 | Auto-match mentees with mentors based on criteria |
| `getMentorMatches` | 358 | Get mentor matches for a member |
| `getMenteeMatches` | 384 | Get mentee matches for a member |
| `completeMentorship` | 410 | Complete a mentorship relationship |
| `getMentorshipStats` | 449 | Get enhanced mentorship statistics |
| `logSession` | 496 | P1-C: Log a mentoring session and increment sessionCount / totalHours on the match doc |
| `cancelMentorship` | 520 | P1-D: Cancel an active or pending mentorship and remove member cross-references atomically |
| `deleteMentorMatch` | 570 | P1 fix: Delete a mentor match document and clean up member cross-references atomically. Firestore rules allow … |
| `collectFeedback` | 609 | Collect feedback on mentorship relationship |

</details>

<details><summary><code>services/promotionService.ts</code> — 18 個方法</summary>

| 方法 | 行 | 說明 |
|---|---|---|
| `getPromotionProgress` | 340 | Get promotion progress for a Probation Member |
| `getPromotionProgressForMember` | 346 |  |
| `buildEngagementProgress` | 355 |  |
| `saveEngagementRequirement` | 387 |  |
| `checkAllRequirements` | 427 | Check all four promotion requirements for a member |
| `checkRequirement` | 435 | Check a specific requirement for a member |
| `processAutomaticPromotions` | 450 | Process automatic promotion for eligible members |
| `promoteToOfficialMember` | 481 | Promote a Probation Member to Full Member |
| `createManualPromotionRequest` | 611 | Create manual promotion request |
| `updateMemberActivity` | 701 | Update member activity that might affect promotion requirements |
| `getPromotionStatistics` | 728 | Get promotion statistics |
| `getPromotionTrackingOverview` | 739 |  |
| `getProbationMembersForDisplay` | 839 | Public API for UI: probation members with computed membership type |
| `savePromotionProgressField` | 897 | Save a single promotion progress field for a member |
| `getManualPromotionRequests` | 967 | List manual promotion requests, optionally filtered by status. |
| `backfillOfficialMembershipType` | 986 | Backfill: sync jciCareer.membershipType for all members where root membershipType === 'Official' but jciCareer… |
| `approveManualPromotionRequest` | 1015 | Approve a manual promotion request and trigger the actual promotion. |
| `rejectManualPromotionRequest` | 1045 | Reject a manual promotion request with a reason. |

</details>

<details><summary><code>services/senatorshipSyncService.ts</code> — 2 個方法</summary>

| 方法 | 行 | 說明 |
|---|---|---|
| `preview` | 75 | Developer only: counts + the per-member list of proposed writes (name · old → new) for verification. |
| `apply` | 81 | Developer only: recompute, back up prior numbers, write (board-validated preserved), audit. |

</details>

### 2.2 財務 Finance

| Service | 行數 | 引用 | 用途 | 集合 |
|---|---|---|---|---|
| `eventBudgetService.ts` | 306 | 3 | Event Budget Management Service | EVENT_BUDGETS |
| `eventPaymentMatchingService.ts` | 310 | 1 | EventPaymentMatchingService Matches event registration income transactions (Pending) to imported bank transactions. Three matching paths: A … | TRANSACTIONS |
| `financeService.ts` | 5,325 | 33 | ⚠️ 無說明 | BANK_ACCOUNTS, FINANCE_ALERTS, FINANCE_META, MEMBERS, PAYMENT_REQUESTS, PROJECT_TRANSACTIONS … |
| `incentiveCalculatorService.ts` | 385 | 1 | ⚠️ 無說明 | BANK_ACCOUNTS, EVENTS, EVENT_REGISTRATIONS, INCENTIVE_SUBMISSIONS, MEMBERS, PROJECTS … |
| `paymentRequestService.ts` | 999 | 4 | Payment Request Service (Story 2.1) | BANK_ACCOUNTS, COUNTERS, NOTIFICATIONS, PAYMENT_REQUESTS, TRANSACTIONS |
| `projectAccountsService.ts` | 236 | 0 | Project Financial Accounts Service | PROJECTS |
| `projectFinancialService.ts` | 949 | 7 | Project Financial Service Feature: platform-enhancements Provides project-specific financial account management capabilities. Validates: Req… | PROJECTS, PROJECT_TRANSACTIONS, TRANSACTIONS, TRANSACTION_SPLITS |
| `reconciliationService.ts` | 861 | 0 | Reconciliation Service - Auto-matching & splitting bank transactions with project transactions | TRANSACTIONS, TRANSACTION_SPLITS |
| `sponsorshipService.ts` | 214 | 3 | ⚠️ 無說明 | SPONSORSHIPS |
| `toyyibService.ts` | 829 | 10 | ⚠️ 無說明 | TOYYIB_BILLS, TOYYIB_CATEGORIES, TRANSACTIONS |

<details><summary><code>services/eventBudgetService.ts</code> — 8 個方法</summary>

| 方法 | 行 | 說明 |
|---|---|---|
| `invalidateEventBudgetCache` | 59 | P2: dedicated cache invalidation for event budgets |
| `getEventBudget` | 69 | Get budget for an event |
| `saveEventBudget` | 132 | Create or update event budget |
| `addBudgetItem` | 170 | Add budget item Fix 12a: use arrayUnion instead of read-then-overwrite to avoid concurrency issues. |
| `updateBudgetItem` | 190 | Update budget item Fix 12b: use runTransaction to read-modify-write the budgetItems array atomically. |
| `deleteBudgetItem` | 211 | Delete budget item Fix 12c: use arrayRemove instead of read-then-overwrite. |
| `reconcileEventBudget` | 235 | Reconcile event budget with financial transactions |
| `approveBudget` | 281 | Approve budget Fix 13: wrap in runTransaction with status pre-check so double-approval is impossible. |

</details>

<details><summary><code>services/eventPaymentMatchingService.ts</code> — 4 個方法</summary>

| 方法 | 行 | 說明 |
|---|---|---|
| `runAutoMatch` | 78 | Run auto-matching for all unmatched event income transactions. Call this after a batch bank import, or on-dema… |
| `matchIncomeTx` | 148 | Try to match a single income transaction to an available bank tx. Call after a new bank tx is imported to chec… |
| `applyMatch` | 164 | Apply a confirmed match between an income tx and a bank tx. |
| `removeMatch` | 211 | Remove a previously applied N:1 match. Restores the income tx to its pre-match status (via prevStatus) and dec… |

</details>

<details><summary><code>services/financeService.ts</code> — 60 個方法、1 個函數/常數</summary>

| 方法 | 行 | 說明 |
|---|---|---|
| `getAllTransactions` | 170 | Get all transactions |
| `getHistoricalNetFlowBeforeYear` | 231 | Get cumulative net flow of bank accounts before a specific year |
| `getTransactionYearsForAccount` | 300 | Get all transaction years for a specific bank account |
| `getAllTransactionYears` | 343 | Get all unique transaction years across all accounts |
| `getProjectTransactions` | 390 | Get project transactions |
| `getBankTransactionsByProject` | 436 | Get bank transactions associated with a project (from transactions collection) |
| `createTransaction` | 553 | Create transaction |
| `batchCreateBankTransactions` | 663 | Batch-optimised path for bank statement imports. Replaces N individual createTransaction calls (N reads + N co… |
| `createProjectTransaction` | 761 | Create project transaction ATOMIC-001: accepts an optional externalBatch so callers can keep multi-document op… |
| `updateProjectTransaction` | 824 | Update project transaction |
| `createTransactionSplit` | 862 | Create transaction split (upsert: update existing or create new) |
| `getTransactionSplits` | 1169 | Get transaction splits |
| `getAllTransactionSplits` | 1193 | Get ALL transaction splits in bulk |
| `updateTransactionSplit` | 1235 | Update transaction split |
| `deleteTransactionSplit` | 1355 | Delete transaction split |
| `getTransactionsByType` | 1471 | Get transactions by type (including splits) Uses cached getAllTransactions + getAllTransactionSplits to avoid … |
| `updateTransaction` | 1502 | Update transaction Accepts Partial<Transaction> for typed fields, or a string-keyed map for Firestore dot-nota… |
| `batchUpdateTransactionCategory` | 1698 | Batch update Transaction Category fields for multiple transactions |
| `batchUpdateSplitCategory` | 1869 | Batch update Transaction Category fields for multiple split records |
| `getTransactionById` | 2040 | Get transaction by ID from either TRANSACTIONS or PROJECT_TRANSACTIONS |
| `deleteTransaction` | 2075 | Delete transaction |
| `reverseTransaction` | 2205 | Reverse a transaction by creating a counter-entry and voiding the original |
| `deleteProjectTransaction` | 2277 | Delete project transaction |
| `syncTransactionWithInventory` | 2442 | Synchronize transaction with inventory |
| `syncMemberMembership` | 2487 | Synchronize member membership summary based on transactions |
| `getAllBankAccounts` | 2780 | P0-fix: added `loId` parameter. When provided (non-admin callers) the query is scoped to that LO's accounts. W… |
| `recalculateAllBankAccountBalances` | 2846 | Recalculate currentBalance for all bank accounts from transaction history |
| `createBankAccount` | 2874 | Create bank account |
| `updateBankAccount` | 2917 | Update bank account |
| `deleteBankAccount` | 2946 | Delete bank account — guarded: refuses if linked transactions, reconciliation records, or payment requests exi… |
| `getTransactionsByCategory` | 2984 | Get transactions by category |
| `getFinancialSummary` | 3010 | Get financial summary |
| `initiateDuesRenewal` | 3106 | Automated dues renewal with membership type support Handles membership types: Probation (RM300), Official (RM3… |
| `sendDuesReminders` | 3305 | Send reminder notifications for overdue dues (excludes senators) |
| `getDuesRenewalStatus` | 3373 | Get dues renewal status for a specific year |
| `getMembersDuesList` | 3467 | Get members sorted by dues year and membership type |
| `processDuesPayment` | 3584 | Process dues payment and update member status |
| `calculateSystemBalance` | 3656 | Calculate system balance for reconciliation (includes all transaction types) |
| `detectDiscrepancies` | 3745 | Detect reconciliation discrepancies |
| `reconcileBankAccount` | 3815 | Reconcile bank account with enhanced transaction type support |
| `getReconciliationHistory` | 4005 | Get reconciliation history |
| `deleteReconciliation` | 4031 |  |
| `getUnmatchedForReconciliation` | 4148 | Get unmatched transactions for reconciliation matching UI Returns bank_import and manual transactions separate… |
| `matchTransactions` | 4176 | Link a bank import transaction to a manually-entered transaction Sets matchStatus:'full' on the bank import an… |
| `unmatchTransactions` | 4227 | Unmatch a previously matched pair — restores each side to the status it had before matching (tracked via prevS… |
| `getBankAccountById` | 4270 | Get bank account by ID with dynamic balance |
| `generateFinancialReport` | 4312 | Generate financial reports |
| `exportFinancialReportAsCSV` | 4431 | Export financial report as CSV |
| `exportTransactionsAsCSV` | 4495 | Export detailed transaction list as CSV |
| `generateIncomeStatement` | 4537 | Generate comprehensive Income Statement (P&L Statement) |
| `generateBalanceSheet` | 4639 | Generate comprehensive Balance Sheet |
| `generateCashFlowStatement` | 4807 | Generate comprehensive Cash Flow Statement |
| `generateIncomeDetailsStatement` | 4960 | Generate Income Details Statement (detailed breakdown of income sources) |
| `getTransactionsPaginated` | 5040 | Cursor-based paginated transaction fetch (ordered by date desc). Pass `lastDoc` from the previous page's resul… |
| `getFinanceAlerts` | 5083 | ── Finance Alerts ──────────────────────────────────────────────────────── |
| `resolveFinanceAlert` | 5120 |  |
| `voidTransaction` | 5143 | ── Void Transaction ────────────────────────────────────────────────────── |
| `getReclassificationGroups` | 5211 | Returns distinct (loId, category, projectId, unmatchedProjectTitle) combos across all transactions, ordered by… |
| `batchReclassifyTransactions` | 5246 | Batch-updates all transactions matching each rule's (loId, category, projectId, unmatchedProjectTitle) with th… |
| `backfillMissingLoId` | 5298 | Backfills loId = DEFAULT_LO_ID on all transactions where loId is missing or null. |

**其他 export：** `invalidateFinanceCache` (L115)

</details>

<details><summary><code>services/incentiveCalculatorService.ts</code> — 0 個方法</summary>


</details>

<details><summary><code>services/paymentRequestService.ts</code> — 13 個方法</summary>

| 方法 | 行 | 說明 |
|---|---|---|
| `generateReferenceNumber` | 54 | TODO: replace snapshot.size with atomic counter for production safety |
| `create` | 80 |  |
| `getById` | 168 |  |
| `list` | 186 | List with optional filters; pagination via lastDoc. |
| `updateStatus` | 237 | Approve or reject a PR. Only President / Secretary / Honorary Treasurer may act (情景 25). Pass reviewerBoardTit… |
| `markAsPaid` | 482 | Mark PR as paid when a bank transaction is matched to its expense transaction (情景 26). paidAt is the bank tran… |
| `revertPaid` | 522 | Revert PR from 'paid' back to 'approved' when bank tx match is cancelled (情景 E). |
| `resubmit` | 568 | Resubmit a rejected PR after edits (情景 H). Resets status to 'submitted' and clears rejection data. |
| `retryCreateExpenseTransaction` | 659 | Retry creating expense transaction for an approved PR (情景 I) |
| `update` | 702 |  |
| `setCombinedPdfFileId` | 766 |  |
| `cancel` | 781 |  |
| `deletePR` | 862 | Hard-delete a PR (dev role only). Also removes any linked expense transaction. |

</details>

<details><summary><code>services/projectAccountsService.ts</code> — 3 個方法</summary>

| 方法 | 行 | 說明 |
|---|---|---|
| `getAllProjectAccounts` | 41 | Get all project accounts |
| `getProjectAccountByProjectId` | 106 | Get project account by project ID |
| `reconcileProjectAccount` | 156 | Reconcile project account with main LO financial accounts |

</details>

<details><summary><code>services/projectFinancialService.ts</code> — 0 個方法</summary>


</details>

<details><summary><code>services/reconciliationService.ts</code> — 4 個方法</summary>

| 方法 | 行 | 說明 |
|---|---|---|
| `analyzeMatches` | 194 | Analyze and produce match candidates without writing anything. |
| `executeAutoMatch` | 381 | Execute auto-match: create splits where needed, update links, update reverse indexes. |
| `manualMatch` | 517 | Manual match: link a bank tx to one or more project txs, auto-split if needed. |
| `unlinkMatch` | 640 | Unlink a bank transaction from project transactions. If projectTxId is provided, partial unlink; otherwise ful… |

</details>

<details><summary><code>services/sponsorshipService.ts</code> — 5 個方法、1 個函數/常數</summary>

| 方法 | 行 | 說明 |
|---|---|---|
| `getAllSponsorships` | 40 |  |
| `getSponsorshipsByMember` | 76 |  |
| `createSponsorship` | 118 | P2: pass transactionId in data to link the sponsorship to a finance transaction. If a transactionId is provide… |
| `updateSponsorship` | 153 |  |
| `deleteSponsorship` | 190 |  |

**其他 export：** `invalidateSponsorshipsCache` (L25)

</details>

<details><summary><code>services/toyyibService.ts</code> — 21 個方法</summary>

| 方法 | 行 | 說明 |
|---|---|---|
| `getMode` | 127 | Returns the current sandbox/production mode from the server (cached 60 s). |
| `setMode` | 143 | BOARD+ only. Toggle sandbox/production mode — persisted to Firestore via proxy. |
| `buildPaymentUrl` | 150 | Build the ToyyibPay payment URL using the current server-side mode. |
| `createBill` | 162 | P0-B (order guarantee): The ToyyibPay API is called FIRST via proxyCall. Only if the API call succeeds does th… |
| `getCategories` | 270 | ToyyibPay has no "list all categories" endpoint — getCategoryDetails requires a specific code. Category codes … |
| `createCategory` | 362 |  |
| `updateCategory` | 397 | Update mutable metadata fields on a category (name, description, link). Note: categoryCode is assigned by Toyy… |
| `updateCategoryLink` | 407 |  |
| `deleteCategory` | 418 |  |
| `importCategory` | 440 | Re-link an existing ToyyibPay category by code (fetch live details, then save to Firestore) |
| `getCategoryDetails` | 455 |  |
| `getBills` | 460 |  |
| `findExistingActiveBill` | 474 | Check whether an active (non-failed) bill already exists for this member + category. Used to prevent duplicate… |
| `syncBillStatus` | 503 | Fetch the latest payment status from ToyyibPay for a single bill and persist to Firestore. Returns the updated… |
| `formatMembershipBillDescription` | 566 | ── Bill description formatters ─────────────────────────────────────────────── |
| `formatEventBillDescription` | 579 |  |
| `getOrCreateMembershipCategory` | 597 | Return the categoryCode for the given membership year's ToyyibPay category, creating it on first use. |
| `getOrCreateProjectCategory` | 688 | Return the categoryCode for the given project's ToyyibPay category, creating it on first use. |
| `getSettlements` | 767 |  |
| `parseCallback` | 781 | Parse the callback data from ToyyibPay Usually parameters are sent as POST: status_id, billcode, order_id, msg… |
| `commitWebhookRollback` | 806 | P1 FIX: Atomic rollback path for payment reversals (billpaymentStatus='3'). Previously the webhook handler wro… |

</details>

### 2.3 活動與項目 Events & Projects

| Service | 行數 | 引用 | 用途 | 集合 |
|---|---|---|---|---|
| `activityPlansService.ts` | 621 | 2 | Activity Plans Service - CRUD Operations P0 fix: all methods now query COLLECTIONS.ACTIVITY_PLANS (was COLLECTIONS.PROJECTS) P1 fixes: isDev… | ACTIVITY_PLANS, PROJECTS |
| `eventFeedbackService.ts` | 226 | 3 | Event Feedback Service - Collects and manages event feedback | EVENT_FEEDBACK |
| `eventPaymentService.ts` | 89 | 1 | Event payment (mark-paid) — creates the finance income record, then flips the registration to 'paid'. | PROJECTS |
| `eventRegBackfillService.ts` | 134 | 2 | Developer-only "Back-fill registrations from JCI Malaysia": create eventRegistrations for KL members who appear in a linked JCI Malaysia eve… | — |
| `eventRegcodeService.ts` | 105 | 3 | "My event QR": copy each member's JCI Malaysia regcode onto their own eventRegistration. Everything runs in the Netlify function jci-malaysi… | — |
| `eventRegistrationService.ts` | 393 | 7 | Event Registration Service - 报名/缴费/签到统一名单（Story 8.1） | EVENT_REGISTRATIONS, PROJECTS |
| `eventsService.ts` | 1,142 | 14 | Events Service - CRUD Operations | EVENT_BUDGETS, EVENT_FEEDBACK, EVENT_REGISTRATIONS, GUEST_REGISTRATIONS, MEMBERS, NOTIFICATIONS … |
| `flagshipProjectsService.ts` | 156 | 3 | ⚠️ 無說明 | FLAGSHIP_PROJECTS |
| `projectReportService.ts` | 775 | 3 | Project Report Service - Generates automated project reports | TEMPLATES |
| `projectsService.ts` | 823 | 21 | Projects Service - CRUD Operations | ACTIVITY_PLANS, MEMBERS, POINTS, PROJECTS, PROJECT_REPORTS, PROJECT_TRANSACTIONS … |
| `zoomBookingService.ts` | 168 | 1 | ⚠️ 無說明 | ZOOM_BOOKINGS |

<details><summary><code>services/activityPlansService.ts</code> — 11 個方法</summary>

| 方法 | 行 | 說明 |
|---|---|---|
| `invalidateActivityPlansCache` | 102 | --------------------------------------------------------------------------- Cache management -----------------… |
| `getAllActivityPlans` | 113 | FIX P0: was COLLECTIONS.PROJECTS FIX P1: added cacheService + isDevMode via withDevMode |
| `getActivityPlanById` | 175 | FIX P0: was COLLECTIONS.PROJECTS FIX P1: added withDevMode + cacheService |
| `getActivityPlansByProjectId` | 203 | FIX P1: added cacheService + isDevMode (already used ACTIVITY_PLANS — correct) |
| `getActivityPlansByStatus` | 253 | FIX P0: was COLLECTIONS.PROJECTS FIX P1: added withDevMode + cacheService |
| `createActivityPlan` | 291 | FIX P0: was COLLECTIONS.PROJECTS FIX P0: added callerRole guard — Firestore rules only allow isBoard()||isAdmi… |
| `updateActivityPlan` | 342 | FIX P0: was COLLECTIONS.PROJECTS FIX P0: added callerRole guard — Firestore rules only allow isBoard()||isAdmi… |
| `submitActivityPlan` | 395 | Submit a Draft activity plan for review. FIX P1: status guard — only allowed when status === 'Draft'. |
| `reviewActivityPlan` | 432 | Approve or reject a Submitted activity plan. FIX P1: status guard — only allowed when status === 'Submitted'. |
| `createNewVersion` | 503 | Create a new version of an existing activity plan. FIX P0: was COLLECTIONS.PROJECTS for the addDoc call. FIX P… |
| `deleteActivityPlan` | 577 | FIX P0: was COLLECTIONS.PROJECTS FIX P1: added withDevMode, cache invalidation, errorLoggingService FIX P2: cl… |

</details>

<details><summary><code>services/eventFeedbackService.ts</code> — 4 個方法</summary>

| 方法 | 行 | 說明 |
|---|---|---|
| `submitFeedback` | 63 | Submit feedback for an event — P0: duplicate guard at service layer |
| `getEventFeedback` | 108 | Get feedback for a specific event |
| `getFeedbackSummary` | 136 | Get feedback summary for an event |
| `hasMemberSubmittedFeedback` | 207 | Check if member has already submitted feedback |

</details>

<details><summary><code>services/eventPaymentService.ts</code> — 2 個方法</summary>

| 方法 | 行 | 說明 |
|---|---|---|
| `resolveBankAccountId` | 15 | Bank account an event's income goes into: the project's `financialAccountId` when it is a real bank account of… |
| `markRegistrationPaid` | 37 | Mark a registration paid. The transaction records MYR; for a USD (external) registration the price the payer s… |

</details>

<details><summary><code>services/eventRegBackfillService.ts</code> — 2 個方法</summary>

| 方法 | 行 | 說明 |
|---|---|---|
| `preview` | 86 | Developer only: read-only counts + detail + conflicts. Comfortably under the 10s function limit. |
| `apply` | 114 | Developer only: fire the background apply. Returns once the server has accepted it (202). The server recompute… |

</details>

<details><summary><code>services/eventRegcodeService.ts</code> — 3 個方法</summary>

| 方法 | 行 | 說明 |
|---|---|---|
| `preview` | 78 | Developer only: counts + the per-registration list of proposed writes (member · event — regcode) for verificat… |
| `apply` | 84 | Developer only: the server recomputes the plan, backs up the ids, writes, audits. |
| `attachMine` | 93 | Best-effort: attach the caller's OWN regcode for one event after registering. Never throws — a failure just le… |

</details>

<details><summary><code>services/eventRegistrationService.ts</code> — 0 個方法、1 個函數/常數</summary>


**其他 export：** `EventRegistrationService` (L29)

</details>

<details><summary><code>services/eventsService.ts</code> — 19 個方法</summary>

| 方法 | 行 | 說明 |
|---|---|---|
| `invalidateEventsCache` | 45 |  |
| `getAllEvents` | 96 | Approved projects with eventStartDate (for Event List: Upcoming + Completed) |
| `getUpcomingEvents` | 134 | Events starting today (MYT) or later, same statuses as getAllEvents. Filters on eventStartDate (YYYY-MM-DD str… |
| `getKlEvents` | 161 | Every event JCI Kuala Lumpur hosts or co-hosts (any date / status except Cancelled), newest first — the board … |
| `getKlRelevantEvents` | 187 | Events a JCI KL member sees in the event list / calendar (same rule as isKlRelevantEvent): KL hosts or co-host… |
| `getEventById` | 216 | Get event by ID (from projects collection) |
| `createEvent` | 252 | Create new event |
| `updateEvent` | 306 | Update event |
| `deleteEvent` | 340 | Delete event |
| `registerForEvent` | 419 | Register member for event |
| `cancelRegistration` | 530 | Cancel event registration |
| `completeEvent` | 633 | P1-A: Mark an event as Completed (no existing method existed) |
| `cancelEvent` | 667 | Cancel entire event — batch-cancels all active registrations and their income transactions |
| `markAttendance` | 836 | Mark attendance (check-in) P0 guard: only BOARD+ or ADMIN callers should mark attendance; MEMBER/GUEST are blo… |
| `undoAttendance` | 906 | Undo attendance (un-check-in) — FIX E3 P0 guard: only BOARD+ or ADMIN callers should undo attendance. |
| `getEventsByType` | 1011 | Get events by type |
| `registerGuestForEvent` | 1028 | Register a guest (signed out) for an event. Writes the registration and a phone-index doc in one writeBatch wi… |
| `getGuestRegistrations` | 1080 | Fetch all guest registrations for an event. Exposes a service-layer method so components don't query Firestore… |
| `cancelGuestRegistration` | 1114 | Cancel a guest registration. P1 FIX: also updates the phone-index sentinel doc so the phone number is freed fo… |

</details>

<details><summary><code>services/flagshipProjectsService.ts</code> — 5 個方法</summary>

| 方法 | 行 | 說明 |
|---|---|---|
| `getAllProjects` | 27 | Get all flagship projects |
| `getProjectById` | 50 | Get flagship project by ID |
| `createProject` | 70 | Create new flagship project |
| `updateProject` | 101 | Update flagship project |
| `deleteProject` | 125 | Delete flagship project P1-fix: also deletes all Cloudinary images — both galleryUrls and galleryByYear entrie… |

</details>

<details><summary><code>services/projectReportService.ts</code> — 13 個方法</summary>

| 方法 | 行 | 說明 |
|---|---|---|
| `generateReport` | 135 | Generate project report with specified type |
| `exportReportAsJSON` | 344 | Export report as JSON |
| `exportReportAsText` | 350 | Export report as formatted text |
| `generateStatusReport` | 396 | Generate status report (Requirements 7.1) |
| `generateProgressReport` | 401 | Generate progress report (Requirements 7.2) |
| `generateFinancialReport` | 406 | Generate financial report (Requirements 7.3) |
| `createReportTemplate` | 412 | Create report template (Requirements 7.4) P1 FIX: persist templates to Firestore instead of an in-memory Map t… |
| `getReportTemplate` | 435 | Get report template |
| `listReportTemplates` | 452 | List all report templates |
| `updateReportTemplate` | 466 | Update report template |
| `deleteReportTemplate` | 488 | Delete report template |
| `exportReport` | 499 | Export report with options (Requirements 7.5) |
| `initializeDefaultTemplates` | 598 | Initialize default templates |

</details>

<details><summary><code>services/projectsService.ts</code> — 16 個方法</summary>

| 方法 | 行 | 說明 |
|---|---|---|
| `invalidateProjectsCache` | 37 |  |
| `getAllProjects` | 42 | Get all projects (includes all statuses - no filtering) |
| `getExistingRoadmapIds` | 86 | Return Set of roadmapId values that already exist in Firestore — used by the batch importer to skip duplicates… |
| `getProjectById` | 104 | Get project by ID |
| `createProject` | 122 | Create new project P1-B: accept optional currentUserId so organizerId is reliably written |
| `cloneProject` | 195 | Clone a project as a new version (P1-D) |
| `updateProject` | 213 | Update project P1-C: pass currentUserId so review approval/rejection stamps reviewedBy + reviewedDate together |
| `deleteProject` | 347 | Delete project |
| `registerMember` | 424 | P1-E: Register a member with capacity guard |
| `unregisterMember` | 459 | Unregister a member from a project |
| `getProjectTasks` | 483 | Get tasks for a project P1-C: supports optional filters (priority). Requires composite Firestore index on (pro… |
| `getTaskById` | 529 | Get task by ID |
| `createTask` | 554 | Create or update task (if taskId is provided, use it as document ID) |
| `updateTask` | 618 | Update task |
| `deleteTask` | 777 | Delete a task by ID and update project completion |
| `updateProjectCompletion` | 809 | Update project completion percentage |

</details>

<details><summary><code>services/zoomBookingService.ts</code> — 5 個方法</summary>

| 方法 | 行 | 說明 |
|---|---|---|
| `createBooking` | 34 |  |
| `updateBooking` | 91 |  |
| `cancelBooking` | 136 |  |
| `getMyBookings` | 150 |  |
| `getAllBookings` | 160 |  |

</details>

### 2.4 積分與遊戲化 Points & Gamification

| Service | 行數 | 引用 | 用途 | 集合 |
|---|---|---|---|---|
| `gamificationService.ts` | 550 | 1 | gamificationService.ts - Unified Service for Awards (Achievements + Badges) | BADGES, BADGE_AWARDS, EVENT_REGISTRATIONS, LEARNING_PROGRESS, MEMBERS, POINTS |
| `pointsRuleService.ts` | 690 | 0 | Points Rule Service - Points Rule Configuration Management | POINTS_RULES, POINTS_RULE_EXECUTIONS |
| `pointsService.ts` | 2,492 | 17 | Points Service - Point management and gamification engine | INCENTIVE_PROGRAMS, INCENTIVE_STANDARDS, INCENTIVE_SUBMISSIONS, LO_STAR_PROGRESS, MEMBERS, POINTS … |
| `ruleExecutionService.ts` | 580 | 1 | Rule Execution Service Feature: platform-enhancements Provides rule execution engine and comprehensive logging capabilities. Validates: Requ… | WORKFLOW_EXECUTIONS |

<details><summary><code>services/gamificationService.ts</code> — 0 個方法</summary>


</details>

<details><summary><code>services/pointsRuleService.ts</code> — 11 個方法</summary>

| 方法 | 行 | 說明 |
|---|---|---|
| `getAllPointsRules` | 45 | Get all points rules |
| `getEnabledPointsRules` | 75 | Get enabled points rules |
| `getPointsRuleById` | 89 | Get points rule by ID |
| `savePointsRule` | 118 | Create or update points rule |
| `deletePointsRule` | 151 | Delete points rule and all associated execution records |
| `validateRuleConditions` | 180 | Validate rule conditions |
| `testRule` | 206 | Test rule execution |
| `executeRules` | 292 | Execute rules for a trigger |
| `calculatePoints` | 449 | Calculate points with weights |
| `getRuleAnalytics` | 521 | Get rule analytics |
| `getDefaultPointsRules` | 591 | Get default points rules for dev mode |

</details>

<details><summary><code>services/pointsService.ts</code> — 43 個方法</summary>

| 方法 | 行 | 說明 |
|---|---|---|
| `awardPoints` | 67 | Award points to a member |
| `awardEventAttendancePoints` | 194 | Award points for event attendance |
| `awardTaskCompletionPoints` | 293 | Award points for task completion |
| `getMemberPointHistory` | 388 | Get member's point history |
| `getMemberPoints` | 470 | Get member's total points |
| `getLeaderboard` | 475 | Get leaderboard with visibility filtering and year filtering |
| `updateMemberPoints` | 559 | TODO: remove this method once all callers have been migrated to the awardPoints batch pattern (SYNC-003) |
| `calculateTier` | 590 | Calculate member tier based on points |
| `invalidatePointsCache` | 603 | Invalidate all points transaction caches |
| `invalidatePointRulesCache` | 609 | Invalidate all point rules caches. Uses prefix 'pointsRules:' — same prefix as PointsRuleService — so one call… |
| `invalidateIncentiveCache` | 614 | Invalidate all incentive program / standard / submission caches |
| `updateLeaderboardVisibility` | 619 | Update leaderboard visibility |
| `getPointRule` | 653 | Get point rule for a specific category. SCHEMA NOTE: This service reads pointsRules documents with schema: { b… |
| `getPointRules` | 712 | Get all point rules. SCHEMA NOTE: reads pointsRules collection expecting { basePoints, active, category, prior… |
| `getAllPointRules` | 775 | Alias for backward compatibility |
| `savePointRule` | 780 | Create or update point rule |
| `deletePointRule` | 819 | Delete point rule |
| `getMemberPointsSummary` | 844 | Get points summary for a member |
| `transferPoints` | 879 | Transfer points between members (Competitive Business Logic) |
| `lockPointsForEscrow` | 963 | Lock points in Escrow (for Contracts) This triggers 'Loss Aversion' as points are deducted but not yet used. |
| `releaseEscrow` | 1035 | Release Escrow to a target (completing a contract) |
| `cleanupExpiredEscrow` | 1105 | Return points from escrow records that have passed their 90-day expiry without being released. Safe to call re… |
| `getActiveProgram` | 1204 | Get active yearly program |
| `getIncentivePrograms` | 1230 | Get all yearly programs |
| `getProgramByYear` | 1243 | Get program by year |
| `cloneProgram` | 1257 | Clone a program and its standards to a new year |
| `getStandards` | 1344 | Get all standards for a given program P1 fix: check cache before hitting Firestore; populate cache after read |
| `submitIncentiveClaim` | 1368 | Submit an incentive claim P1-C fix: enforce standard.maxClaims before allowing a new submission P1-D fix: enfo… |
| `getLOSubmissions` | 1460 | Fetch submissions by LO |
| `getUserSubmissions` | 1484 | Fetch user submissions |
| `getPendingSubmissions` | 1508 | Fetch pending submissions for approval |
| `approveClaim` | 1535 | Approve a claim P0-A fix: atomically update submission status AND create a points transaction in one batch. Fi… |
| `rejectClaim` | 1699 | Reject a claim P1 fix: wrapped in runTransaction to prevent race conditions (e.g. concurrent approve+reject). … |
| `createIncentiveProgram` | 1783 | Create a new incentive program P0-B fix: if the new program is active, deactivate all existing active programs… |
| `updateIncentiveProgram` | 1840 | Update an existing incentive program P0 fix: if setting isActive=true, atomically deactivate all other active … |
| `deleteIncentiveProgram` | 1895 | Delete an entire incentive program and its standards P1 fix: also soft-marks (status='CANCELLED') all incentiv… |
| `saveStandard` | 2010 | Save or update an incentive standard P1 fix: block edits to any standard that already has Approved submissions… |
| `bulkDeleteStandards` | 2070 | Delete multiple incentive standards P1 fix: cascade-cancel all non-Approved incentiveSubmissions that referenc… |
| `deleteStandard` | 2119 | Delete an incentive standard P1 fix: cascade-cancel all non-Approved submissions that reference this standard … |
| `getLOStarProgress` | 2160 | Fetch LO Star progress for a given LO and year |
| `getRadarPointsConfig` | 2282 | Get Radar configuration |
| `saveRadarPointsConfig` | 2329 | Save Radar configuration |
| `recalculateMemberRadarStats` | 2347 | Recalculate Member Radar Stats and update member doc |

</details>

<details><summary><code>services/ruleExecutionService.ts</code> — 0 個方法</summary>


</details>

### 2.5 組織治理 Board & Governance

| Service | 行數 | 引用 | 用途 | 集合 |
|---|---|---|---|---|
| `auditLogService.ts` | 92 | 4 | ⚠️ 無說明 | AUDIT_LOG |
| `automationService.ts` | 894 | 8 | Automation & Workflow Service | AUTOMATION_RULES, WORKFLOWS, WORKFLOW_EXECUTIONS |
| `boardManagementService.ts` | 1,264 | 11 | Board Management Service - Handles "One Year to Lead" principle | BOARD_MEMBERS, BOARD_TERM_SETTINGS, BOARD_TRANSITIONS, MEMBERS |
| `contractService.ts` | 344 | 2 | ⚠️ 無說明 | CONTRACTS, FINANCE_ALERTS, POINT_ESCROW |
| `documentsService.ts` | 431 | 1 | Documents Service with Version Control | DOCUMENTS, DOCUMENT_VERSIONS |
| `hobbyClubsService.ts` | 343 | 3 | Hobby Clubs Service - CRUD Operations | HOBBY_CLUBS |
| `permissionConfigService.ts` | 151 | 1 | ⚠️ 無說明 | PERMISSION_CATALOG |
| `sisterChaptersService.ts` | 62 | 3 | ⚠️ 無說明 | SISTER_CHAPTERS |
| `templatesService.ts` | 433 | 7 | Templates Service - Event Templates Management | TEMPLATES |
| `workflowService.ts` | 815 | 0 | Workflow Service — CRUD + execution for the `workflows` collection. Fixes applied: P0-A  executeWorkflow idempotency guard (duplicate-trigge… | MEMBERS, WORKFLOWS, WORKFLOW_EXECUTIONS |

<details><summary><code>services/auditLogService.ts</code> — 1 個方法</summary>

| 方法 | 行 | 說明 |
|---|---|---|
| `writeAuditEntry` | 59 | Write an audit log entry. the batch via `batch.set()` so it commits atomically with the main operation. When o… |

</details>

<details><summary><code>services/automationService.ts</code> — 11 個方法</summary>

| 方法 | 行 | 說明 |
|---|---|---|
| `getAllWorkflows` | 66 | Get all workflows |
| `getWorkflowById` | 110 | Get workflow by ID |
| `createWorkflow` | 141 | Create workflow |
| `updateWorkflow` | 176 | Update workflow |
| `deleteWorkflow` | 198 | Delete workflow P0: archive all workflow_executions before deleting the parent document so execution records a… |
| `executeWorkflow` | 236 | Execute workflow |
| `getAllRules` | 736 | Get automation rules |
| `createRule` | 757 | Create automation rule |
| `updateRule` | 779 | Update automation rule |
| `getExecutionLogs` | 798 | Get execution logs for a workflow or all workflows |
| `getExecutionById` | 867 | Get execution by ID |

</details>

<details><summary><code>services/boardManagementService.ts</code> — 20 個方法</summary>

| 方法 | 行 | 說明 |
|---|---|---|
| `getCurrentBoardMembers` | 44 | Get current active board members |
| `getAllBoardMembers` | 92 | Get all board members across all years in a single query, then group by term in memory |
| `getBoardMembersByYear` | 114 | Get board members for a specific year |
| `createBoardTransition` | 135 | Create a new board transition |
| `executeBoardTransition` | 188 | Execute board transition |
| `getBoardTransitionHistory` | 455 | Get board transition history |
| `getRolePermissions` | 480 | Get role-based permissions |
| `getDefaultBoardPositions` | 541 | Default board positions for each term (can be used by UI for dropdowns) |
| `setBoardForTerm` | 564 | Set board of directors for a given term (year). Deactivates existing board members for that term and creates n… |
| `clearMemberCurrentBoardStatus` | 705 | Clear current-board fields on a member (used when term ends or assignment removed). |
| `syncCurrentYearBoardAssignees` | 843 | Push current-year boardMembers assignments onto member docs (fixes legacy data). |
| `ensureMemberBoardFieldsSynced` | 908 | Self-heal: if boardMembers shows an active current-year position but member doc is out of sync, fix it. Return… |
| `getBoardTermSettings` | 966 | ─── Presidential Term Settings ────────────────────────────────────────── |
| `setBoardTermSettings` | 989 |  |
| `transitionBoardMembers` | 1010 | Legacy methods for backward compatibility |
| `assignBoardMembers` | 1109 | Assign new board members for a year |
| `getBoardComposition` | 1176 | Get board composition for a specific year |
| `getMemberBoardPositions` | 1201 | Get all board positions for a specific member (queries boardMembers collection directly) |
| `getMemberCommissionDirectorPositions` | 1226 | Get all board records where a member serves as a Commission Director |
| `getMemberBoardHistory` | 1251 | Get board history for a member |

</details>

<details><summary><code>services/contractService.ts</code> — 6 個方法</summary>

| 方法 | 行 | 說明 |
|---|---|---|
| `signContract` | 54 | Create a new commitment contract (The self-bet) FIX P0-A: Steps 2 + 3 are now combined in a single writeBatch … |
| `getMemberContracts` | 127 | Get active contracts for a member |
| `verifyContract` | 143 | Submit proof for verification (moves contract to Verifying state) FIX P1-B: verifyContract now writes verified… |
| `enforcePenalty` | 177 | Fail evaluation (The penalty) This would normally be called by a CRON job or an Admin FIX P1-C: failurePenalty… |
| `fulfillContract` | 244 | Fulfill evaluation (The reward) P1 FIX: Steps are reordered so the escrow-release + contract-status-FULFILLED … |
| `deleteContract` | 316 | Admin delete of a contract — cascades to release (or close) any linked pointEscrow record so points are never … |

</details>

<details><summary><code>services/documentsService.ts</code> — 10 個方法</summary>

| 方法 | 行 | 說明 |
|---|---|---|
| `invalidateDocumentsCache` | 83 |  |
| `getAllDocuments` | 92 | Get all documents |
| `getDocumentById` | 148 | Get document by ID |
| `getDocumentVersions` | 175 | Get document versions |
| `createDocument` | 199 | Create document — adds parent doc + initial version in one batch |
| `createDocumentVersion` | 251 | Create document version — batch: mark old current→false, add new version, update parent |
| `updateVersionUrl` | 293 | Update a specific version's fileUrl (e.g. inline edit from UI) |
| `updateDocument` | 309 | Update document metadata |
| `deleteDocument` | 330 | Delete document — batch-delete all versions + parent in one commit P1 fix: also delete Storage files for each … |
| `restoreVersion` | 376 | Restore previous version — delegates to createDocumentVersion (already batched) P1 fix: use runTransaction to … |

</details>

<details><summary><code>services/hobbyClubsService.ts</code> — 13 個方法</summary>

| 方法 | 行 | 說明 |
|---|---|---|
| `invalidateClubsCache` | 35 | Invalidate all hobby-clubs cache entries after any write. |
| `getAllClubs` | 42 | Get all clubs |
| `getClubsForExternal` | 70 | Clubs visible to externals (other chapters): openToExternals == true only (firestore.rules hobbyClubs read). S… |
| `getClubById` | 96 | Get club by ID |
| `createClub` | 122 | Create club |
| `updateClub` | 151 | Update club |
| `deleteClub` | 174 | Soft-delete a club by setting isDeleted: true. Hard deletion is avoided to prevent stale memberIds references … |
| `getClubsByCategory` | 194 | Get clubs by category |
| `getActivities` | 232 | Read a club's activities (non-transactional convenience helper) |
| `addActivity` | 242 | P1 fix: Add a club activity. Uses runTransaction so the read → modify → write is atomic; concurrent modificati… |
| `updateActivity` | 279 | P1 fix: Update a club activity. Uses runTransaction to prevent read/write races. |
| `deleteActivity` | 312 | P1 fix: Delete a club activity. Uses runTransaction to prevent read/write races. |
| `scheduleActivity` | 339 |  |

</details>

<details><summary><code>services/permissionConfigService.ts</code> — 0 個方法、2 個函數/常數</summary>


**其他 export：** `permissionRuleId` (L60), `PermissionConfigService` (L104)

</details>

<details><summary><code>services/sisterChaptersService.ts</code> — 4 個方法</summary>

| 方法 | 行 | 說明 |
|---|---|---|
| `getAll` | 19 |  |
| `create` | 41 |  |
| `update` | 49 |  |
| `delete` | 56 |  |

</details>

<details><summary><code>services/templatesService.ts</code> — 13 個方法</summary>

| 方法 | 行 | 說明 |
|---|---|---|
| `getAllEventTemplates` | 75 | Get all event templates |
| `getEventTemplateById` | 135 | Get template by ID |
| `createEventTemplate` | 164 | Create event template |
| `updateEventTemplate` | 196 | Update event template |
| `deleteEventTemplate` | 216 | Delete event template |
| `getAllActivityPlanTemplates` | 232 | Activity Plan Templates |
| `createActivityPlanTemplate` | 274 |  |
| `updateActivityPlanTemplate` | 296 |  |
| `deleteActivityPlanTemplate` | 315 |  |
| `getAllEventBudgetTemplates` | 331 | Event Budget Templates |
| `createEventBudgetTemplate` | 377 |  |
| `updateEventBudgetTemplate` | 399 |  |
| `deleteEventBudgetTemplate` | 418 |  |

</details>

<details><summary><code>services/workflowService.ts</code> — 8 個方法</summary>

| 方法 | 行 | 說明 |
|---|---|---|
| `getAllWorkflows` | 71 | ─── Get all workflows ─────────────────────────────────────────────────────── |
| `getWorkflowById` | 110 | ─── Get workflow by ID ────────────────────────────────────────────────────── |
| `createWorkflow` | 138 | ─── Create workflow ───────────────────────────────────────────────────────── P2-E: accepts optional status, d… |
| `updateWorkflow` | 176 | ─── Update workflow ───────────────────────────────────────────────────────── |
| `deleteWorkflow` | 196 | ─── Delete workflow ───────────────────────────────────────────────────────── P1: cascade-archives all workflo… |
| `executeWorkflow` | 242 | ─── Execute workflow ──────────────────────────────────────────────────────── P0-A: idempotency guard prevents… |
| `getExecutionLogs` | 738 | ─── Execution logs ────────────────────────────────────────────────────────── P1: restricted to BOARD / ADMIN … |
| `getExecutionById` | 790 | ─── Get single execution ──────────────────────────────────────────────────── |

</details>

### 2.6 溝通與行銷 Communication & Marketing

| Service | 行數 | 引用 | 用途 | 集合 |
|---|---|---|---|---|
| `advertisementService.ts` | 422 | 11 | Advertisement & Promotions Service | ADVERTISEMENTS, BENEFIT_USAGE, PROMOTION_PACKAGES |
| `businessDirectoryService.ts` | 248 | 1 | Business Directory Service - CRUD Operations | MEMBERS, PUBLIC_BUSINESS_LISTINGS |
| `communicationService.ts` | 651 | 9 | Communication Service - CRUD Operations | COMMUNICATION, NOTIFICATIONS, SYSTEM_CONFIG |
| `emailService.ts` | 442 | 2 | Email Service - Email Integration Service | EMAIL_LOGS |
| `guestAnalyticsService.ts` | 142 | 4 | ⚠️ 無說明 | GUEST_PAGE_STATS |
| `inquiryService.ts` | 232 | 1 | ⚠️ 無說明 | INQUIRIES |
| `knowledgeService.ts` | 331 | 1 | Knowledge & Learning Service - CRUD Operations Fixes applied: P1 – isDevMode() guard on every write path P1 – cacheService.getOrSet on every… | DOCUMENTS, LEARNING_PATHS, LEARNING_PROGRESS, TRAINING_MODULES |
| `larkSyncService.ts` | 51 | 1 | ⚠️ 無說明 | — |
| `notificationService.ts` | 98 | 1 | ⚠️ 無說明 | MEMBERS |
| `partnershipsService.ts` | 245 | 2 | ⚠️ 無說明 | ADVERTISEMENTS |
| `publicationService.ts` | 236 | 3 | Publications Service — manages E-Newsletter issues shown on the Guest Publications page | PUBLICATIONS |
| `socialPersonaService.ts` | 52 | 1 | ⚠️ 無說明 | SOCIAL_PERSONAS |
| `socialPostService.ts` | 182 | 2 | ⚠️ 無說明 | SOCIAL_POSTS |
| `surveyAnalyticsService.ts` | 256 | 2 | Survey Analytics Service - Analyzes survey responses and generates statistics | — |
| `surveysService.ts` | 476 | 7 | Surveys Service - CRUD Operations | SURVEYS, SURVEY_RESPONSES |
| `webhookService.ts` | 546 | 2 | Webhook Configuration Service | SYSTEM_LOGS, WEBHOOKS, WEBHOOK_LOGS |

<details><summary><code>services/advertisementService.ts</code> — 11 個方法</summary>

| 方法 | 行 | 說明 |
|---|---|---|
| `invalidateAdsCache` | 131 | ── Cache helpers ────────────────────────────────────────────────────────── |
| `invalidatePackagesCache` | 135 |  |
| `getAllAdvertisements` | 140 | ── Get all advertisements ───────────────────────────────────────────────── |
| `getActiveAdvertisements` | 168 | ── Get active advertisements for a placement ────────────────────────────── |
| `recordImpression` | 221 | ── Record impression (fire-and-forget, no cache clear needed) ───────────── |
| `recordClick` | 237 | ── Record click (fire-and-forget, no cache clear needed) ────────────────── |
| `createAdvertisement` | 254 | ── Create advertisement ─────────────────────────────────────────────────── FIX P1: all Advertisement fields a… |
| `updateAdvertisement` | 300 | ── Update advertisement ─────────────────────────────────────────────────── |
| `deleteAdvertisement` | 339 | ── Delete advertisement ─────────────────────────────────────────────────── |
| `getPromotionPackages` | 355 | ── Get promotion packages ───────────────────────────────────────────────── |
| `getBenefitUsageHistory` | 387 | ── Get benefit usage history ────────────────────────────────────────────── |

</details>

<details><summary><code>services/businessDirectoryService.ts</code> — 5 個方法、1 個函數/常數</summary>

| 方法 | 行 | 說明 |
|---|---|---|
| `syncPublicListing` | 114 |  |
| `getAllBusinesses` | 147 |  |
| `getBusinessById` | 193 |  |
| `searchBusinesses` | 223 |  |
| `getBusinessesByIndustry` | 233 |  |

**其他 export：** `mapMemberToBusinessProfile` (L37)

</details>

<details><summary><code>services/communicationService.ts</code> — 15 個方法</summary>

| 方法 | 行 | 說明 |
|---|---|---|
| `getAllPosts` | 30 | Get all posts |
| `createPost` | 59 | Create post |
| `updatePost` | 87 | Update post |
| `deletePost` | 109 | Delete post |
| `likePost` | 126 | Like post |
| `getNotifications` | 147 | Get notifications |
| `markNotificationAsRead` | 176 | Mark notification as read |
| `deleteNotification` | 195 |  |
| `markAllAsRead` | 220 | Mark all notifications as read for a member |
| `createNotification` | 249 | Create notification |
| `bulkCreateNotifications` | 274 | Bulk create notifications using writeBatch for atomic delivery. Chunks into pages of 499 to stay under the Fir… |
| `sendEmailNotification` | 303 | Send email notification |
| `sendBulkEmailNotifications` | 349 | Send bulk email notifications |
| `createAnnouncement` | 406 | Create and distribute announcement |
| `processDailyBirthdays` | 562 | Processes daily birthday notifications at 1 PM. Checks if today's birthdays have already been processed and if… |

</details>

<details><summary><code>services/emailService.ts</code> — 6 個方法</summary>

| 方法 | 行 | 說明 |
|---|---|---|
| `initialize` | 66 | Initialize email service with configuration |
| `sendEmail` | 78 | Send email |
| `updateEmailLogStatus` | 288 | P1 fix: Update delivery/open/click status fields on an existing email log. Called by webhook handlers (e.g. Se… |
| `getEmailLogs` | 332 | Get email logs |
| `sendBulkEmails` | 378 | Send bulk emails |
| `sendTemplatedEmail` | 417 | Send email with template |

</details>

<details><summary><code>services/guestAnalyticsService.ts</code> — 4 個方法、2 個函數/常數</summary>

| 方法 | 行 | 說明 |
|---|---|---|
| `trackPageView` | 73 | Record one page view. |
| `trackDwell` | 78 | Record dwell time (seconds) on a page. Ignores blips (<1s) and caps runaway sessions at 30 min. |
| `trackSignupClick` | 85 | Record a click on a Sign Up / Register CTA. |
| `getSummary` | 90 | Aggregate stats over the last `days` days, one row per guest page. |

**其他 export：** `GUEST_PAGE_LABELS` (L12), `pathToGuestPage` (L22)

</details>

<details><summary><code>services/inquiryService.ts</code> — 0 個方法、1 個函數/常數</summary>


**其他 export：** `submitInquiry` (L143)

</details>

<details><summary><code>services/knowledgeService.ts</code> — 12 個方法</summary>

| 方法 | 行 | 說明 |
|---|---|---|
| `invalidateTrainingModulesCache` | 40 | ── Cache helpers ────────────────────────────────────────────────────────── |
| `getAllTrainingModules` | 47 | Get all training modules |
| `getTrainingModuleById` | 71 | Get training module by ID |
| `createTrainingModule` | 90 | Create training module Note: completionStatus is a per-member concept — it must NOT be stored on the module do… |
| `updateTrainingModule` | 113 | Update training module completionStatus is stripped — it must go through markModuleComplete() instead. |
| `deleteTrainingModule` | 138 | Soft-delete a training module and remove its ID from any learning paths that reference it. Hard-deleting would… |
| `markModuleComplete` | 186 | Mark a specific module as complete for a member. Completion state is per-member — it is stored in LEARNING_PRO… |
| `getMemberModuleCompletions` | 242 | Get per-member completion status for a set of module IDs. Returns a map of moduleId → completionStatus. |
| `getAllDocuments` | 269 | Get all documents |
| `createDocument` | 291 | Create document |
| `deleteDocument` | 311 | Delete document |
| `searchTrainingModules` | 322 | Search training modules |

</details>

<details><summary><code>services/larkSyncService.ts</code> — 1 個方法</summary>

| 方法 | 行 | 說明 |
|---|---|---|
| `syncRecord` | 17 |  |

</details>

<details><summary><code>services/notificationService.ts</code> — 0 個方法、3 個函數/常數</summary>


**其他 export：** `registerPushNotifications` (L34), `unregisterPushNotifications` (L69), `onForegroundMessage` (L84)

</details>

<details><summary><code>services/partnershipsService.ts</code> — 5 個方法</summary>

| 方法 | 行 | 說明 |
|---|---|---|
| `invalidatePartnershipsCache` | 79 |  |
| `getAllPartnerships` | 91 | Get all partnerships (mapped from the advertisements collection). Active-only filter is applied client-side af… |
| `createPartnership` | 148 | Create a new partnership record. FIX P0: writes to COLLECTIONS.ADVERTISEMENTS (same as getAllPartnerships read… |
| `updatePartnership` | 196 | Update an existing partnership. FIX P0: updates COLLECTIONS.ADVERTISEMENTS (same collection as reads). |
| `deletePartnership` | 229 | Delete a partnership. FIX P0: deletes from COLLECTIONS.ADVERTISEMENTS (same collection as reads). |

</details>

<details><summary><code>services/publicationService.ts</code> — 6 個方法、3 個函數/常數</summary>

| 方法 | 行 | 說明 |
|---|---|---|
| `invalidatePublicationsCache` | 100 |  |
| `getAll` | 105 | Fetch all publications, ordered by year (desc) then sortOrder (asc). |
| `getPublished` | 144 | Fetch only Published publications (for guest-facing page). FIX P1: uses a Firestore where('status','==','Publi… |
| `create` | 179 | Create a new publication. Returns the new document ID. |
| `update` | 202 | Update an existing publication by ID. |
| `delete` | 221 | Delete a publication by ID. |

**其他 export：** `extractGoogleDriveFileId` (L41), `toGoogleDrivePreviewUrl` (L56), `isValidGoogleDriveUrl` (L65)

</details>

<details><summary><code>services/socialPersonaService.ts</code> — 3 個方法</summary>

| 方法 | 行 | 說明 |
|---|---|---|
| `getAllPersonas` | 14 |  |
| `getPersona` | 33 |  |
| `upsertPersona` | 42 |  |

</details>

<details><summary><code>services/socialPostService.ts</code> — 12 個方法</summary>

| 方法 | 行 | 說明 |
|---|---|---|
| `createPost` | 61 |  |
| `updatePost` | 87 |  |
| `submitForReview` | 92 |  |
| `approvePost` | 98 |  |
| `rejectPost` | 109 |  |
| `schedulePost` | 120 |  |
| `markPublished` | 126 |  |
| `getMyPosts` | 136 |  |
| `getAllPosts` | 143 |  |
| `getPostsByStatus` | 150 |  |
| `deletePost` | 157 |  |
| `aiRewrite` | 163 |  |

</details>

<details><summary><code>services/surveyAnalyticsService.ts</code> — 2 個方法</summary>

| 方法 | 行 | 說明 |
|---|---|---|
| `generateAnalytics` | 45 | Generate comprehensive analytics for a survey |
| `exportAnalyticsAsCSV` | 179 | Export analytics as CSV |

</details>

<details><summary><code>services/surveysService.ts</code> — 10 個方法</summary>

| 方法 | 行 | 說明 |
|---|---|---|
| `getAllSurveys` | 107 | Get all surveys |
| `getSurveysForExternal` | 126 | Surveys an external (other-chapter) user may read: targeted to them, or open to externals and Active. Two quer… |
| `getSurveyById` | 156 | Get survey by ID |
| `createSurvey` | 175 | Create survey |
| `updateSurvey` | 199 | Update survey |
| `deleteSurvey` | 227 | Delete survey — also batch-deletes all associated responses P1 fix: chunk deletes in batches of 400 to stay we… |
| `submitResponse` | 262 | Submit survey response — uses runTransaction to prevent duplicate submissions and to atomically increment resp… |
| `getSurveyResponses` | 318 | Get survey responses |
| `getMemberResponses` | 343 | Get survey responses submitted by a specific member (P0 fix: non-admin owner-scoped listing) Always adds where… |
| `distributeSurvey` | 373 | Distribute survey — sends in-app notifications to target members |

</details>

<details><summary><code>services/webhookService.ts</code> — 11 個方法</summary>

| 方法 | 行 | 說明 |
|---|---|---|
| `getAllWebhooks` | 59 | Get all webhooks |
| `getWebhookById` | 92 | Get webhook by ID |
| `createWebhook` | 129 | Create webhook |
| `updateWebhook` | 162 | Update webhook P1 fix: only pass the fields that Firestore rules allow via hasOnly([]); strip runtime-managed … |
| `deleteWebhook` | 192 | Delete webhook P1: cascade-delete webhook_logs before removing the parent webhook document. |
| `triggerWebhook` | 225 | Trigger webhook — NOTE: browser-side HTTP is blocked by CORS on most receivers. Move to netlify/functions/trig… |
| `logWebhookExecution` | 354 | Log webhook execution P0 fix: BOARD users can invoke triggerWebhook but Firestore rules only allow isAdmin() t… |
| `getWebhookLogs` | 382 | Get webhook logs |
| `testWebhook` | 425 | Test webhook |
| `createSystemLogCleanupJob` | 447 | Cleanup utility: batch-delete systemLogs documents older than 90 days. Call this manually from an ADMIN / SUPE… |
| `purgeOldWebhookLogs` | 481 | Cleanup utility: batch-delete webhook_logs documents older than the given days (default 90). Call this manuall… |

</details>

### 2.7 基礎設施 Infrastructure

| Service | 行數 | 引用 | 用途 | 集合 |
|---|---|---|---|---|
| `aiPredictionService.ts` | 949 | 3 | AI Prediction Service - Advanced AI predictions for events, projects, and sponsors | — |
| `cacheService.ts` | 314 | 35 | 缓存服务 - 提供内存缓存和本地存储缓存功能 Cache Service - Provides in-memory and localStorage caching capabilities | — |
| `cloudinaryService.ts` | 337 | 14 | Cloudinary Upload Service | — |
| `dataImportExportService.ts` | 913 | 3 | ⚠️ 無說明 | EVENTS, MEMBERS, MEMBER_EMAILS |
| `errorLoggingService.ts` | 354 | 74 | ⚠️ 無說明 | ERROR_LOGS |
| `firestoreLogger.ts` | 197 | 3 | System Logger — Firestore ops + Performance monitoring Fire-and-forget buffered logger. Buffers events for 3 seconds then writes one batched… | SYSTEM_LOGS |
| `inventoryService.ts` | 1,638 | 3 | Inventory Service - CRUD Operations | INVENTORY, INVENTORY_ALERTS, MAINTENANCE_SCHEDULES, STOCK_MOVEMENTS, TRANSACTIONS |
| `mockData.ts` | 689 | 17 | ⚠️ 無說明 | — |
| `postcodeService.ts` | 116 | 2 | ⚠️ 無說明 | POSTCODES |

<details><summary><code>services/aiPredictionService.ts</code> — 6 個方法</summary>

| 方法 | 行 | 說明 |
|---|---|---|
| `predictEventDemand` | 109 | Predict event demand |
| `predictProjectSuccess` | 202 | Predict project success |
| `matchSponsors` | 325 | Match sponsors to projects |
| `analyzeSentiment` | 395 | Analyze sentiment from text |
| `predictMemberChurn` | 558 | Predict member churn risk |
| `getPersonalizedRecommendations` | 692 | Get personalized recommendations for a member |

</details>

<details><summary><code>services/cacheService.ts</code> — 0 個方法、1 個函數/常數</summary>


**其他 export：** `stopCacheCleanup` (L311)

</details>

<details><summary><code>services/cloudinaryService.ts</code> — 0 個方法、14 個函數/常數</summary>


**其他 export：** `trimCloudinaryImage` (L9), `resizeCloudinaryImage` (L19), `getMemberAvatarKey` (L58), `getMemberAvatarFolder` (L65), `uploadMemberAvatarToCloudinary` (L69), `uploadBoardAvatarToCloudinary` (L89), `uploadPresidentialLogoToCloudinary` (L108), `uploadMemberGroupPhotoToCloudinary` (L124), `uploadMemberOfferLogoToCloudinary` (L141), `uploadMemberOfferBannerToCloudinary` (L156), `uploadBodGroupPhotoToCloudinary` (L171), `uploadToCloudinary` (L196), `getPublicIdFromUrl` (L279), `deleteFromCloudinary` (L300)

</details>

<details><summary><code>services/dataImportExportService.ts</code> — 8 個方法</summary>

| 方法 | 行 | 說明 |
|---|---|---|
| `parseFile` | 67 | Parse uploaded file and extract data |
| `parseCSVContent` | 134 | Parse CSV content string |
| `validateData` | 156 | Validate imported data |
| `importData` | 330 | Import data after validation |
| `exportToCSV` | 607 | Export data to CSV format |
| `exportToJSON` | 640 | Export data to JSON (Story 6.1 â€“ ä¸»æ¡£å¯¼å‡ºçº¦å®šæ ¼å¼) |
| `exportToExcel` | 661 | Export data to Excel format |
| `generateImportTemplate` | 703 | Generate import template |

</details>

<details><summary><code>services/errorLoggingService.ts</code> — 0 個方法、4 個函數/常數</summary>


**其他 export：** `logError` (L331), `logWarning` (L334), `logInfo` (L337), `useErrorLogging` (L341)

</details>

<details><summary><code>services/firestoreLogger.ts</code> — 0 個方法、7 個函數/常數</summary>


**其他 export：** `logRead` (L146), `logWrite` (L150), `logDelete` (L154), `logListener` (L158), `logPerf` (L168), `logError` (L177), `startPerf` (L190)

</details>

<details><summary><code>services/inventoryService.ts</code> — 37 個方法</summary>

| 方法 | 行 | 說明 |
|---|---|---|
| `getAllItems` | 58 | Get all inventory items |
| `getItemById` | 86 | Get item by ID |
| `getItemsByCategory` | 113 | Get items by category |
| `addItem` | 137 | Add new item |
| `updateItem` | 159 | Update item |
| `deleteItem` | 180 | Delete item |
| `getLowStockItems` | 208 | Get low stock items |
| `getMaintenanceSchedules` | 225 | Get maintenance schedules |
| `getInventoryAlerts` | 279 | Get inventory alerts |
| `createAlert` | 334 | Create inventory alert |
| `generateAlerts` | 355 | Generate alerts for low stock and maintenance P0 FIX: restrict to BOARD+ callers; callerRole is required in pr… |
| `linkTransactionToInventory` | 482 | Link a financial transaction to an inventory item This creates a relationship between financial transactions a… |
| `recordMerchandisePurchase` | 517 | Record merchandise purchase (increases inventory) |
| `recordMerchandiseSale` | 569 | Record merchandise sale (decreases inventory) |
| `verifyInventoryFinanceConsistency` | 624 | Validates that inventory records match financial transaction records |
| `getMerchandiseItems` | 693 | Get all merchandise items (items in Merchandise category) |
| `reconcileMerchandiseInventory` | 706 | Reconcile merchandise inventory with financial records Returns discrepancies between inventory and financial d… |
| `getItemsWithDepreciation` | 782 | Get items with depreciation calculations |
| `calculateDepreciation` | 810 | Calculate depreciation for a single item |
| `createItem` | 831 | Create new item |
| `checkOutItem` | 836 | Check out item |
| `checkInItem` | 886 | Check in item |
| `getAlerts` | 935 | Get alerts with filtering |
| `createMaintenanceSchedule` | 940 | Create maintenance schedule |
| `updateMaintenanceSchedule` | 974 | Update maintenance schedule |
| `completeMaintenance` | 1011 | Complete maintenance |
| `acknowledgeAlert` | 1077 | Acknowledge alert |
| `checkAndGenerateAlerts` | 1097 | Check and generate alerts |
| `updateItemDepreciation` | 1102 | Update item depreciation |
| `updateVariantQuantity` | 1128 | Update quantity of a specific variant (size) operation: 'increment' (for purchases/restock) or 'decrement' (fo… |
| `hasStockMovementForRef` | 1194 | Check if a stock movement exists for a given reference ID (e.g. transaction ID) |
| `updateStockMovementForRef` | 1226 | Append-only replacement for the former updateStockMovementForRef. Instead of mutating the original movement do… |
| `compensateStockMovement` | 1363 | Compensate (reverse) a specific stock movement by its document ID. Writes a new movement with negated quantity… |
| `deleteStockMovementForRef` | 1440 | Delete stock movement for a reference (reverting inventory) |
| `recordStockMovement` | 1497 | Record a stock movement — atomically updates both the movement log and the inventoryItems.quantity field so th… |
| `getStockCard` | 1544 | Get stock card (movements) for an item |
| `adjustStock` | 1576 | Manual stock adjustment |

</details>

<details><summary><code>services/mockData.ts</code> — 0 個方法、3 個函數/常數</summary>


**其他 export：** `CURRENT_USER` (L3), `MOCK_STATS` (L34), `MOCK_DEV_ADMIN` (L44)

</details>

<details><summary><code>services/postcodeService.ts</code> — 5 個方法</summary>

| 方法 | 行 | 說明 |
|---|---|---|
| `getAll` | 30 | --------------------------------------------------------------------------- Read -----------------------------… |
| `upsert` | 48 | --------------------------------------------------------------------------- Write ----------------------------… |
| `deleteEntry` | 55 |  |
| `seed` | 64 | --------------------------------------------------------------------------- Seed — batch-write static data to … |
| `resolveArea` | 85 | --------------------------------------------------------------------------- Resolve — Firestore first, static … |

</details>

### 2.8 其他 Other

| Service | 行數 | 引用 | 用途 | 集合 |
|---|---|---|---|---|
| `chapterBirthdaysService.ts` | 46 | 1 | Own-chapter birthdays for external users: calls the Netlify function chapter-birthdays (read-only). | — |
| `externalAccountsService.ts` | 162 | 3 | External (sister-chapter) accounts. Writes go through the Netlify function external-accounts (uid = member doc id); reads (chapter roster, K… | MEMBERS |
| `jciMalaysiaSyncService.ts` | 168 | 2 | In-app JCI Malaysia sync (developer accounts only). Everything runs in the Netlify function jci-malaysia-sync: the source key, the overrides… | — |
| `malaysiaHolidaysService.ts` | 48 | 1 | Malaysia public holidays for the calendar. Fetched from the Netlify function `malaysia-holidays` (which proxies Calendarific with a server-s… | — |
| `reportService.ts` | 615 | 2 | ⚠️ 無說明 | — |

<details><summary><code>services/chapterBirthdaysService.ts</code> — 1 個方法</summary>

| 方法 | 行 | 說明 |
|---|---|---|
| `getForMonth` | 21 | Birthdays in `month` (1-12) among active members of the signed-in external user's own chapter. |

</details>

<details><summary><code>services/externalAccountsService.ts</code> — 8 個方法</summary>

| 方法 | 行 | 說明 |
|---|---|---|
| `invalidateCache` | 86 | Server wrote member docs / cards: drop cached member lists (all + per-LO keys), cards, and our own lists. |
| `getChapterMembers` | 96 | All member docs of one chapter (any status), sorted by name. No orderBy: self-registered docs carry no updated… |
| `getPendingKlApprovals` | 110 | KL admins: external members waiting for KL approval (affiliation.status == 'pending_kl'), all chapters. |
| `createChapterAdmins` | 124 | KL ADMIN / SUPER_ADMIN: create CHAPTER_ADMIN accounts for a sister chapter (1–20 per call). |
| `inviteMembers` | 133 | Invite AFFILIATE members (active immediately). A chapter admin's own chapter is enforced by the server (loId i… |
| `setStatus` | 139 | Change an external member's affiliation status (server checks the transition table and syncs the card). |
| `resendInvite` | 145 | Send the password setup email again. Returns whether the email was sent. |
| `deleteAccount` | 156 | PERMANENT: delete an external account (member doc, email slot, card, email-change request, public listing, the… |

</details>

<details><summary><code>services/jciMalaysiaSyncService.ts</code> — 3 個方法</summary>

| 方法 | 行 | 說明 |
|---|---|---|
| `preview` | 145 | The plan: counts, changes (before/after), conflicts with candidates A/B, other chapter, not found. |
| `pick` | 151 | Save a manual pick for one conflict (server validates the source record). |
| `apply` | 160 | Apply: the server recomputes the plan for the selected fields, backs up old values, writes, audits. No plan is… |

</details>

<details><summary><code>services/malaysiaHolidaysService.ts</code> — 1 個方法</summary>

| 方法 | 行 | 說明 |
|---|---|---|
| `getHolidays` | 26 | Public holidays for one year. Resolves to [] on any failure (never throws). |

</details>

<details><summary><code>services/reportService.ts</code> — 10 個方法</summary>

| 方法 | 行 | 說明 |
|---|---|---|
| `generateFinancialReport` | 66 | Generate financial report |
| `generateMembershipReport` | 134 | Generate membership report |
| `generateEngagementReport` | 203 | Generate engagement report |
| `generateProjectReport` | 277 | Generate project report |
| `generateMykdReport` | 340 | Generate MYKD (ROY) member report |
| `exportMykdToCSV` | 417 | Export MYKD rows to CSV |
| `exportReportToCSV` | 427 | Export report to CSV |
| `exportReportToJSON` | 471 | Export report to JSON |
| `generateInventoryReport` | 541 | Generate inventory report |
| `convertToCSV` | 610 | Convert report to CSV format |

</details>

## 3. Hook 層

> **依賴 Service**＝此 hook 包裝了哪些 service。需要資料時，優先找現成 hook，而不是在元件內直接呼叫 service。

| Hook 檔案 | 行數 | 引用 | Export | 依賴 Service | 說明 |
|---|---|---|---|---|---|
| `useActivityPlans.ts` | 130 | 1 | `useActivityPlans` | activityPlansService | ⚠️ 無說明 |
| `useAdvertisements.ts` | 111 | 2 | `useAdvertisements` | advertisementService, errorLoggingService | Advertisements Data Hook |
| `useAppNavigation.ts` | 239 | 1 | `useAppNavigation` | — | ⚠️ 無說明 |
| `useAuth.tsx` | 880 | 63 | `AuthProvider`, `useAuth` | boardManagementService, errorLoggingService, memberCardsService, membersService, mockData | Authentication Hook |
| `useAutomation.ts` | 149 | 3 | `useAutomation` | automationService | useAutomation Hook - Manage automation workflows and rules |
| `useBusinessDirectory.ts` | 51 | 4 | `useBusinessDirectory` | businessDirectoryService | ⚠️ 無說明 |
| `useChapterBirthdays.ts` | 23 | 1 | `useChapterBirthdays` | chapterBirthdaysService | Own-chapter birthdays for an active external user (dashboard birthday widget). `month` null → nothing loads. |
| `useChapterMembers.ts` | 87 | 2 | `useChapterMembers`, `usePendingKlApprovals` | externalAccountsService | Chapter roster for an active CHAPTER_ADMIN (own chapter) and the KL approval queue (pending_kl, KL admins). Status changes / invites go thro… |
| `useCommunication.ts` | 123 | 2 | `useCommunication` | communicationService | Communication Data Hook |
| `useEventRegBackfill.ts` | 48 | 1 | `useEventRegBackfill` | eventRegBackfillService | Developer-only back-fill of missing eventRegistrations from JCI Malaysia: preview then background apply. |
| `useEventRegcodeSync.ts` | 56 | 1 | `useEventRegcodeSync` | eventRegcodeService | Developer-only back-fill of JCI Malaysia regcodes onto eventRegistrations: preview then apply. The server enforces developer-only. |
| `useEvents.ts` | 191 | 8 | `useEvents` | errorLoggingService, eventsService, membersService | Events Data Hook |
| `useExternalAccounts.ts` | 52 | 1 | `useExternalAccounts` | externalAccountsService, membersService | External (sister-chapter) account actions for components: create chapter admins, invite, status, resend. |
| `useFinanceData.ts` | 2,034 | 4 | `useFinanceData` | errorLoggingService, financeService, inventoryService, membersService, membershipConfigService, paymentRequestService, projectFinancialService, projectsService | TODO (PERF-A-004): This hook has ~90 useState declarations, causing full FinanceView re-renders on any state update. Planned refactor: split… |
| `useFirestoreCollection.ts` | 171 | 18 | `useFirestoreCollection` | — | ⚠️ 無說明 |
| `useGamification.ts` | 148 | 1 | `useGamification` | gamificationService | useGamification.ts - Unified Hook for Awards (Achievements + Badges) |
| `useGuestAnalytics.ts` | 21 | 0 | `useGuestAnalytics` | guestAnalyticsService | ⚠️ 無說明 |
| `useHobbyClubs.ts` | 132 | 2 | `useHobbyClubs` | hobbyClubsService | ⚠️ 無說明 |
| `useInstallPrompt.ts` | 47 | 1 | `useInstallPrompt` | — | ⚠️ 無說明 |
| `useInventory.ts` | 232 | 2 | `useInventory` | inventoryService | Inventory Data Hook |
| `useJciMalaysiaSync.ts` | 67 | 1 | `useJciMalaysiaSync` | jciMalaysiaSyncService | JCI Malaysia sync for components: preview, save a conflict pick, apply. The server enforces developer-only. |
| `useKnowledge.ts` | 68 | 1 | `useKnowledge` | knowledgeService | ⚠️ 無說明 |
| `useLearningPaths.ts` | 83 | 1 | `useLearningPaths` | learningPathsService | Learning Paths Data Hook |
| `useMemberAuth.ts` | 36 | 2 | `useMemberAuth` | memberAuthService | 会员登录账号：导入后自动建立（ADMIN+），以及 Fix Auth 试跑 / 执行补建（仅 SUPER_ADMIN）。 |
| `useMemberBenefits.ts` | 102 | 0 | `useMemberBenefits` | memberBenefitsService | Member Benefits Data Hook Wraps MemberBenefitsService with React state (loading / error / data). |
| `useMemberMutations.ts` | 107 | 0 | `useMemberMutations` | membersService | ⚠️ 無說明 |
| `useMemberSearch.ts` | 53 | 1 | `useMemberSearch` | — | ⚠️ 無說明 |
| `useMembers.ts` | 195 | 20 | `useMembers`, `usePaginatedMembers` | membersService | Members Data Hook |
| `useNotifications.ts` | 107 | 0 | `useNotifications` | communicationService, errorLoggingService, mockData | ⚠️ 無說明 |
| `usePermissions.ts` | 212 | 34 | `usePermissions` | — | Permission Management Hook |
| `usePoints.ts` | 61 | 2 | `usePoints` | pointsService | Points Data Hook |
| `useProjects.ts` | 170 | 7 | `useProjects` | projectsService | Projects Data Hook |
| `usePushNotifications.ts` | 63 | 0 | `usePushNotifications` | — | ⚠️ 無說明 |
| `useSenatorshipSync.ts` | 56 | 1 | `useSenatorshipSync` | senatorshipSyncService | Developer-only back-fill of JCI Malaysia senator numbers onto members: preview then apply. The server enforces developer-only. |
| `useSisterChapterMembers.ts` | 95 | 2 | `useSisterChapterMembers` | memberCardsService, membersService, sisterChaptersService | ⚠️ 無說明 |
| `useSisterChapters.ts` | 26 | 6 | `useSisterChapters` | sisterChaptersService | ⚠️ 無說明 |
| `useSocialPersonas.ts` | 46 | 2 | `useSocialPersonas` | socialPersonaService | ⚠️ 無說明 |
| `useSocialPosts.ts` | 74 | 1 | `useSocialPosts` | socialPostService | ⚠️ 無說明 |
| `useSponsorships.ts` | 74 | 1 | `useSponsorships` | sponsorshipService | Sponsorships Data Hook |
| `useSurveys.ts` | 109 | 1 | `useSurveys` | surveysService | ⚠️ 無說明 |
| `useTemplates.ts` | 175 | 2 | `useTemplates` | templatesService | Templates Data Hook |
| `useToyyibMode.ts` | 34 | 2 | `useToyyibMode` | toyyibService | ⚠️ 無說明 |
| `useToyyibPay.ts` | 98 | 1 | `useToyyibCategories`, `useToyyibBills`, `useCreateBill` | toyyibService | ⚠️ 無說明 |
| `useToyyibPayment.ts` | 166 | 1 | `useToyyibPayment` | membershipConfigService, toyyibService | ⚠️ 無說明 |
| `useWebhooks.ts` | 113 | 1 | `useWebhooks` | webhookService | Webhook Management Hook |
| `useZoomBookings.ts` | 52 | 1 | `useZoomBookings` | zoomBookingService | ⚠️ 無說明 |

## 4. Util 層（純函數，優先複用）

### `utils/accountSecurity.ts` （47 行，2 處引用）
> Pure helpers for "Change password" / "Change email" on the member's own profile (hooks/useAuth does the Firebase calls).

| 函數 | 行 | 說明 |
|---|---|---|
| `validatePasswordChange` | 7 | Returns an error message, or null when the three password entries are acceptable. |
| `validateEmailChange` | 16 | Returns an error message, or null when `next` is an acceptable new login email. |
| `accountSecurityErrorMessage` | 25 | User-facing message for a Firebase Auth error code raised while reauthenticating / changing credentials. |

### `utils/activityPhase.ts` （23 行，2 處引用）

| 函數 | 行 | 說明 |
|---|---|---|
| `activityPhase` | 11 | Phase of an activity from its dates (MYT, YYYY-MM-DD strings compare as dates): completed = status "Completed"… |

### `utils/administrativeProjectsStorage.ts` （26 行，4 處引用）

| 函數 | 行 | 說明 |
|---|---|---|
| `getAdministrativeProjectIds` | 5 |  |
| `addAdministrativeProjectId` | 18 |  |

### `utils/authStorage.ts` （88 行，3 處引用）
> SEC-A-002: Store only minimal bootstrap fields — never the full Member object. The full Member record is loaded from Firestore on app start …

| 函數 | 行 | 說明 |
|---|---|---|
| `saveAuthState` | 21 | Save authentication state to localStorage |
| `loadAuthState` | 38 | Load authentication state from localStorage |
| `clearAuthState` | 53 | Clear authentication state from localStorage |
| `isDevModeStored` | 65 | Check if dev mode is enabled in localStorage |
| `setSignedInHint` | 80 |  |

### `utils/avatarUtils.ts` （8 行，2 處引用）
> Generate an inline SVG data URI with initials so avatars do not rely on external requests. URI-encoded (not btoa) so non-Latin names such as…

| 函數 | 行 | 說明 |
|---|---|---|
| `getInitialsSvg` | 3 | Generate an inline SVG data URI with initials so avatars do not rely on external requests. URI-encoded (not bt… |

### `utils/benefitEligibility.ts` （79 行，5 處引用）

| 函數 | 行 | 說明 |
|---|---|---|
| `getBenefitEligibility` | 44 | Decide whether `viewer` may redeem/claim `item`. Pure; no I/O. - audiences: missing/empty = ['kl']; the viewer… |
| `getOfferEligibility` | 73 | Eligibility of a member's own special offer (members.business.specialOffers[] or a card's specialOffers[]): th… |

### `utils/boardMembership.ts` （86 行，5 處引用）

| 函數 | 行 | 說明 |
|---|---|---|
| `isExternalOfficerPosition` | 26 | Returns true if the position falls outside the Board of Directors permission scope. Matches any position under… |
| `getCurrentBoardCalendarYear` | 32 | Calendar year used for "current board" checks. |
| `getBoardCalendarYearWithGrace` | 44 | Like getCurrentBoardCalendarYear() but accounts for the January transition window: a new board's roster may no… |
| `isActiveBoardRecordForYear` | 53 |  |
| `isMemberCurrentBoard` | 69 | Whether the member is an active board member this calendar year. Source of truth: `member.jciCareer?.isCurrent… |
| `hasActiveBoardRecordForCurrentYear` | 82 | Whether any boardMembers record is active for the current calendar year. |

### `utils/cardAccess.ts` （16 行，1 處引用）

| 函數 | 行 | 說明 |
|---|---|---|
| `canViewCards` | 9 | Reciprocity rule: a user may view other members' cards only if they share their own card (`privacy.shareCardIn… |

### `utils/clubLink.ts` （17 行，2 處引用）

| 函數 | 行 | 說明 |
|---|---|---|
| `getClubGroupLink` | 7 | The club's group chat link (WhatsApp / LINE / Discord / Telegram …) that "Join" opens, or null when none is se… |

### `utils/configAccess.ts` （24 行，4 處引用）

| 函數 | 行 | 說明 |
|---|---|---|
| `canOpenSystemConfig` | 12 |  |
| `allowedConfigTabs` | 16 | Tabs a role may open; null = all tabs (SUPER_ADMIN); [] = none. |
| `canEditChapterList` | 23 | Add / edit / delete a sister chapter or toggle it active (sisterChapters writes are SUPER_ADMIN in firestore.r… |

### `utils/dataUtils.ts` （33 行，4 處引用）
> recursivley removes undefined values from an object. Firestore does not support 'undefined' values, so this helper is essential before savin…

| 函數 | 行 | 說明 |
|---|---|---|
| `removeUndefined` | 6 | recursivley removes undefined values from an object. Firestore does not support 'undefined' values, so this he… |

### `utils/dateUtils.ts` （176 行，45 處引用）
> Date Utility Functions

| 函數 | 行 | 說明 |
|---|---|---|
| `toDate` | 5 | Helper function to convert Date | Timestamp | string to Date |
| `formatDate` | 16 |  |
| `formatDateToDDMMMYYYY` | 33 | Format a date string or Date object to "DD MMM YYYY" format (e.g., 01 Jan 1990) |
| `formatDateTime` | 65 |  |
| `formatTime` | 79 |  |
| `getRelativeTime` | 90 |  |
| `isToday` | 107 |  |
| `isPast` | 120 |  |
| `isFuture` | 125 |  |
| `getCalendarYear` | 130 |  |
| `nowMYT` | 137 | Return the current wall-clock time in Malaysia (UTC+8). |
| `getMYTYear` | 141 | Return the current year in Malaysia time (safe even at Dec 31 16:00–23:59 UTC). |
| `parseMYTDate` | 148 | Parse a date-only string (YYYY-MM-DD) as midnight MYT (UTC+8). JS's native `new Date('2024-12-31')` treats it … |
| `getMYTTodayStr` | 155 | Return today's date string in Malaysia time as "YYYY-MM-DD". Use this when you only need to compare MM-DD slic… |
| `getStartOfYear` | 163 |  |
| `getEndOfYear` | 170 |  |

### `utils/devMode.ts` （36 行，77 處引用）
> Developer Mode Utility This utility helps services detect if the app is running in developer mode and return mock data instead of accessing …

| 函數 | 行 | 說明 |
|---|---|---|
| `setDevMode` | 8 |  |
| `isDevMode` | 12 |  |
| `withDevMode` | 29 | Service helper: returns mock data in dev mode, calls the real async loader in production. Eliminates the repet… |

### `utils/externalAccess.ts` （122 行，13 處引用）

| 函數 | 行 | 說明 |
|---|---|---|
| `isExternalRole` | 13 |  |
| `EXTERNAL_ALLOWED_VIEWS` | 28 | Active externals, per role. CHAPTER_ADMIN also gets MY_CHAPTER (approvals / members / invite of own chapter). |
| `canRunLoader` | 60 | False when `loader` is KL-only and the viewer's role is external. KL roles run every loader. |
| `getExternalAllowedViews` | 90 | Views an external may open, or null when the role is not external (= no whitelist applies). A missing affiliat… |
| `isViewAllowedForRole` | 99 | True when `view` may be opened. Non-external roles are unrestricted here (their own rules still apply). |
| `getExternalStatusMessage` | 108 |  |

### `utils/fetchWithTimeout.ts` （31 行，5 處引用）
> ERR-R-005: fetch wrapper that aborts after `ms` milliseconds. Netlify functions on the free plan time out server-side after 10 s, but the br…

| 函數 | 行 | 說明 |
|---|---|---|
| `fetchWithTimeout` | 13 | ERR-R-005: fetch wrapper that aborts after `ms` milliseconds. Netlify functions on the free plan time out serv… |

### `utils/financeUtils.ts` （107 行，2 處引用）

| 函數 | 行 | 說明 |
|---|---|---|
| `getLinkedBankTxInfo` | 4 |  |
| `isTransactionInCategory` | 59 |  |
| `getTransactionAccountLabel` | 71 |  |

### `utils/formatUtils.ts` （64 行，39 處引用）
> Formatting Utility Functions

| 函數 | 行 | 說明 |
|---|---|---|
| `formatCurrency` | 2 | Formatting Utility Functions |
| `formatEventPrice` | 20 | Event price range ("From" label). MYR keeps the existing "RM 50 – 80" look; any other currency (USD for extern… |
| `formatNumber` | 27 |  |
| `formatPercentage` | 34 |  |
| `truncateText` | 38 |  |
| `capitalizeFirst` | 43 |  |
| `formatPhoneNumber` | 47 |  |
| `formatFileSize` | 56 |  |

### `utils/gamificationUtils.ts` （36 行，1 處引用）

| 函數 | 行 | 說明 |
|---|---|---|
| `calculateAwardProgress` | 8 | Pure function: calculates progress percentage (0–100) toward an award. Milestone-based awards use segment logi… |

### `utils/internationalCards.ts` （39 行，3 處引用）

| 函數 | 行 | 說明 |
|---|---|---|
| `KL_CHAPTER` | 11 | Synthetic chapter entry so KL cards resolve a chapter for externals (KL is not a `sisterChapters` doc). |
| `planCardQuery` | 19 | Which memberCards query the signed-in user may run. KL users list the active sister chapters' cards (every sis… |
| `mergeCards` | 26 | Merge card lists, keeping the first occurrence of each card id. |
| `attachSisterChapters` | 32 | Attach each card's active sister chapter; cards of unknown/inactive chapters are dropped (KL is always known). |

### `utils/malaysianIdUtils.ts` （110 行，6 處引用）
> Malaysian IC (MyKad) utilities

| 函數 | 行 | 說明 |
|---|---|---|
| `getBirthPlaceFromIC` | 68 | Derives birth place (state) from a Malaysian IC number. IC format: YYMMDDSSNNNN (12 digits, hyphens optional).… |
| `isMalaysianIC` | 78 | Returns true if the IC looks like a Malaysian MyKad (12 digits). |
| `getGenderFromIC` | 86 | Derives gender from last digit of IC: odd = Male, even = Female. |
| `getDateOfBirthFromIC` | 97 | Derives date of birth (YYYY-MM-DD) from first 6 digits of IC. Uses sliding-window century: YY <= current year'… |

### `utils/memberScope.ts` （26 行，6 處引用）

| 函數 | 行 | 說明 |
|---|---|---|
| `isKlMember` | 4 | True for KL-chapter members. Legacy docs without a loId count as KL. |
| `isCrossLoDeleteBlocked` | 12 | MembersService.deleteMember client guard: true when the caller may not soft-delete a member of another LO. Exc… |

### `utils/myPostcodes.ts` （870 行，3 處引用）
> Malaysia postcode → area/state lookup. Lookup order: exact postcode match → prefix range → keyword scan → null.

| 函數 | 行 | 說明 |
|---|---|---|
| `resolveAreaFromAddress` | 814 | Resolve area and state from a free-text Malaysian address. Returns null when no match is found. |
| `getSeedEntries` | 853 |  |

### `utils/retryOnPermissionDenied.ts` （22 行，2 處引用）
> Run `read`; if Firestore answers permission-denied, refresh the auth credential and try again. On a page reload Firebase Auth can report the…

| 函數 | 行 | 說明 |
|---|---|---|
| `retryOnPermissionDenied` | 7 | Run `read`; if Firestore answers permission-denied, refresh the auth credential and try again. On a page reloa… |

### `utils/roadmapUtils.ts` （387 行，2 處引用）

| 函數 | 行 | 說明 |
|---|---|---|
| `fetchRoadmapEventDetails` | 23 |  |

### `utils/rolePermissions.ts` （140 行，1 處引用）

| 函數 | 行 | 說明 |
|---|---|---|
| `ROLE_PERMISSIONS` | 18 | Static permission baseline per role. Dynamic board elevation is applied at runtime in usePermissions. |
| `ALL_PERMISSIONS_GRANTED` | 127 |  |

### `utils/signUpPayload.ts` （117 行，1 處引用）
> Member doc payloads written by hooks/useAuth.tsx on self sign-up. Pure (no Firebase) so they can be unit-tested against what firestore.rules…

| 函數 | 行 | 說明 |
|---|---|---|
| `buildSelfSignUpMember` | 32 | KL self sign-up (GUEST, or a matched pre-imported profile). Same fields signUp always wrote; reads profile fie… |
| `buildExternalSignUpMember` | 94 | External self-registration (Phase 1 WP-3): an AFFILIATE of an active sister chapter waiting for their chapter … |

### `utils/transactionCategoryUtils.ts` （277 行，4 處引用）
> Shared category-field derivation and cleanup logic for bank transactions and splits. WHY this file exists: the same "if Membership → auto-se…

| 函數 | 行 | 說明 |
|---|---|---|
| `buildMembershipProjectId` | 19 | Returns the canonical projectId for a membership year, e.g. "2026 membership". |
| `parseMembershipProjectId` | 27 | Extracts the membership year from a projectId like "2026 membership". Returns `null` if the string doesn't mat… |
| `parseAdministrativePurpose` | 38 | Splits an Administrative purpose string like "2024 Secretarial" into its year and base components. Returns `nu… |
| `buildAdministrativePurpose` | 47 | Builds an Administrative purpose string from year + base, e.g. "2024 Secretarial". |
| `buildCategoryFields` | 88 | Derives the canonical `{ projectId, purpose, memberId }` triplet for the given category + inputs. All logic is… |
| `buildCategoryCleanupUpdates` | 169 | Returns the fields that must be set to `null` in Firestore because the category changed and the old values no … |
| `buildCategoryUpdatePayload` | 222 | One-stop helper used by batch update paths and form submit handlers. Returns a partial update object containin… |

## 5. UI 元件庫（`components/ui/`，寫新 UI 前必查）

| 元件檔 | 行數 | 引用 | Export |
|---|---|---|---|
| `AsyncErrorBoundary.tsx` | 4 | 9 | — |
| `AvatarUploader.tsx` | 97 | 1 | `AvatarUploader` |
| `Badge.tsx` | 86 | 1 | `Badge`, `ProgressBar`, `AvatarGroup`, `Skeleton` |
| `Button.tsx` | 50 | 5 | `Button` |
| `Card.tsx` | 77 | 1 | `Card`, `StatCardsContainer` |
| `ColumnFilterHeader.tsx` | 118 | 2 | `ColumnFilterHeader` |
| `Combobox.tsx` | 255 | 11 | `Combobox` |
| `Common.tsx` | 26 | 239 | — |
| `ConfirmDialog.tsx` | 100 | 5 | `ConfirmDialog`, `CONFIRM_CLOSED` |
| `DataTable.tsx` | 172 | 0 | `DataTable` |
| `Drawer.tsx` | 139 | 2 | `Drawer` |
| `EmptyState.tsx` | 36 | 4 | `EmptyState` |
| `ErrorBoundary.tsx` | 261 | 3 | `ErrorFallback`, `SectionErrorFallback`, `ErrorBoundary`, `AsyncErrorBoundary`, `withErrorBoundary`, `useErrorHandler` |
| `FilterDrawer.tsx` | 65 | 1 | `FilterDrawer` |
| `FirstUseBanner.tsx` | 82 | 2 | `FirstUseBanner` |
| `Form.tsx` | 502 | 99 | `Input`, `Select`, `Textarea`, `Checkbox`, `RadioGroup`, `ButtonGroup` |
| `IntroducerSelector.tsx` | 338 | 6 | `IntroducerSelector` |
| `LedgerTable.tsx` | 183 | 1 | `LedgerTable` |
| `Loading.tsx` | 47 | 34 | `LoadingSpinner`, `LoadingOverlay` |
| `LoadingState.tsx` | 63 | 3 | `LoadingState` |
| `MemberSelector.tsx` | 231 | 4 | `MemberSelector` |
| `MembersOnlyOverlay.tsx` | 42 | 3 | `MembersOnlyOverlay` |
| `Modal.tsx` | 204 | 1 | `Modal` |
| `ModuleToolbar.tsx` | 76 | 1 | `ModuleToolbar` |
| `MultiSelectDropdown.tsx` | 204 | 6 | `MultiSelectDropdown` |
| `PageHeader.tsx` | 25 | 2 | `PageHeader` |
| `PageScaffold.tsx` | 89 | 1 | `PageScaffold` |
| `Pagination.tsx` | 201 | 5 | `Pagination` |
| `PerfMonitor.tsx` | 78 | 1 | `PerfMonitor` |
| `RegcodeQr.tsx` | 61 | 2 | `RegcodeQr` |
| `Responsive.tsx` | 74 | 0 | `ResponsiveGrid`, `MobileOnly`, `DesktopOnly`, `ResponsiveContainer` |
| `Tabs.tsx` | 154 | 4 | `Tabs` |
| `Toast.tsx` | 66 | 1 | `useToast`, `ToastProvider` |
| `ViewToggle.tsx` | 31 | 4 | `ViewToggle` |

## 6. 共用業務元件（`components/shared/`）

| 檔案 | 行數 | Export |
|---|---|---|
| `MembershipTypeDisplay.tsx` | 72 | `MembershipTypeDisplay` |
| `RedeemAudienceFields.tsx` | 56 | `RedeemAudienceFields` |
| `batchImport/BatchImportModal.tsx` | 1486 | `BatchImportModal` |
| `batchImport/batchImportTypes.ts` | 155 | — |
| `batchImport/batchImportUtils.ts` | 247 | `preprocessRow`, `trimPreprocessor`, `trimLowerPreprocessor`, `trimUpperPreprocessor`, `trimProperPreprocessor`, `toNumberPreprocessor`, `removeWhitespacePreprocessor`, `splitCommaPreprocessor`, `formatPhonePreprocessor`, `createChainedPreprocessor`, `createDefaultPreprocessor`, `parseDatePreprocessor` |
| `batchImport/stringMatching.ts` | 219 | `calculateSimilarity`, `normalizeHeaderName`, `autoMapColumns`, `validateColumnMapping` |
| `batchImport/validators.ts` | 142 | `notEmpty`, `isValidEmail`, `isValidDate`, `isValidAmount`, `isValidTier`, `isValidGender`, `isValidPhone`, `createEnumValidator`, `createLengthValidator`, `validateField` |
| `toyyib/BillPaymentLink.tsx` | 77 | `billPaymentUrl`, `BillPaymentLink` |
| `toyyib/CreateBillForm.tsx` | 165 | `CreateBillForm` |
| `toyyib/PaymentButton.tsx` | 145 | `PaymentButton` |

## 7. Context 與 Cloud Functions

| 檔案 | 行數 | Export | 說明 |
|---|---|---|---|
| `contexts/BatchModeContext.tsx` | 24 | `BatchModeContext`, `useBatchMode`, `BatchModeProvider` | ⚠️ 無說明 |
| `contexts/HelpModalContext.tsx` | 28 | `useHelpModal` | HelpModalContext – allows child components to open the App Help modal |

## 8. 文件債：缺少檔頭說明的檔案

共 60 個。請在檔案第一行補上 `/** 一句話說明此檔案職責 */`，下次重新生成時就會自動帶入本文件。

`services/auditLogService.ts`, `services/contractService.ts`, `services/dataImportExportService.ts`, `services/engagementAutoSuggestService.ts`, `services/errorLoggingService.ts`, `services/financeService.ts`, `services/flagshipProjectsService.ts`, `services/guestAnalyticsService.ts`, `services/incentiveCalculatorService.ts`, `services/inquiryService.ts`, `services/larkSyncService.ts`, `services/membershipConfigService.ts`, `services/mockData.ts`, `services/notificationService.ts`, `services/partnershipsService.ts`, `services/permissionConfigService.ts`, `services/postcodeService.ts`, `services/promotionService.ts`, `services/reportService.ts`, `services/sisterChaptersService.ts`, `services/socialPersonaService.ts`, `services/socialPostService.ts`, `services/sponsorshipService.ts`, `services/toyyibService.ts`, `services/zoomBookingService.ts`, `hooks/useActivityPlans.ts`, `hooks/useAppNavigation.ts`, `hooks/useBusinessDirectory.ts`, `hooks/useFirestoreCollection.ts`, `hooks/useGuestAnalytics.ts`, `hooks/useHobbyClubs.ts`, `hooks/useInstallPrompt.ts`, `hooks/useKnowledge.ts`, `hooks/useMemberMutations.ts`, `hooks/useMemberSearch.ts`, `hooks/useNotifications.ts`, `hooks/usePushNotifications.ts`, `hooks/useSisterChapterMembers.ts`, `hooks/useSisterChapters.ts`, `hooks/useSocialPersonas.ts`, `hooks/useSocialPosts.ts`, `hooks/useSurveys.ts`, `hooks/useToyyibMode.ts`, `hooks/useToyyibPay.ts`, `hooks/useToyyibPayment.ts`, `hooks/useZoomBookings.ts`, `utils/activityPhase.ts`, `utils/administrativeProjectsStorage.ts`, `utils/benefitEligibility.ts`, `utils/boardMembership.ts`, `utils/cardAccess.ts`, `utils/clubLink.ts`, `utils/configAccess.ts`, `utils/externalAccess.ts`, `utils/financeUtils.ts`, `utils/gamificationUtils.ts`, `utils/internationalCards.ts`, `utils/memberScope.ts`, `utils/roadmapUtils.ts`, `utils/rolePermissions.ts`
