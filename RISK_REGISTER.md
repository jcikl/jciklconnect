# JCI KL Risk Register

Generated from a read-only scan on 2026-08-24.

Updated 2026-10-12: R-018 to R-024 added from the `CAPABILITIES.md` scan (commit `9f36b73`). Existing entries unchanged.

Updated 2026-10-12: R-025 to R-027 added.

Updated 2026-10-18: R-028 to R-045 added from verification round 1 (permissions and rules); see the end of this file.

Severity scale: P0 critical, P1 high, P2 medium, P3 low.

## P0 Risks

### R-001 Possible Secret Material In Repository

Evidence: root files include `.env` and `serviceAccountKey.json`; Netlify config also warns about server-only Firebase and third-party secrets. Follow-up read-only check found `.env` and `serviceAccountKey.json` are currently ignored and not tracked by `git ls-files`; Git history and external sharing were not checked.

Risk: If these files are tracked, copied, uploaded, or exposed, Firebase Admin, third-party APIs, or production data may be compromised.

Recommended action:

- Confirm `.env` and `serviceAccountKey.json` are ignored and not present in Git history.
- Rotate any credentials that may have been committed, shared, or used in screenshots/logs.
- Add secret scanning to CI.
- Prefer Netlify/Firebase environment variables and local-only ignored files.

### R-002 Authorization Logic Split Across UI, Firestore Rules, And Functions

Evidence: `usePermissions.ts`, `rolePermissions.ts`, `firestore.rules`, and Netlify Functions each implement role checks.

Risk: A role change may pass in one layer but fail or over-permit in another. This is especially dangerous for member PII, finance, payment, import/export, and admin functions.

Recommended action:

- Create a permission matrix document mapping each module to UI permission, Firestore rule, and function authorization.
- Add Firestore rules tests for PII, finance, member edit, import/export, webhook, and system config collections.
- Require every privileged Netlify Function to verify Firebase ID token and server-side role.

### R-003 Root Member Data Read Surface Is Broad

Evidence: `firestore.rules` allows active members to read `members`; comments mention PII concerns and loId filtering limitations.

Risk: Active members may access more member profile data than intended unless client filtering and field minimization are perfect. Client filtering is not a security boundary.

Recommended action:

- Split public/member-directory fields from sensitive profile fields, or add server-mediated reads for sensitive data.
- Review `members` rule against actual PII fields.
- Add tests proving `GUEST`, `MEMBER`, `BOARD`, `ADMIN`, and `INACTIVE` can only read intended fields/documents.

## P1 Risks

### R-004 Duplicate Workflow/Automation Engines

Evidence: `automationService.ts`, `workflowService.ts`, and `functions/src/automation.ts` all contain workflow execution concepts.

Risk: Duplicate implementations drift over time, causing inconsistent idempotency, retry, status, webhook, and permission behavior.

Recommended action:

- Choose one canonical workflow engine.
- Mark the other implementation as deprecated or adapter-only.
- Move privileged step execution to server-side runtime.
- Add workflow state-machine tests for duplicate triggers, stuck executions, cancellation, retries, and nested workflow depth.

### R-005 Browser-Side Webhook Execution Is Known Incomplete

Evidence: `webhookService.ts` says browser-side HTTP is blocked by CORS and server-side signing is not implemented.

Risk: Webhook delivery may fail silently or be unsigned. If later used for production automation, it may be unreliable and insecure.

Recommended action:

- Move outbound webhook delivery and HMAC signing to a Netlify Function.
- Store webhook secrets server-side only.
- Add delivery logs with bounded retention and retry limits.

### R-006 Two Server Runtimes Increase Operational Drift

Evidence: Netlify Functions and Firebase Cloud Functions both exist and both use Firebase Admin.

Risk: Deployment, environment variables, authorization helpers, logging, retry behavior, and dependency versions can drift.

Recommended action:

- Decide runtime ownership by domain.
- Extract shared function auth/env helpers or duplicate intentionally with a checklist.
- Maintain one `SERVER_FUNCTIONS.md` inventory with endpoint, auth requirement, env vars, owner, and data writes.

### R-007 Encoding Corruption In Source And Docs

Evidence: many Chinese comments and strings render as mojibake such as `å®...` and `â†’`.

Risk: User-facing copy, error messages, docs, and comments become untrustworthy. AI tools may misunderstand corrupted intent and propagate bad text.

Recommended action:

- Standardize files as UTF-8.
- Identify whether corruption is only display/terminal or actual file content.
- Repair user-facing strings before broader localization work.
- Add an encoding check to CI for newly changed files.

### R-008 Large App Shell Has High Blast Radius

Evidence: `App.tsx` is over 100 KB and owns routing, module registry, layout state, role simulation, search, notifications, guest/auth switching, and view rendering.

