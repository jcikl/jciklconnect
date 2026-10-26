# JCI KL Risk Register

Generated from a read-only scan on 2026-08-24.

Updated 2026-10-12: R-018 to R-024 added from the `CAPABILITIES.md` scan (commit `9f36b73`). Existing entries unchanged.

Updated 2026-10-12: R-025 to R-027 added.

Updated 2026-10-18: R-028 to R-045 added from verification round 1 (permissions and rules); see the end of this file.

Updated 2026-10-19: R-049 to R-058 added from the Phase 0 external-members review (`feat/affiliate-p0`, WP5); see the end of this file.

Updated 2026-10-20: R-059 to R-072 added from the Phase 1 external-members work (`phase1/integration`, not merged or deployed yet); R-073 to R-086 added from its review fixes; see the end of this file.

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

### R-046 Payment Callbacks Were Silently Rejected: Wrong Field Name, and Verification Always Used Sandbox (P0)

Evidence (2026-10-19, sandbox RM1 payments `4e9xc8va`, `lm6obyw3`, `wn0s7ywr`): Netlify logs show `toyyibpay-callback` requests at the payment times with no warning or error, yet `toyyibpay_webhooks` and `transactions` stayed empty. ToyyibPay's callback body sends the payment reference as `refno` (`status`, `billcode`, `order_id`, `amount`); the handler read `transaction_id` (a return-URL field), so every real callback ended in a 400 "Missing required fields" with no log line. Verification against `getBillTransactions` also used only the `TOYYIBPAY_SANDBOX` env var and the sandbox key, ignoring the site-wide mode in `systemConfig/toyyibpay`, and took the first record of the bill instead of the one matching the payment.

Risk: no online payment (dues, event fee, manual bill) is ever recorded automatically; in production mode, verification would query the sandbox and reject real payments.

Resolution (branch `fix/toyyib-callback-refno`, awaiting merge): `netlify/lib/toyyibCallback.mjs` parses both shapes (`refno` / `transaction_id`) and picks the record by payment reference, then order_id; `netlify/lib/toyyibMode.mjs` holds mode / key / API-base selection shared by `toyyibpay-api` and `toyyibpay-callback`; the callback uses the bill's stored `isSandbox` (new field written at bill creation, with `billExternalReferenceNo`) or the site-wide mode; every rejection is now logged (bill code and reason only). 10 unit tests pass.

Follow-up (2026-10-19, after R-046 was deployed): the new rejection log showed the real body — ToyyibPay posts the callback as `multipart/form-data`, which the handler parsed as URL-encoded, so every field was empty and sandbox bill `g6e28dl6` was still rejected. Branch `fix/toyyib-callback-multipart`: `readCallbackBody` in `netlify/lib/toyyibCallback.mjs` reads multipart, URL-encoded and JSON bodies; 2 tests added (they fail without the fix).

### R-048 Members Signed Out on Page Reload (P1)

Evidence (errorLogs, 2026-09 to 2026-10-19): 34 `useAuth-load-member-data` errors "Missing or insufficient permissions." — real members on 2026-09-23 (mobile, 8×) and 2026-10-05 (desktop), and the Claude test pane on 2026-10-18/19, each time followed by the member appearing signed out. The rule lets any signed-in user read `members/{own uid}`, so the read reached Firestore without the ID token: on reload Firebase Auth reports the restored user before Firestore has attached the token. `useAuth` treated the error as fatal and cleared the session.

Risk: members are logged out at random after a reload and must sign in again.

Resolution (branch `fix/auth-reload-signout`, awaiting merge): the own-profile read goes through `utils/retryOnPermissionDenied.ts` — on permission-denied it refreshes the ID token and retries (2×); the auth loading state stays on meanwhile. A genuinely forbidden read still fails after the retries. 3 unit tests; 10 consecutive reloads in the preview stayed signed in. Confirm after deploy that the error stops appearing in errorLogs.

### R-049 External Access Is Enforced in the Client UI; firestore.rules Is the Real Boundary (P1)

Evidence (Phase 0, 2026-10-19): `utils/externalAccess.ts` is the view whitelist for `AFFILIATE` / `CHAPTER_ADMIN`, read by navigation and `viewRegistry`; `hooks/usePermissions.ts` derives `externalAllowedViews`. `firestore.rules` has `isExternal()` / `isActiveExternal()` and an explicit list of collections (see `SCHEMA-PERMISSIONS.md`, 外部用户的规则范围). Rules tests: `tests/rules/externalMembers.rules.test.ts`, `tests/rules/memberCards.rules.test.ts`.

Risk: the whitelist only hides screens. An active external user can still query every collection the rules allow for authenticated users (for example `events`, `projects`, `memberBenefits`, `hobbyClubs`, `sisterChapters`), and any rule that is wider than intended is reachable from the client.

Recommended action:

