# JCI KL Risk Register

Generated from a read-only scan on 2026-08-24.

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