Risk: Small navigation or permission edits may regress unrelated modules.

Recommended action:

- Extract module registry, authenticated shell, guest shell, sidebar config, and route/view mapping.
- Add smoke tests for guest routes and authenticated module access.
- Treat `App.tsx` edits as high-risk until split.

### R-009 Firestore Rules Are Large And Centralized

Evidence: `firestore.rules` is around 78 KB.

Risk: Rule changes are hard to review, and field-level rules can drift from TypeScript service writes.

Recommended action:

- Add Firestore emulator tests.
- Group rules by domain with comments and a generated collection inventory.
- Add a service-to-rule field whitelist checklist for each write-heavy service.

### R-010 Client Direct Firestore Writes Depend On Rule Correctness

Evidence: services under `services/` directly call Firestore for most domains.

Risk: Business invariants that require trusted server context can be bypassed if rules allow broad writes.

Recommended action:

- Classify each write as client-safe or server-only.
- Move finance approval, role changes, bulk import/export, webhook delivery, and irreversible deletes toward server-side commands.
- Keep pure read/list operations client-side where rules are simple.

### R-018 Two Incompatible Schemas Write The Same `pointsRules` Collection

Evidence: `services/pointsService.ts` (`PointRule`: `category`, `basePoints`, `active`, `priority`; methods `getPointRules` / `savePointRule` around L653–819) and `services/pointsRuleService.ts` (`PointsRule` in `types/gamification.ts`: `trigger`, `pointValue`, `enabled`, `weight`) both read and write `COLLECTIONS.POINTS_RULES` (`pointsRules`). `pointsRuleService` currently has no importers.

Risk: The collection can hold documents in two shapes. If anyone wires `pointsRuleService` back in (or an AI agent "finds" it via search), it will read documents with missing fields and write documents the live engine cannot evaluate, causing silent point miscalculation.

Recommended action:

- Confirm which shape production documents use.
- Declare one canonical service and type; mark the other `@deprecated` in its file header.
- Do not delete until production data is confirmed; add a test that loads a real-shaped rule document.

### R-019 Three Overlapping Bank-Matching / Reconciliation Implementations

Evidence: `financeService.ts` (`reconcileBankAccount`, `getUnmatchedForReconciliation`, `matchTransactions`, `unmatchTransactions`, around L3810–4222), `eventPaymentMatchingService.ts` (`runAutoMatch`, `applyMatch`, `removeMatch`), and `reconciliationService.ts` (861 lines, `executeAutoMatch`, `manualMatch`, `unlinkMatch`; no importers).

Risk: Same pattern as R-004. Match status can be written by different rules depending on which UI path is used; fixes applied to one path miss the others. New finance work is likely to add a fourth version.

Recommended action:

- Map which UI entry calls which implementation.
- Choose one canonical matching engine; document the decision in `ARCHITECTURE.md`.
- Mark `reconciliationService.ts` as deprecated or planned; do not build new matching features before this decision.

## P2 Risks

### R-011 Test Coverage Is Narrow Compared With Domain Size

Evidence: only 8 test files were found, mostly property and utility tests.

Risk: High-value flows such as login, member promotion, finance approval, ToyyibPay callback, Zoom booking, and automation execution may regress unnoticed.

Recommended action:

- Add focused unit tests for pure business rules.
- Add Firebase emulator/rules tests.
- Add integration tests for Netlify Functions with mocked Firebase Admin and third-party APIs.
- Add Playwright smoke tests for guest pages and authenticated navigation.

### R-012 Firestore Collection Constants Include Dead Or Partial Features

Evidence: `BUSINESS_PROFILES` is explicitly marked dead code; several feature collections have comments indicating TODOs or partial implementation.

Risk: AI agents may build on abandoned concepts and create duplicate modules.

Recommended action:

- Create a feature inventory with statuses: active, partial, deprecated, planned, dead.
- Remove or quarantine dead constants after confirming no production data dependency.

### R-013 Data Import/Export Has Known Enforcement TODOs

Evidence: `dataImportExportService.ts` comments mention import member dedup slots not wired and role enforcement needing server-side handling.

Risk: Bulk import can bypass normal member creation invariants, dedup slots, or permissions.

Recommended action:

- Move bulk import writes to a server-side function.
- Reuse `MembersService.createRecord/updateRecord` or a canonical member write path.
- Add import dry-run validation and audit logs.

### R-014 Multi-LO Is Partially Designed But Not Fully Enforced

Evidence: `DEFAULT_LO_ID = 'jcikl'`; comments mention future multi-LO and loId filter limitations.

Risk: Future multi-LO expansion may leak data across LO boundaries if assumptions remain single-tenant.

Recommended action:

- Add a multi-LO readiness checklist.
- Require new collections to define tenant fields and rule filters.
- Add tests with at least two LO IDs before enabling multi-LO behavior.