- Treat `firestore.rules` as the only security boundary; keep `utils/externalAccess.ts` as the only view whitelist.
- Every new collection or view needs an explicit decision for externals, with an emulator test in `tests/rules/`.

### R-050 memberCards Can Stay Stale After a Failed Sync (P2)

Evidence: `membersService` calls `MemberCardsService.syncCards` after the member write, in a separate batch (`services/membersService.ts`, createMember / updateMember / soft delete / updateMemberRole / bulk update). `services/memberCardsService.ts` catches and logs a failure and does not rethrow, so the member save stands.

Risk: after a failed sync the card keeps its old data until the member is saved again or `scripts/backfillMemberCards.mjs --apply` runs. If a member was set to INACTIVE or soft-deleted and the delete-card batch failed, the old card stays readable by external users with `international == true` or the same chapter. The backfill reports orphan cards but never deletes them, so those need a manual fix.

Recommended action: search errorLogs for `MemberCardsService.syncCards`; after any incident, run the backfill in dry-run mode first, then with `--apply`; delete orphan cards of deleted or INACTIVE members by hand, or extend the backfill.

### R-051 Writers That Bypass the Client Service Do Not Sync Cards (P1)

Evidence (2026-10-19):

- `hooks/useAuth.tsx` writes `members` directly: `setDoc` at sign-up (about line 527) and `deleteDoc` of an old profile (about line 536). Neither calls `MemberCardsService.syncCards`.
- At least eight `netlify/functions/*.mjs` files reference `members` together with write calls (`annual-dues-reminders`, `auto-invite`, `birthday-notifications`, `lark-sync`, `member-auth`, `send-invite`, `toyyibpay-api`, `toyyibpay-callback`). This was a rough grep, not a per-file check; those functions use the Admin SDK and do not sync cards.

Risk: cards can be missing for members who became MEMBER+ through these paths, and cards can be orphaned when a member doc is deleted or demoted through them. The card rules block writing a card without a member doc, but they do not remove an existing card when the member doc goes away.

Recommended action: confirm each function's `members` writes one by one; move card sync into the server writers (`utils/memberCard.mjs` is plain JS and can be imported from `netlify/`), or schedule the backfill; decide what the old-profile delete in `useAuth` should do with the card.

Update (2026-10-20, Phase 1): `useAuth().updateMemberProfile` now syncs the card after the member write (`MemberCardsService.syncCards`, `applyMergeUpdates` in `utils/memberCard.mjs`), and the new `netlify/functions/external-accounts.mjs` writes and deletes cards in the same batch as the member doc. The sign-up `setDoc` / old-profile `deleteDoc` in `useAuth` and the other Netlify functions listed above are unchanged.

### R-052 Member Docs Without loId Disappear From KL List Queries (P1)

Evidence: since Phase 0, non-admin `members` list queries carry `where('loId', '==', 'jcikl')` (`services/membersService.ts`: getAllMembers, role lookup, email lookup, churn-risk lookup). `firestore.rules` `members` list requires `resource.data.loId == 'jcikl'` for non-admins. Client-side `isKlMember` (`utils/memberScope.ts`) treats a missing `loId` as KL, but the server query does not return such docs.

Risk: legacy or imported member docs without `loId` are invisible to non-admin KL users (board, members) in every list, while admins still see them. Nothing fails visibly.

Recommended action: find members with no `loId` and set `loId = 'jcikl'` after review (data fix, not a code change); check `loId` on every import path.

### R-053 BOARD Can Create a Member Doc With Any Role, Including ADMIN and SUPER_ADMIN (P1, resolved)

Evidence: `firestore.rules` `match /members/{memberId}` create: the branch `isBoard() || (...)` skips field checks, and the only role check on create is `(isAdmin() || role != 'CHAPTER_ADMIN')`. The update rule stops BOARD from setting ADMIN / SUPER_ADMIN / CHAPTER_ADMIN; the create rule does not.

Risk: a BOARD user can create a member doc with an admin role. It is not a one-step takeover (the doc must be created under a uid that has no member doc yet), but it is a privilege gap that the update rule already closed.

Recommended action: apply the same role guard on create as on update (`isAdmin()` required for ADMIN, SUPER_ADMIN and CHAPTER_ADMIN), and add a rules test.

Resolution (2026-10-19): the `members` create rule now requires `isAdmin()` for ADMIN, SUPER_ADMIN, AFFILIATE and CHAPTER_ADMIN, the same guard as update. Rules tests in `tests/rules/externalMembers.rules.test.ts` ("R-053") confirm BOARD is denied ADMIN / SUPER_ADMIN creates and can still create MEMBER and BOARD docs, and ADMIN can still create ADMIN. Live once `firestore.rules` is deployed.

### R-054 Hobby Club Join Fails for Non-Lead Members (P1, resolved)

Evidence: `services/hobbyClubsService.ts` adds the member to `memberIds` on the club doc inside `runTransaction` (about lines 169-190). `firestore.rules` `match /hobbyClubs` update allows only Board / Admin, or the club lead (`isMember() && leadId == uid`) with descriptive fields. A member joining is therefore denied.

