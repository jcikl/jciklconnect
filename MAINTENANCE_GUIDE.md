# JCI KL Future Development And Maintenance Guide

Generated from a read-only scan on 2026-08-24.

## Maintenance Principles

- Treat Firestore rules and server-side functions as the security boundary; UI checks are only user experience.
- Prefer one canonical implementation per business capability.
- Keep business invariants in pure utilities or server-side command handlers, then call them from UI/services.
- Make high-risk state changes idempotent and auditable.
- Require tests for permission, finance, payment, automation, member identity, and import/export changes.
- Keep architecture docs current after major feature changes.

## Change Classification

Use this before starting work:

- Low risk: UI-only display changes, copy changes, small pure utility changes with tests.
- Medium risk: service read/query changes, non-sensitive form changes, module-local component refactors.
- High risk: Firestore writes, permissions, member data, finance, payment, integrations, automation/workflow, import/export, serverless functions.
- Critical risk: role changes, Firebase Admin usage, secrets/env vars, production payment callbacks, bulk destructive operations, Firestore rules.

High and critical changes require an impact note, tests, and rollback notes.

## Required Workflow For AI-Assisted Coding

Before editing:

- Identify touched domain: members, finance, events, projects, automation, integrations, system config, or UI.
- Read the matching service, hook, component, type, Firestore rule section, and any Netlify/Firebase function.
- State expected data writes and permission boundary.
- Check whether the same logic already exists elsewhere.

During editing:

- Keep changes scoped to one domain unless explicitly doing a cross-cutting refactor.
- Do not add a second workflow/payment/member rule engine.
- Do not put secrets in browser-visible `VITE_` variables.
- Do not rely on role checks in components alone.
- Preserve user changes in the working tree.

After editing:

- Run the smallest relevant test first.
- Run `npm run build` for TypeScript and Vite validation when the change touches app code.
- Run or add Firebase rules tests when changing `firestore.rules` or service write shapes.
- Update `ARCHITECTURE.md` when adding/removing runtime, module, collection, major service, or integration.
- Update `RISK_REGISTER.md` when resolving or discovering a risk.

## Ownership Boundaries

### Frontend Components

Own rendering, input collection, loading/empty/error states, and user feedback. They should not own authorization rules, payment truth, workflow truth, or irreversible business decisions.

### Hooks

Own React state orchestration and call services. They should not duplicate business calculations that already exist in services or utilities.

### Services

Own module-level application operations. A service may read Firestore directly when rules are simple, but privileged writes should be moved to server-side functions.

### Netlify Functions

Own browser-to-server privileged HTTP operations, external API calls, webhook verification, admin Firebase Auth operations, and secret-backed behavior.

### Firebase Cloud Functions

Own Firestore-triggered background behavior, scheduled/async domain processing, and Firebase-native events.

### Firestore Rules

Own the final authorization boundary for direct client Firestore access.

## Canonicalization Priorities

1. Permission matrix: define exactly what every role can read/write in UI, rules, and functions.
2. Workflow engine: choose `workflowService`, `automationService`, or a server-side implementation as canonical.
3. Member write path: route imports, signup linking, admin edits, promotions, and email dedup through one path.
4. Payment truth: define one source of truth for Toyyib bills, callbacks, payment requests, finance transactions, and reversal state.
5. Webhook delivery: move outbound webhook execution and signing server-side.
6. Encoding: normalize source/docs to UTF-8 and repair user-facing mojibake.

## Testing Strategy

### Unit Tests

Use for pure logic:

- permission matrix helpers
- membership type computation
- board membership and finance operator detection
- reference number generation
- payment request state transitions
- workflow condition evaluation
- import normalization
- date and Malaysian ID helpers

### Firestore Rules Tests

Use Firebase emulator tests for:

- `GUEST` cannot list sensitive member data.
- `MEMBER` can read/write only intended profile fields.
- `BOARD` cannot elevate users to `ADMIN` or `SUPER_ADMIN`.
- `INACTIVE` cannot self-write or access workspace data.
- finance collections reject non-authorized writes.
- multi-LO documents cannot be read/written across `loId`.

### Function Integration Tests

Mock Firebase Admin and third-party APIs for:

- ToyyibPay create bill and callback idempotency.
- Zoom create/cancel/webhook.
- Cloudinary delete.
- Lark sync authorization.
- auth admin functions.
- social AI rewrite limits and authorization.
- send email/invite rate and payload validation.

### End-To-End Smoke Tests

Use Playwright or equivalent for:

- guest landing/events/projects/about pages.
- login/logout.
- dashboard navigation.
- role-specific module visibility.
- member search/detail.
- payment request creation/approval happy path.
- ToyyibPay payment return display.

## Security Checklist

- No secrets in `VITE_` variables except intentionally public Firebase/browser config.
- No service account JSON in Git history.
- Every Netlify Function that writes privileged data verifies Firebase ID token.
- Every privileged function checks server-side role from Firestore or custom claims.
- Webhooks verify signatures or shared secrets.
- Payment callbacks are idempotent.
- External URLs are allowlisted or validated.
- Logs do not contain tokens, private keys, bank details, IC/passport numbers, or full payment payloads.
- Firestore writes use transactions/batches for money, status transitions, and deduplication.
- Bulk import/export is admin-only and audited.

## Documentation Rules

Keep these root docs current:

- `ARCHITECTURE.md`: current implementation map.
- `RISK_REGISTER.md`: known risks and mitigation status.
- `MAINTENANCE_GUIDE.md`: development rules and quality gates.

Recommended additional docs:

- `docs/PERMISSION_MATRIX.md`
- `docs/SERVER_FUNCTIONS.md`
- `docs/FIRESTORE_COLLECTIONS.md`
- `docs/WORKFLOW_ENGINE_DECISION.md`
- `docs/PAYMENT_STATE_MACHINE.md`

## Suggested Next Steps

1. Initialize Codegraph for future impact analysis.
2. Audit whether `.env` and `serviceAccountKey.json` are tracked or ever committed.
3. Build the permission matrix.
4. Add Firebase rules tests for member and finance boundaries.
5. Decide the canonical workflow/automation engine.
6. Repair encoding corruption in user-facing strings.
7. Split `App.tsx` into route/module registry and shell components.