### R-015 Generated/Compiled Files Are Mixed With Source

Evidence: `functions/lib/*.js` and `.map` files are present beside `functions/src/*.ts`; git status shows both source and generated outputs modified.

Risk: Review noise increases and generated files can drift from source.

Recommended action:

- Decide whether `functions/lib` is committed build output.
- If committed, require build verification before commit.
- If not, ignore generated output and deploy from build artifacts.

### R-020 Helper Functions Re-Implemented Inside Components

Evidence: `getInitialsSvg` is defined 10 times with 5 different default sizes (36/44/48/64/200) across Members, Communication, HobbyClubs, BusinessDirectory, `components/ui/AvatarUploader.tsx` and `components/layout/SearchDropdown.tsx`. `formatCurrency`, `formatDate`, `formatDateTime`, and `isFuture` already exist in `utils/formatUtils.ts` / `utils/dateUtils.ts` but are redefined in 6 places. See `CAPABILITIES.md` §1.1–1.2.

Risk: Avatars and dates render inconsistently; every bug fix must be repeated N times; AI agents copy whichever local version they open first.

Recommended action:

- Create one `getInitialsSvg(name, size)` in `utils/` with a unit test.
- Replace copies one file per small task (surgical), not in a single sweep.
- Enforce via the CLAUDE.md Reuse-First Gate.

Progress (2026-10-12): `utils/avatarUtils.ts` `getInitialsSvg` created with tests; `components/ui/AvatarUploader.tsx` migrated. Copies using `btoa` throw `InvalidCharacterError` on non-Latin names (e.g. Chinese); the standard version uses `encodeURIComponent`. 9 copies remain.

### R-021 Unused Modules Look Like Real Features

Evidence: no importers for `services/pointsRuleService.ts`, `services/projectAccountsService.ts`, `services/reconciliationService.ts`, `services/workflowService.ts` (see R-004), `hooks/useGuestAnalytics.ts`, `hooks/useMemberBenefits.ts`, `hooks/useMemberMutations.ts`, `hooks/useNotifications.ts`. Note: `hooks/useCommunication.ts:10` has `TODO (P2-DEDUP)` stating it duplicates the fetch that `useNotifications` performs.

Risk: Developers and AI agents either rebuild these capabilities from scratch or wire up stale code without knowing its status.

Recommended action:

- Give each file a status header: `@status active | deprecated | planned | dead` (extends R-012 feature inventory).
- Resolve the `useCommunication` / `useNotifications` TODO by reusing `useNotifications`.
- Regenerate `CAPABILITIES.md` after each status change.

### R-022 Components Bypass The Service Layer

Evidence: 10 component files import `firebase/firestore` directly, including `MembersView.tsx`, `Members/MemberDetail.tsx`, `Finance/TransactionSplitModal.tsx`, `ProjectManagement/ProjectFinancialAccount.tsx`, `Toyyib/ToyyibSettingsPanel.tsx`. See `CAPABILITIES.md` §1.3.

Risk: These reads/writes skip `isDevMode`, caching, cache invalidation, `writeBatch`, and error logging rules; they are invisible to anyone searching `services/`. Increases exposure described in R-010.

Recommended action:

- No new direct imports (CLAUDE.md §5.1).
- Migrate each file into an existing service/hook as its own task, starting with finance and member writes.

### R-025 Type Checking Is Not Part Of The Build

Evidence: `npm run build` runs only `vite build`; `tsc --noEmit` (`npm run typecheck`) reports existing type errors. Current count: see the baseline in CLAUDE.md §3 step ⑤.

Risk: Type errors accumulate silently; earlier guidance claimed the build was the type-check gate, so agents treated a green build as type-safe.

Recommended action:

- Never let the error count exceed the baseline (CLAUDE.md §3 ⑤); lower the baseline as errors are fixed.
- Once the count is 0, add `typecheck` to the build or CI.

## P3 Risks

### R-016 Existing Architecture Docs Are Valuable But Stale/Corrupted

Evidence: `_bmad-output/architecture.md` exists, but appears older and encoding-corrupted.

Risk: Future AI tools may treat stale plans as current implementation.

Recommended action:

- Keep root `ARCHITECTURE.md` as current implementation map.
- Move historical/planning docs under a clearly labeled planning/history section.
- Add a date and status header to every architecture document.

### R-017 Codegraph Is Not Initialized

Evidence: Codegraph tool reported the project is not initialized.

Risk: Future architecture and impact analysis will be slower and less precise.

Recommended action:

- Run `codegraph init -i` when ready.
- Use Codegraph before refactors and for impact analysis on high-risk symbols.

### R-023 Local Process Artifacts Committed To Repository Root