Risk: joining a hobby club fails for everyone who is not the lead or board, and the failure is only visible as a permission error.

Recommended action: allow a member to add only their own uid to `memberIds` (with the capacity check and no other field changes), and add a rules test for join and leave.

Resolution (2026-10-19, owner decision): "Join" means joining the club's external group chat (WhatsApp / LINE / Discord), not an in-app membership. The club card's button now opens the club's `whatsappUrl` (set by the lead in the create/edit form as "Group Chat Link"; http/https only) and is disabled with "No group link yet" when none is set. The in-app join, leave, member count and member list were removed (`HobbyClubsService.joinClub` / `leaveClub` / `getClubMembers` and the hook wrappers), so no write to `memberIds` happens and the rules need no change. Leftover data: `membersCount` and `memberIds` stay as historical snapshots, still read by `BoardDashboard` (club stats) and `MemberDetail` (a member's clubs).

### R-055 Members List Email Clause Uses request.query.filters, Which Rules Do Not Provide (P2, pre-existing)

Evidence: the `members` list rule contains `request.query.filters.get('email', [])` and `request.query.filters.email` clauses (email lookup for account linking).

Risk: the email lookup is either never allowed or behaves unpredictably. No test covers it, and the rule reads as if it works.

Recommended action: replace the clauses with a form Firestore supports (a list query that is constrained by a field in the rule, or the `memberEmails` lookup), and cover the account-linking lookup with an emulator test.

### R-056 Several List Rules Are Broad and Rely on Service-Layer Filtering (P2, pre-existing)

Evidence (rule text, 2026-10-19): `eventRegistrations` list allows any `isMember()`; `paymentRequests` list allows any `isMember()` (comment: "ownership enforced by service-layer filter only"); `toyyibBills` list allows any `isMember()`.

Risk: any member can list every event registration, payment request and ToyyibPay bill with a direct query, not only through the app's own service.

Recommended action: narrow each list rule to a field the rule can check (for example `where('memberId','==',uid)` for member lists), and add emulator tests for a member listing another member's records.

### R-057 Property Test for pointsRule Fails With "doc() cannot be called with an empty path" (P3, pre-existing)

Evidence: `tests/property/pointsRule.properties.test.ts` (uses `services/pointsRuleService`). The failure was reported in the Phase 0 integration run; it was not re-run in WP5, which changed docs only.

Risk: a red property test hides whether the points-rule code has a real defect.

Recommended action: reproduce with `npm test -- tests/property/pointsRule`; fix the generator (an empty id) or guard the service call.

### R-058 Phase 1 Gaps for External Members (P2)

Evidence (2026-10-19 code check):

- The external directory and birthdays are not wired to `memberCards`: no app code reads `COLLECTIONS.MEMBER_CARDS` outside the sync service and tests.
- The external own-profile view (`components/modules/Members/MyProfileSelfView.tsx`) does not import `MembersView`; the reuse of `MembersView` is still a Phase 1 item.
- `events` `allow list: if true` (`firestore.rules`), and no external-specific KL filter exists for the events list.

Risk: until these are done, externals either see nothing in the directory and birthdays, or see events from every chapter.

Recommended action: point the directory and birthday views at `memberCards` (with the rules' query constraints: `international == true` or own `loId`); reuse `MembersView` for the own-profile view or document why not; add a chapter filter for external users to the events list.


Update (2026-10-20, Phase 1): the external directory now reads `memberCards` through `hooks/useSisterChapterMembers` (external users get `international == true` cards, including opted-in KL cards, plus their own chapter's cards; see R-064). External birthdays do not read `memberCards`: they come from the new `netlify/functions/chapter-birthdays.mjs`. `events` `allow list: if true` is unchanged; external users now get only events KL hosts or co-hosts because `EventsView`, `DashboardHome` and `MyProfileSelfView` use the KL events query and `isEventVisibleToExternal` in the app, so a direct query still returns every event. `MyProfileSelfView` still does not import `MembersView`; that reuse is still open.

## Added 2026-10-20: Phase 1 External Members

### R-059 Self Sign-Up Dropped the Profile Fields the Form Collected (P2, resolved)

Evidence: `components/auth/RegisterModal.tsx` passed flat `fullName`, `phone`, `gender`, `dateOfBirth` and `nationality`, while `hooks/useAuth.tsx` `signUp` reads only `additionalData.general.*` and `contact.phone`, so the form values were dropped without an error.

Risk: every self-registered GUEST doc lacked full name, gender, date of birth, nationality and phone.

Resolution (2026-10-20, `phase1/integration`): `components/auth/signUpExtras.ts` `buildSignUpExtras` nests the values as `general.fullName` / `gender` / `dob` / `nationality` and `contact.phone` and leaves empty values out (Firestore rejects nested undefined). The sign-up payload builders moved to `utils/signUpPayload.ts`. Tests: `tests/unit/signUpExtras.test.ts`, `tests/unit/signUpPayload.test.ts`. `birthdayMMDD` is still not set at sign-up: the GUEST create whitelist in `firestore.rules` does not allow it.

### R-060 Guest Event Registration Always Failed (P1, resolved)

Evidence: `EventsService.registerGuestForEvent` ran a transaction that read `guestRegistrations`, and signed-out visitors cannot read it (board / admin only). The phone-index doc also failed the create rule's required-field check. Separately, `cancelGuestRegistration` writes `cancelledAt`, which was not in the update whitelist, so the whole cancel batch was denied for board / admin.

Risk: no guest could register for an event, and a board member could not cancel a guest registration.

Resolution (2026-10-20, `phase1/integration`): the service does no reads and writes the main doc and the phone-index doc in one `writeBatch` with deterministic ids. The create rule accepts the main shape (`status == 'Pending'`) or the phone-index shape (`_indexFor == 'phone'`); an existing id turns the write into an update, which guests may not do, so the batch fails and the form shows "already registered". The update whitelist gains `cancelledAt`, and the index doc may change `status` only. Tests: `tests/rules/guestRegistrations.rules.test.ts`. `cancelGuestRegistration` still has no caller in the app. See R-072.

### R-061 Survey Submit Failed for Everyone but Board and Admin (P1, resolved)

Evidence: `SurveysService.submitResponse` raises `surveys.responsesCount` in its transaction (the `surveys` update rule was board / admin only) and first reads its own not-yet-existing response id (the `surveyResponses` get rule read `resource.data.memberId`, which is denied for a missing doc).

Risk: members and external users could not submit a survey response.

Resolution (2026-10-20, `phase1/integration`): `surveys` update lets anyone who may read the survey change only `responsesCount` (exactly +1) and `updatedAt`; `surveyResponses` get is allowed when the doc does not exist. Rules tests reproduce both failures.

### R-062 Hobby Club List Dropped Clubs Without an isDeleted Field (P1, resolved)

Evidence: `HobbyClubsService.getAllClubs` used `where('isDeleted', '!=', true)`, which also drops documents that have no `isDeleted` field; `createClub` never writes it, so almost no club was listed.

Risk: KL members saw (almost) no hobby clubs.

Resolution (2026-10-20, `phase1/integration`): soft-deleted clubs are filtered and clubs sorted by name in code, no index change. A unit test reproduces the old behaviour with Firestore's `!=` semantics.

### R-063 Event Mark-Paid Threw When No Bank Account Id Was Given (P1, resolved)

Evidence: the event "Mark as paid" flow created the income transaction without a `bankAccountId`, and the `transactions` create rule requires `bankAccountId`.

Risk: marking an event registration paid failed, so no payment could be recorded from the event screen.

Resolution (2026-10-20, `phase1/integration`): `services/eventPaymentService.ts` `markRegistrationPaid` resolves the account (the project's `financialAccountId` when it is one of the LO's bank accounts, else the first MYR account, else the first account; a readable error when none exists), prefills the amount from `price || priceMin` for finance to confirm (see R-080), and removes the transaction again if the registration update fails. See R-070 for what is left.

### R-064 International Directory Ran on Mock Data and Hid KL Cards From External Users (P2, resolved)

Evidence: `BusinessDirectoryView` used `MOCK_SISTER_CHAPTER_MEMBERS` and its sister-chapter filters did not apply to real data; `MemberCardsService.getInternationalCards` dropped cards with `loId == 'jcikl'`, so external users could not see KL members who had opted in.

Risk: the directory showed fake people, and external users could not see KL cards or their own chapter's cards.

Resolution (2026-10-20, `phase1/integration`): the directory reads cards through `useSisterChapterMembers` and the mock file is removed; external users get `international == true` cards (KL included) plus their own chapter's cards, merged by `mergeCards`; KL gets a fixed chapter entry in `attachSisterChapters`. Test: `tests/unit/internationalCards.test.ts`.

### R-065 Global Relations "Remove Member" Always Failed (P2, resolved)

Evidence: `MembersService.deleteMember` has a client-side check that denies any admin whose `loId` differs from the target's, so a KL admin could not remove a sister-chapter doc, although the `members` update rule lets `isAdmin()` edit any LO.

Risk: sister-chapter people could not be removed from Global Relations.

Resolution (2026-10-20, `phase1/integration`): narrow exception in `deleteMember` (KL admin, `loId == 'jcikl'`, target in another chapter); the check is client-side only and the rules did not change. Global Relations now suspends login-backed external members through `external-accounts` `setStatus` (card removed, login and record kept) and soft-deletes only legacy docs without a login (role MEMBER, `loId` not `jcikl`).

### R-066 Sign-Up Email Pre-Check Cannot Work; Self-Registered External Users Have No memberEmails Slot (P2)

Evidence: `RegisterModal` `checkField` posts to `netlify/functions/check-member-field.mjs` with no `Authorization` header, but that function requires a BOARD / ADMIN / SUPER_ADMIN token, and it queries the top-level `email` field of `members` (new docs keep `contact.email`). The form treats a response without `exists` as "available". `signUpExternal` writes no `memberEmails` doc: the `memberEmails` create rule is B+ only.

Risk: the "email taken" hint never shows for a visitor, and a self-registered external person holds no slot, so slot-based duplicate checks (`MembersService.createMember`) do not see them. `external-accounts` also checks Firebase Auth, so an invite to the same email is still refused.

Recommended action: replace the pre-check with a token-free server check or remove it; write the slot on the server when the request is approved.

### R-067 advertisements.targetAudience Is Never Enforced (P2, pre-existing)

Evidence: `targetAudience` is written by `AdvertisementsView` and only used in its list search; no delivery code reads it. Phase 1 added `targetCriteria.audiences` and `targetCriteria.countries`, read only by `MemberBenefitsView` through `utils/benefitEligibility.ts`; `roles`, `tiers` and `memberIds` are not enforced there either, and other ad surfaces were not checked. `advertisements` is publicly readable in `firestore.rules`.

Risk: an admin who picks a tier or role audience expects filtering that does not happen; for external users the audience check exists only in the Benefits view.

Recommended action: use `audiences` / `countries` as the one targeting source on every ad surface, and hide or remove the unused fields.

### R-068 External Event Payments Depend on Finance Discipline (P2)

Evidence: `EventDetailModal` `handleMarkPaid` checks `canOperateFinance`, but the Mark Paid / Undo Payment buttons in `EventParticipantsTab`, `EventRegistrationsList` and `EventRoleParticipantsList` are not hidden by role, and `handleUndoPaid` has no role check; the real gate is the rules (`transactions` create and delete are Finance / admin). External events show the listed price number with a USD sign and no conversion. The mark-paid window now prefills "Amount received (MYR)" with `price || priceMin` and finance must confirm or edit it (0 records no transaction), so a USD registration is booked as that same number of ringgit only if finance accepts the prefill. `transactions.currency` is declared but nothing writes it.

Risk: wrong buttons shown to some roles, and a careless confirmation books a USD price as ringgit.

Recommended action: hide the buttons for roles without `canOperateFinance`; consider a conversion rate for USD registrations; write or drop `transactions.currency`.

### R-069 useEventParticipations Reads Firestore Directly and Reads the Wrong Name Field for Guests (P3)

Evidence: `components/modules/Events/useEventParticipations.ts` imports `firebase/firestore` and queries `guestRegistrations` itself (a layer breach, see R-022), and builds guest rows with `data.general?.name`, while guest docs hold a top-level `name`. The guest query is board / admin only in the rules and sits in the same `Promise.all` as the member list.

Risk: guest rows in the participant list show no name; a viewer who is not board / admin would get a denied guest query that fails the whole list load (if that tab is reachable for them).

Recommended action: move the query into a service and read `name`.

### R-070 projects.financialAccountId Is Never Written; Offline Payment Note Is a Placeholder (P3)

Evidence: nothing in `services/`, `components/` or `hooks/` writes `financialAccountId` on a project doc (`EventPaymentService.resolveBankAccountId` reads it; the only writers are mock data), so mark-paid falls back to the first MYR bank account. `EXTERNAL_OFFLINE_PAYMENT_NOTE` in `config/constants.ts` is one global placeholder text shown to every external user.

Risk: event income may land in the wrong account; external users get generic payment instructions.

Recommended action: add a project-level account selector, and replace the note text (or make it configurable).

### R-071 external-accounts Cannot Be Tested Locally and Has No Rate Limit (P2)

Evidence: `netlify/functions/external-accounts.mjs` uses `firebase-admin/auth`, which fails under local `netlify dev` (see R-040), so its first real run is on a deploy preview. It has per-call (20) and per-chapter (100) caps but no rate limit; `chapter-birthdays.mjs` has none either. The existing in-memory limits (`auto-invite`, `send-invite`) are per function instance and reset on a cold start.

Risk: an unverified function creates Auth users and sends email; a compromised chapter admin token can create accounts up to the caps.

Recommended action: verify create, invite, setStatus and resend on a deploy preview before release; add a persistent rate limit if abuse is a concern.

### R-072 Guests Cannot Register Again After Cancelling (P3, by design)

Evidence: the guest registration id is `{eventId}_{emailKey}`; registering again is a `set` on an existing id, which is an update and is denied for guests (R-060). A cancelled doc stays in place.

Risk: a guest who cancelled cannot come back with the same email or phone for that event.

Recommended action: accept it, or let board delete the cancelled docs (delete is allowed for board).

## Added 2026-10-20: Phase 1 Review Fixes

All fixes below are on `phase1/integration` (not merged or deployed yet).

### R-073 KL Self Sign-Up Always Failed on a Nested undefined (P0, resolved)

Evidence: the sign-up payload (`utils/signUpPayload.ts` `buildSelfSignUpMember`) left `others.bio: undefined` when the form gave no bio; the old `stripUndefined` only removed top-level undefined, and Firestore rejects nested undefined, so the `members` write failed. If it failed, the Firebase Auth user created a moment earlier stayed behind without a profile.

Risk: new KL applicants could not register, and each failed attempt left an orphan Auth account.

Resolution: `stripUndefined` now cleans plain objects at every depth (Timestamps and arrays are kept), and `buildExternalSignUpMember` uses it too. `hooks/useAuth.tsx` `signUp` now deletes the new Auth user when the profile write fails (the same rollback `signUpExternal` already had).

### R-074 A Chapter Admin Could Undo KL Decisions (P1, resolved)

Evidence: reactivation of a suspended member was allowed when `affiliation.activatedAt` was set, which says nothing about who suspended them, so a chapter admin could lift a suspension made by JCI KL. The client rules branch for CHAPTER_ADMIN also allowed `expired` → `suspended` and other writes of the status field from the browser.

Risk: a chapter admin could override KL's suspension, and could change status in ways the `external-accounts` transition table does not allow.

Resolution: `setStatus` stamps `affiliation.suspendedByRole` (`KL` or `CHAPTER_ADMIN`) on every change to suspended, and a chapter admin may reactivate only when it is `CHAPTER_ADMIN`; `ChapterAdminView` shows Reactivate on the same condition. The client branch in the `members` update rule was removed, so chapter admins write no member docs from the browser.

### R-075 Anyone Could Fill a Chapter's Member Cap Through Self-Registration (P1, resolved)

Evidence: the 100-member cap counted every member doc of the chapter, and anyone can self-register a `pending_chapter` doc.

Risk: a flood of self-registrations could block real invites.

Resolution: the function counts only members with `affiliation.status` in `CAP_COUNTED_STATUSES` (`active`, `suspended`); pending, rejected and expired docs do not use a place. See R-086 for the index.

### R-076 Survey responsesCount Could Be Inflated (P2, resolved)

Evidence: the `surveys` update rule let anyone who could read a survey add 1 to `responsesCount`, with no link to an actual response and regardless of the survey status.

Risk: a user could push the response counter up without answering.

Resolution: a non-board / non-admin update must be on an `Active` survey, change only `responsesCount` (+1) and `updatedAt`, and in the same write create the caller's own `surveyResponses/{surveyId}_{uid}` (the rule checks the doc is absent before and present after).

### R-077 Self-Registration Category Was Not Tied to the Chapter (P2, resolved)

Evidence: the external self-registration rule accepted any `affiliation.category` of `sister`, `apicc` or `global`.

Risk: a self-registered person could pick a category that does not match their chapter and so change what they see (benefit audiences).

Resolution: the rule requires `affiliation.category == categoryForChapterType(chapter.type)`. See R-083.

### R-078 Registrations and Responses Could Be Probed by Id (P2, resolved)

Evidence: `eventRegistrations` get and `surveyResponses` get allowed reading a missing doc under any id, so "not found" versus "permission denied" told a user whether another member had registered or answered.

Risk: leaks who registered for an event or answered a survey.

Resolution: a missing `eventRegistrations` doc may be read only when its id ends with `_` plus the caller's uid; a missing `surveyResponses` doc only under `{surveyId}_{uid}`. See R-084 and R-085.

### R-079 Guest Registration Was Accepted for Events That Do Not Exist (P2, resolved)

Evidence: the `guestRegistrations` create rule checked only the shape of the data, so a signed-out visitor could create registrations for any `eventId`.

Risk: junk documents for made-up or unlisted events.

Resolution: create also requires `projects/{eventId}` to exist with status Active, Upcoming or Approved (the statuses the guest events page lists). See R-082.

### R-080 Mark-Paid Recorded the Lowest Tier of Tiered Prices (P2, resolved)

Evidence: `markRegistrationPaid` used `price ?? priceMin`, and for an event with tiered prices that booked the lowest tier regardless of what the payer actually paid.

Risk: wrong income amounts in finance.

Resolution: the mark-paid window asks finance to confirm the MYR amount actually received, prefilled with `price || priceMin`; the transaction `amount` is that confirmed value, and `originalAmount` (USD registrations only) keeps the listed price.

### R-081 Survey Responses Could Be Created Under Any Id (P2, resolved)

Evidence: the `surveyResponses` create rule accepted any document id as long as the data fields matched, so one user could add several responses.

Risk: duplicate or extra responses counted in survey results.

Resolution: users other than board / admin must use the id `{surveyId}_{uid}` (the id `SurveysService.submitResponse` already used), and an existing id is still refused.

### R-082 Accepted: A Signed-Out Visitor Can Pre-Claim a Guest's Email or Phone (P3, accepted)

Evidence: guest registration ids are `{eventId}_{emailKey}` and `{eventId}_phone_{phoneKey}`, and creating them needs no login (R-060, R-072). Anyone can register an email or phone for a listed event, and the real owner is then refused as "already registered".

Risk: a visitor can block someone else's guest registration for that event.

Decision: accepted for now; board can delete the pre-claimed docs (delete is allowed for board).

### R-083 Rules categoryForChapterType Duplicates categoryForChapter (P3)

Evidence: `firestore.rules` `categoryForChapterType` and `utils/affiliation.mjs` `categoryForChapter` implement the same mapping (`sister_lo` then `apicc` then `global`, default `sister`), and rules cannot import code.

Risk: if one changes alone, self-registration is refused (or accepts a wrong category).

Recommended action: change both together; the rules tests in `tests/rules/wp3SelfRegister.rules.test.ts` and the unit tests should cover the same cases.

### R-084 Survey Ids Must Not Contain an Underscore (P3)

Evidence: the `surveyResponses` get rule takes everything before the first `_` as the survey id (`responseId.split('_')[0]`), and the `surveys` update rule builds `{surveyId}_{uid}`. Survey ids are Firestore auto-ids, which contain no `_`.

Risk: a hand-made survey id with `_` would break the missing-doc read and the dedup check.

Recommended action: never create surveys with custom ids.

### R-085 The eventRegistrations Missing-Doc Check Is Suffix-Only (P3)

Evidence: the `eventRegistrations` get rule allows a missing doc when its id ends with `_` plus the caller's uid; it does not check the part before it.

Risk: theoretical only: a uid that itself contains `_` could match a suffix of another id. Firebase auto uids do not contain `_`, and a match only reveals that the doc is absent.

Recommended action: none now; tighten if custom uids are ever introduced.

### R-086 Deploy Note: Composite Index members (loId, affiliation.status) (P2)

Evidence: the cap count (R-075) queries `members` with `loId ==` and `affiliation.status in [...]`; the index is in `firestore.indexes.json`.

Risk: if the rules and function go live without the index, creating or inviting external accounts fails on the count query.

Recommended action: deploy `firestore.indexes.json` together with `firestore.rules` (and wait for the index to build) before releasing the function.

### R-087 updateMember Used to Turn External Members into MEMBER (P1, resolved)

Evidence: `MembersService.updateMember` ran `syncComputedMembershipType` for every member. For AFFILIATE / CHAPTER_ADMIN it wrote `jciCareer.membershipType` and `role: 'MEMBER'` (`roleForMembershipType` returns MEMBER for any non-KL role). Self-updates (e.g. "Share my card") were denied by the rules; admin edits would have silently converted the external into a KL MEMBER.

Risk: externals could not opt in to card sharing; any admin edit of an external through updateMember changed their role.

Resolution (2026-10-25): `updateMember` and `batchUpdateMembers` skip the membership-type recompute and the GUEST→MEMBER dues setup when the current doc is external. Rules test `tests/rules/externalSelfUpdate.rules.test.ts` replays the real payload. Production check the same day: all 6 non-KL member docs still have their external role and no `jciCareer.membershipType`.

### R-088 Permission Errors for External Members on Every Page (P1, resolved)

Evidence: production errorLogs for a test CHAPTER_ADMIN showed ~90 "Missing or insufficient permissions" entries: the App-level bell loaded all `communication` posts and listed notifications (list was B+ only); the Benefits page loaded `promotionPackages`; the search dropdown loaded `getAllBusinesses` → `getAllMembers`; sign-in ran the KL board-seat check; the profile page used the legacy `MyProfileSelfView`.

Resolution (2026-10-25): the bell uses `useCommunication({ loadPosts: false })`; `notifications` list allows any signed-in user to list their own (query must carry `where('memberId','==',uid)`), which also fixes ordinary KL members never seeing their notifications; Benefits uses `useAdvertisements({ loadPackages: false })`; `useBusinessDirectory({ enabled })` is off for externals in the search dropdown; sign-in skips `ensureMemberBoardFieldsSynced` for externals. Externals' profile is `MemberDetail` (self view, Basic tab only) plus `ExternalSharingSettings`; KL-only loads are gated by `canRunLoader` / `KL_ONLY_LOADERS` in `utils/externalAccess.ts`.

### R-089 errorLogs Entries Without a Label (P3)

Evidence: `errorLoggingService.logError` keeps only `component`, `action` and `additionalData`; calls that pass `{ context: '...' }` are stored with no component or action.

Risk: such errors are hard to trace from errorLogs.

Recommended action: map `context` into `action` in `errorLoggingService`.

### R-090 KL Member Self-Edit in MemberDetail May Be Rejected (P2, unverified)

Evidence: the MemberDetail save payload includes introducer, senatorship and nationality defaults ('Malaysia' when empty), some of which the members self-update rule locks. Found while fixing R-088; not tested for KL members.

Recommended action: replay a KL MEMBER self-edit payload against the rules in the emulator (as done for externals) and strip locked keys if needed.

### R-091 Writes Silently Denied for Non-Privileged Users (P3)

Evidence: `AdvertisementService.getActiveAdvertisements` marks expired ads with a Board-only write; `firestoreLogger` writes to admin-only `systemLogs`. Both fail for ordinary users (logged as warnings or silently).

Recommended action: move these writes to an admin path or drop them for non-privileged users.

### R-092 External Account Deletion Is Permanent (P2, accepted by owner 2026-10-26)

Evidence: `netlify/functions/external-accounts` action `deleteAccount` (scope in `netlify/lib/externalAccounts.mjs` `canDeleteAccount`: KL ADMIN / SUPER_ADMIN → any AFFILIATE / CHAPTER_ADMIN whose loId is not `jcikl`; active CHAPTER_ADMIN → own-chapter AFFILIATE; never self, never KL). One Admin batch deletes `members/{id}`, the `memberEmails` slot(s) whose `memberId == id`, `memberCards/{id}`, `emailChangeRequests/{id}` and `publicBusinessListings/{id}` and writes the `auditLog` entry; then the Firebase Auth user is deleted.

Recovery path: none. There is no soft delete, trash or backup restore for these docs; the `auditLog` entry keeps only role, loId, previous status and counts (no name, no email). To bring a person back, invite them again (new member id; old history is not re-linked).

Kept on purpose (history, now pointing at a missing member): `eventRegistrations`, `surveyResponses`, `notifications`, `benefitUsage`, `auditLog` and any other record that stores the `memberId`. Pages that look up the name show a placeholder. The avatar image on Cloudinary is not deleted.

Partial failure: if deleting the Auth user fails after the batch, the response is `authDeleted: false` and the login still exists without a profile (it can sign in but has no member doc, so the app shows no data). A KL admin retries by pressing Delete again in Global Relations (the row stays until the login is gone); the server allows the retry only for a KL admin and only when an earlier `external_accounts_deleteAccount` audit entry exists for that id. A chapter admin cannot retry; their toast asks JCI KL to finish, and JCI KL then needs the member id from the `auditLog` entry.

Recommended action: none required; consider an export of the member doc into the audit entry if the owner later wants an undo.

## Added 2026-10-26: Member Offer Audience

### R-093 Directory and Card Ignored the specialOffers Array (P2, resolved 2026-10-26)

Evidence: `services/businessDirectoryService.ts` `mapMemberToBusinessProfile` and `utils/memberCard.mjs` `buildMemberCard` read only the legacy `business.specialOffer`, so offers saved in `business.specialOffers` never showed "Deal" or counted under "Has Deal", and paused or expired offers still did.

Fix: both read `utils/specialOffers.mjs` `getLiveOffers` (both formats; `specialOffers` wins when it is an array) and use the first live offer for the deal / `specialOfferSummary`. Tests: `tests/unit/directoryOfferParity.test.ts`, `utils/memberCard.test.ts`.

### R-094 Benefits Page Showed Paused and Expired Member Offers (P2, resolved 2026-10-26)

Evidence: `MemberBenefitsView` listed every member offer regardless of `status` / `expiryDate`.

Fix: other members' offers are listed only when `isOfferLive(offer, today)`; the owner still sees their own, labelled "Paused" or "Expired". Tests: `utils/specialOffers.test.ts`.

### R-095 Card Offers Go Stale After Their Expiry Date (P3)

Evidence: a card is rewritten only when its member is saved (`MemberCardsService.syncCards`) or by `scripts/backfillMemberCards.mjs`. An offer that expires later stays in `memberCards.specialOffers` / `specialOfferSummary` until then.

Mitigation: readers of `memberCards.specialOffers` re-check `isOfferLive` (external Benefits page, `directoryFacets.ts` `cardToDirectoryItem`). A card that is not shared has only `specialOfferSummary`, which cannot be re-checked, so a KL user may see an expired "Deal" on a non-shared sister-chapter card until that member saves again.

Recommended action: run the card backfill after deploy (owner decision; this change did not run it against production), and optionally on a schedule.

### R-096 Member Offers Cannot Be Claimed (P3, existing gap)

Evidence: the Benefits page has no claim action; "Claimed" only reflects existing `benefitUsage` records. `MemberBenefitsService.claimBenefit` looks the benefit up in `memberBenefits` / `advertisements`, so a member offer id (`member_offer_<memberId>_<n>`) has no benefit doc and its transaction update would fail. This is true for KL and external viewers alike. `firestore.rules` already lets active externals create their own `benefitUsage`, so a future claim path needs no rules change for the usage record itself.

Recommended action: decide whether member offers should be claimable; if so, add a usage-only path (no counter update) for member offers.