Evidence: a file named `C:UsersUser...scratchpadtsc_errors.txt` (local Windows temp path flattened into a filename) is committed at the repo root.

Risk: Leaks local machine paths, adds noise, and signals that agent output is not boundary-checked. Related to R-015.

Recommended action:

- Delete the file.
- Add `*tsc_errors*.txt` and scratchpad patterns to `.gitignore`.

### R-024 AI Guidance Drifted From Code

Evidence: the previous `CLAUDE.md` referenced a non-existent `workflowExecutionService` and described `types.ts` as ~2000 lines (it is now a barrel over `types/`). 52 services/hooks/utils have no file header, so `CAPABILITIES.md` shows "⚠️ 无说明" for them.

Risk: AI agents follow stale guidance confidently. Related to R-016.

Recommended action:

- Keep facts in one source (see CLAUDE.md §6); regenerate `CAPABILITIES.md` in every PR that changes exports.
- Add a one-line `/** responsibility */` header to the 52 files over time.

### R-026 Pagination Re-Export Creates A Circular Chunk Dependency

Evidence: `vite build` warns: Export "Pagination" of `components/ui/Pagination.tsx` is re-exported through `components/ui/Common.tsx` while both modules depend on each other and end up in different chunks, producing a circular dependency between chunks. The warning names `components/modules/Projects/ProjectsListShell.tsx` as the importer to change.

Risk: Rollup warns this "will likely lead to broken execution order"; a load-order bug would surface only in production chunks.

Recommended action:

- Change `ProjectsListShell.tsx` to import `Pagination` directly from `components/ui/Pagination`.
- Confirm the warning disappears from `vite build`.

### R-027 getInitialsSvg Does Not XML-Escape Initials

Evidence: every `getInitialsSvg` copy, including the standard `utils/avatarUtils.ts`, inserts the initials straight into the SVG markup.

Risk: A name starting with `&` or `<` produces invalid SVG, so the fallback avatar silently fails to render (no error thrown).

Recommended action:

- Escape `&`, `<`, `>` in the standard `utils/avatarUtils.ts` and add a unit test; the remaining copies inherit the fix when migrated under R-020.

## Added 2026-10-18: Verification Round 1 (Permissions and Rules)

Source: read-only check of the repo `firestore.rules` against the code. The user supplied the live rules from the console the same day; fingerprinting matches commit `d8282b0` (2026-09-10). Later commits `b83d671` (submit payment requests on behalf of others) and `65599ca` (remove certificates / nudgeRules rules) are not deployed. The rule sections cited below are identical live and in the repo, so these issues exist in production; still reproduce "rejected" items in the emulator before fixing.

### R-028 Rules Out of Step With the Data Shape; Key Writes May Be Rejected (P0)

Evidence:

- Reconciliation: the `transactions` update whitelist (`firestore.rules` ~L349–360) has no `reconciliation` key, but `services/financeService.ts:4198–4213` and others write `reconciliation.*`. The comment at L343 promises an admin bypass that no longer exists.
- Self-registration: `hooks/useAuth.tsx:486–518` writes `others`, `tier`, `points`, `jciCareer`, `skills` and more, beyond the `members` create whitelist (L162–166).
- Member self-edit: rule L178 requires top-level `name` and `email`, but profiles now keep them under `general` / `contact`.

Risk: Reconciliation matching, self-registration and profile self-edits (including enabling push) are rejected.

Reproduced 2026-10-18 in the Firestore emulator loaded with the live rules (`d8282b0`), using the payloads the code actually writes (script kept in the session scratch folder, not committed):

- Self-registration: the real payload is denied; a whitelist-only payload passes.
- Reconciliation match: denied for both the current Treasurer and ADMIN; the same match using the old field names passes.
- Member phone edit: denied when the profile has only nested general / contact; allowed when it also has top-level name / email. Which shape production profiles have is not yet confirmed.

Progress (2026-10-18, rules changed, awaiting owner deploy): (1) `transactions` whitelist now includes `reconciliation` and the void fields (`voidedAt` / `voidedBy` / `voidReason`; voiding failed for every transaction before); a new unlock rule lets finance roles / Admin take a reconciled transaction back out of reconciliation, touching reconciliation fields only, with amount and other business fields still locked; only Admin may void a reconciled transaction. (2) Self-registration accepts the sign-up form fields, but points, tier, badges etc. must hold their defaults and `jciCareer` may only contain `joinDate`, so a guest cannot make itself a board member or treasurer. (3) Member self-edit accepts name / email either top-level or under `general` / `contact`. Emulator: 27 checks pass (12 of them security checks) and the 21 R-034 checks still pass; run against the currently deployed rules (`047b450`), all 11 checks that should pass are denied, so the tests discriminate. Not addressed: the first-login profile copy for invited imported members is still denied; it will be solved by creating Auth accounts at import time (see TODO).

Recommended action: confirm the deployed rules first, reproduce the three writes in the emulator, then fix the whitelists together.

### R-029 Any Signed-In User Can Rewrite counters (P0)

Evidence: `firestore.rules` L1163–1168 only requires sign-in and an int `value`; `services/paymentRequestService.ts:66` uses it for payment-request numbers.

Risk: Lowering a counter gives two payment requests the same number.

Recommended action: allow increment-by-one only, or generate numbers server-side.

### R-030 Guests or Members Can Bulk-Read or Forge Sensitive Records (P1)

Evidence:

- GUEST can list all `toyyibBills` (L1237) and `paymentRequests` (L458); members can list all `eventRegistrations` (L523), `inquiries` (L726) and `surveyResponses` (L617).
- `toyyibBills` and `eventRegistrations` creates have no field whitelist, so a record can arrive already marked paid.
- GUEST can create a notification for any member (L569–576); members can rewrite whole attendee arrays on events/projects (L251–254, L269–272).
- `events` / `projects` list is open to unauthenticated users, drafts included (L245, L263).

Risk: Personal payment, claim and survey data leaks; payment status and notifications can be forged.

Recommended action: scope lists to the caller (`resource.data.memberId == request.auth.uid`; queries that carry the same filter pass) and add create whitelists.

### R-031 Any Board Member Can Approve Payment Requests, Including Their Own (P1)

Evidence: `firestore.rules` L482–485.

Risk: No separation of duties.

Recommended action: restrict approval to finance operators and forbid `approvedBy == applicantId`.

### R-032 Member Self-Payment Batch Is Rejected (P1)

Evidence: `services/toyyibService.ts:215–223` writes the bill and a `toyyibCategories` update in one batch; the latter is Board-only (L1226). Callers: `hooks/useToyyibPayment.ts:70`, `:123`.

Risk: The member pays in ToyyibPay but no bill record is saved.

Recommended action: move the category update server-side or drop it from the member flow.

### R-033 Push Notifications Are Never Delivered (P1)

Evidence: tokens are saved on `members` (`services/notificationService.ts:51`) but the server reads `users/{id}` (`functions/src/notifications.ts:321`, `netlify/functions/birthday-notifications.mjs:35`).

Risk: Birthday and event pushes silently fail.

Recommended action: use one token location; verify together with the R-028 self-edit issue.

Progress (2026-10-18, code changed, not deployed): added `netlify/lib/firebaseAdmin.mjs`; `birthday-notifications.mjs` and `send-push-test.mjs` now read the token from `members`. Also fixed birthday recipients: the query used `status == 'active'`, but current member docs have no top-level `status`, so new members never matched; it now filters by role (MEMBER / BOARD / ADMIN / SUPER_ADMIN, excluding deleted and legacy `status: inactive`) and reads the name from `general.name`. Emulator check: unauthenticated call returns 401; guests, inactive and deleted members excluded; token read from `members`; a second run the same day sends nothing new. Note: members can only save a token if the R-028 self-edit issue is fixed.

### R-034 Rules Leave Out SUPER_ADMIN (P1)

Evidence: `canReadOrgMembers` (L94–102) lists only ADMIN and BOARD; hard-coded `role in ['BOARD','ADMIN']` in notifications, inquiries, webhooks, benefitUsage, mentorMatches and `storage.rules` L22, L28; `resourceInMyLo` returns false when the caller has no `loId` (L115–118, L208).

Risk: A super admin who is not on the current board cannot add members or delete registrations and members.

Recommended action: use `isAdmin()` everywhere and add rules tests.

Progress (2026-10-18, rules changed, awaiting owner deploy): added SUPER_ADMIN to `canReadOrgMembers()` and to all 11 hard-coded `['BOARD','ADMIN']` lists (SUPER_ADMIN only, no other role widened); SUPER_ADMIN skips the LO check when deleting members; `storage.rules` `isBoard` / `isAdmin` updated to match. Emulator: 21 checks pass — SUPER_ADMIN (including one with no loId) can check in, register on behalf, cancel and delete others' registrations, read and update others' notifications, read memberEmails and delete members; MEMBER is still denied everything; an ADMIN from another LO still cannot delete members here; ADMIN and BOARD check-in unchanged. The same suite run against the old live rules denies every SUPER_ADMIN case, so the tests discriminate. Deploying also ships the owner-approved `b83d671` (submit payment requests on behalf of others; tested: BOARD allowed, MEMBER denied) and `65599ca`. Rollback: redeploy the `d8282b0` rules.

### R-035 Admin Permission Settings Have No Effect (P1)

Evidence: Config → Access writes `userRolePermissions`, `positionPermissions`, `membershipTypePermissions` and `permissionCatalog`, but `hooks/usePermissions.ts`, `firestore.rules` and all functions ignore them; even the permission names differ (`members.view` vs `canViewMembers`). Introduced in commit `81a56be`. `SCHEMA.md:2342` and `SCHEMA-PERMISSIONS.md:122–124` describe it wrongly.

Risk: Admins believe they changed access when nothing changed.

Recommended action: short term, label the page "not yet in effect" or hide it; decide separately whether to wire it in (critical risk).

### R-036 Other Overly Broad Rules (P2)

Evidence:

- Readable by any signed-in user: `points` (L546), `mentorMatches` list (L963), `achievementProgress` (L1337), `benefitUsage` (L827) and others.
- Creates with no whitelist: `errorLogs` L1191, `emailLogs` L1291, `activityPlans` L809, `mentorshipFeedback` L988, `publicBusinessListings` L1180, `contracts` L1052.
- Counter fields settable to any value: `advertisements` L773–775; `guestPageStats` L1212 without sign-in.
- Rules for removed features remain: `nonMemberLeads` (publicly writable) and `businessProfiles`; indexes for removed collections remain (`firestore.indexes.json` L970, L988, L1334).
- `services/documentsService.ts:343` calls `storageRef` on Cloudinary URLs, which throws synchronously and can break document deletion.

Recommended action: tighten alongside R-030; remove leftover rules and indexes.

### R-037 Rules Guidance in Docs Is Wrong (P3)

Evidence: `CLAUDE.md` §5.3 says `resource.data` cannot be used in list/query rules; it can when the query carries the same constraint. `docs/PERMISSION_MATRIX.zh-CN.md` L96, L130, L199 still list removed collections.

Risk: AI loosens list rules because of the wrong guidance, which is one cause of R-030.

Recommended action: `CLAUDE.md` changes need owner approval (CODEOWNERS); update the matrix with the R-030 fix.

### R-038 No Cloud Functions Are Deployed (P1)

Evidence: on 2026-10-18 `firebase functions:list` (run with an account that has access) returned "No functions found"; the Firebase environment reports billing is not enabled (the Spark plan cannot deploy Cloud Functions). None of the functions in `functions/src` run in production: automatic member promotion, dues renewal and reminders, birthday pushes, event reminders, badge / achievement / automation triggers, finance validation.

Risk: Automations that depend on them fail silently, such as the October dues renewal, the January dues reminder and auto-promotion on `members` updates. Only Netlify Functions run in production; the Netlify birthday job needs an external cron, which is also unconfirmed.

Recommended action: list which automations the chapter actually needs; decide between enabling billing and deploying, or moving the needed ones to Netlify (decide with R-006); mark undeployed functions clearly in the docs so they are no longer treated as live features.

Progress (2026-10-18): the owner chose Netlify over enabling billing. Done (code changed, not deployed): birthday push fix (see R-033); new `netlify/functions/annual-dues-reminders.mjs` replaces `sendAnnualDuesReminders`, running Jan 1 at 10:00 Malaysia time; re-runs in the same year neither duplicate reminders nor re-open a WhatsApp banner the admin already dismissed. Dues records are read from `jciCareer.membershipDuesHistory`, falling back to the legacy `membership`. Remaining: check-in points (R-039) and marking `functions/` deprecated.

### R-039 Event Check-In Awards No Personal Points (P1)

Evidence: `services/eventsService.ts:765–768` removed the points call at check-in, saying the Cloud Function `onEventRegistrationUpdate` handles it; that function is never imported by `functions/src/index.ts`, so it would not deploy even with billing on, and it does not write `points` anyway.

Risk: Check-ins add no personal points, so leaderboards and incentive totals run low, with no error shown.

Recommended action: restore the `PointsService` call in the web check-in flow and remove the wrong comment (step P4 of the Netlify migration plan).

Progress (2026-10-18, code changed, not deployed): `EventsService.markAttendance` now calls `PointsService.awardEventAttendancePoints` after the check-in batch commits (deterministic doc id, so repeated check-ins cannot double-award); a points failure is logged without undoing the check-in, mirroring `undoAttendance`. The event detail modal check-in used to change only the status (no points, no attendance list, and its `checkedInByName` field is outside the rules whitelist, so Board users were denied); it now calls `markAttendance`, symmetric with the modal undo. Added `services/eventsService.markAttendance.test.ts` (4 tests). Known edge: checking in again after an undo awards nothing, because the deterministic points doc already exists (net 0).

Live test (2026-10-18, local dev build against production Firebase, with the owner's permission, as PETER YU / BOARD): checking in on "2026 JCI Malaysia National Convention" set the registration to checked_in, added him to the attendance list, raised points 507 → 517 and created `points/{memberId}_{eventId}_attendance` (+10); undo restored registered status, removed him from the list, returned points to 507 and set `pointsReversed: true`. The same session confirmed that a SUPER_ADMIN who is not on the current board is denied check-in, register-on-behalf and cancel for others, i.e. R-034 is live in production.

Retest after deploying the R-034 rules (noreply / SUPER_ADMIN): read-only probes confirmed the new rules are live; checking in PETER YU succeeded (507 → 517). Undo exposed an existing bug: `undoAttendance` called `awardPoints` without `awardedBy`, so the cross-member guard rejected the reversal after `pointsReversed` had already been set to true, leaving the points in place with no retry (never visible before because check-in awarded nothing). Fixed: pass the current user as `awardedBy`; on reversal failure, reset `pointsReversed` to false and log. Added 2 unit tests; retest after the fix reversed correctly (517 → 507, reversal records the authoriser). Points, notifications and flags from all three tests were cleaned up; PETER YU is back at 507.

### R-040 Most Members Have No Working Login Account (P0)

Evidence: imported member profiles get random doc ids (`services/membersService.ts:609`) and the invite functions create Auth users with random uids (`netlify/functions/send-invite.mjs:89`, `auto-invite.mjs:90`); on first login `hooks/useAuth.tsx` copied the profile to the new uid, which `firestore.rules` rejects (self-create must be GUEST). A read-only production dry run on 2026-10-18 found 8 of 345 members whose login uid equals their member id, 335 with no login account, and 2 (SHANE TEOH, SHIRLEY PANG) whose email has a used account that is not linked to their profile.

Risk: most members cannot sign in.

Recommended action: implemented (not deployed) `netlify/functions/member-auth.mjs`: accounts created at import time with uid = member id, and a SUPER_ADMIN "Fix Auth" panel in the member import drawer (dry run, then run); login no longer copies profiles and asks the user to contact an admin instead. After deploy, a SUPER_ADMIN runs Fix Auth; the 2 members above need manual handling. Note: under local `netlify dev`, functions that import `firebase-admin/auth` fail (`jwks-rsa` 4.1 `require()`s the ESM-only `jose` 6), existing `send-invite` included; whether production works depends on Netlify's Node version, so confirm with a Fix Auth dry run after deploy.

Result (2026-10-18): on the PR #3 deploy preview `member-auth` loaded fine (401 without a token) and the dry run matched the local read-only script. A SUPER_ADMIN (noreply) then ran Fix Auth on the preview (same Firebase as production) without replacing orphans or sending emails: 337 accounts created, 8 already ready, 0 errors, 4 audit entries (`auditLog` action `member_auth_fix`). Re-check: all 345 members now have a login account with uid = member id. SHANE TEOH and SHIRLEY PANG, flagged for review in the dry run, were also created because the used accounts under their emails no longer existed at run time (not deleted by this feature: orphan replacement was off, and the code never deletes used accounts); the owner confirmed deleting them in the Firebase console (2026-10-18). Members have no password yet: they sign in with Google or "Forgot password".

### R-041 Payment Flow Hard-Codes the Retired Domain app.jcikl.cc (P1)

Evidence: members use `https://jciklconnect.netlify.app`; `app.jcikl.cc` does not respond (2026-10-18). `netlify/functions/toyyibpay-api.mjs` only accepted return URLs starting with `app.jcikl.cc` and otherwise forced `https://app.jcikl.cc/payment/result`, so payers landed on a dead page; the ToyyibPay callback default was also `app.jcikl.cc` (production sets `TOYYIBPAY_CALLBACK_URL`, so it was unaffected); production was detected by "URL contains app.jcikl.cc", so the live site counted as non-production and accepted localhost return URLs. Neither the client return path `/payment-return` nor the fallback `/payment/result` had a page.

Risk: payers see an error page after paying and may pay twice.

Recommended action / progress (2026-10-18, code changed, awaiting merge and deploy): new `netlify/lib/siteUrl.mjs` derives the site origins and production context from Netlify's own `URL` / `DEPLOY_PRIME_URL` / `CONTEXT` (no new env vars); return URLs are accepted only on our own origins (including deploy previews), otherwise `<site>/payment-return`; the callback default is our own function URL; new `/payment-return` page for guests and signed-in members shows success / pending / failed from `status_id` (informational only; the server callback still records the payment). 11 unit tests pass. The CORS allowlists of the other 10 functions also list only `app.jcikl.cc`; same-origin requests are unaffected, so that is a separate task.

### R-042 Production Payment Function Could Not Start Without the ToyyibPay Key (P0, resolved)

Evidence: on 2026-10-18 an unauthenticated request to production `/.netlify/functions/toyyibpay-api` returned 502 with `TOYYIBPAY_SECRET_KEY env var not set` (the function throws at start-up when the variable is missing); the PR #3 and #4 previews behaved the same. The error response also returned the server stack trace to the browser.

Risk: no online payment started from the app (dues, event fees) could create a bill.

Resolution: the owner set `TOYYIBPAY_SECRET_KEY` (sandbox) and `TOYYIBPAY_SECRET_KEY_PROD` (production) in Netlify the same day and redeployed; production now returns 401 (function starts and reaches the auth check). Note: without a `systemConfig/toyyibpay` setting the code defaults to sandbox mode, so confirm the mode is Production before taking real payments. Follow-up option: report a missing variable as a per-request 500 with a log entry instead of throwing at start-up, so no stack trace reaches the browser.

### R-043 Payment Callback Cannot Start Without Its Secret; the Sandbox / Production Switch Never Worked (P0)

Evidence (2026-10-19):
- GET on production `/.netlify/functions/toyyibpay-callback` returns 502 with `TOYYIBPAY_WEBHOOK_SECRET env var not set` (checked at start-up). Every ToyyibPay payment notification therefore fails: bills are never marked paid and no transaction is created; production `toyyibpay_webhooks` and `toyyibBills` are both empty.
- The ToyyibPay settings mode switch sends `isSandbox: String(isSandbox)` (`services/toyyibService.ts:141`) while the proxy only accepts a boolean (`toyyibpay-api.mjs` setMode), so it always returned 400; `systemConfig/toyyibpay` was never written and the site has always run in the default sandbox mode. The badge also never refreshed after a switch (`useToyyibMode` read once).

Risk: online payments are never recorded even when paid, and production collection cannot be enabled.

Resolution: the owner adds `TOYYIBPAY_WEBHOOK_SECRET` in Netlify (Functions scope; Production + Deploy Previews) and redeploys; GET should then return 405. Code fix (branch `fix/toyyib-mode-switch`, awaiting merge): the client sends a real boolean, the proxy accepts a boolean or "true"/"false" and refuses Production when the production key is missing, and `useToyyibMode` gains `refresh()` so the badge updates after a switch.

Added the same day: `public/_redirects` held only `/* /index.html 200`, and Netlify applies that file before `netlify.toml`, so the `/api/webhooks/zoom`, `/api/webhooks/toyyibpay` and `/api/toyyibpay` rewrites in `netlify.toml` never took effect; GET `/api/webhooks/toyyibpay` returned index.html (200). ToyyibPay in production uses `TOYYIBPAY_CALLBACK_URL` (the direct function URL), so it was unaffected; if Zoom is configured with `/api/webhooks/zoom`, its notifications never arrived. Fix: list the three rewrites ahead of the catch-all in `public/_redirects` (same branch).

### R-044 Every ToyyibPay Bill Created From the App Was a Mock (P0)

Evidence: `TOYYIB_CONFIG.USER_SECRET_KEY` in `config/constants.ts:142` is a fixed empty string (the key now lives server-side in `toyyibpay-api`, so the client must not hold it), but `createBill` in `services/toyyibService.ts` still returned a `MOCK-xxxx` bill whenever that key was empty, without calling the proxy. On 2026-10-19 a RM1 sandbox test bill created with Manual Bill on production showed success, yet nothing appeared in ToyyibPay or `toyyibBills`.

Risk: every payment link for dues, event fees and manual bills was invalid; this is why production `toyyibBills` has always been empty.

Resolution (branch `fix/toyyib-mock-bill`, awaiting merge): return a mock only in dev mode (`isDevMode()`); added `services/toyyibService.createBill.test.ts` (2 tests; the proxy test fails without the fix).

### R-045 The Proxy Stripped Required ToyyibPay Parameters, So No Real Bill Was Ever Created; Payers Could Change the Amount (P0)

Evidence (2026-10-19, after fixing R-044, creating a RM1 sandbox bill on production): ToyyibPay first returned "billName exceed limit. Max 30 length", then, with a shorter name, "billPriceSetting parameter is empty". The `toyyibpay-api` allowlist `CREATE_BILL_ALLOWED_PARAMS` only kept name, description, amount, payer and category, dropping `billPriceSetting`, `billPayorInfo`, `billPaymentChannel` and `billExternalReferenceNo`; the server checked names against 255 characters while ToyyibPay allows 30 (description 100). The client also sent `billPriceSetting: '0'`, which lets the payer edit the amount.

Risk: even without R-044 no real bill could be created; forwarding the client's value would have let payers change the amount.

Resolution (branch `fix/toyyib-create-bill-params`, awaiting merge): new `buildCreateBillParams` in `netlify/lib/toyyibBill.mjs` fixes the price setting to `1` (fixed amount) and payer info to `1`, accepts payment channel 0/1/2 only, passes the external reference number, clips name / description to ToyyibPay's limits, and keeps callback / return URLs server-decided. 5 unit tests pass.
