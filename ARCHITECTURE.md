# JCI KL Current System Architecture

Generated from a read-only scan on 2026-08-24.

## Scope

This document describes the current repository shape as implemented, not only the earlier BMAD planning documents. The codebase is a brownfield JCI Kuala Lumpur management application with a React/Vite client, Firebase/Firestore data layer, Netlify Functions, Capacitor mobile shell, and BMAD process artifacts.

## Technology Stack

- Frontend: React 19, TypeScript, Vite 6, Tailwind CSS, lucide-react, React Router, React Query.
- Data/auth: Firebase Auth, Firestore, Firebase Storage, Firestore Security Rules.
- Server-side execution: Netlify Functions under `netlify/functions/` only. Firebase is on the Spark plan (no Cloud Functions); the never-deployed `functions/src/` was removed on 2026-10-19 and remains in git history.
- Mobile shell: Capacitor Android/iOS configuration under `android/` and `capacitor.config.ts`.
- Testing: Vitest plus property-based tests using fast-check.
- Process/documentation: BMAD artifacts under `_bmad/` and `_bmad-output/`, existing docs under `docs/`.

## Repository Shape

- `App.tsx`: main application shell, navigation state, lazy-loaded module registry, guest/authenticated layout switching, and role simulation UI.
- `index.tsx`: React root, providers, global error handlers, service worker registration.
- `components/`: feature views, UI components, layout, guest pages, dashboards, admin tools.
- `hooks/`: React-facing data and state hooks. Most hooks wrap a service class or Firestore collection flow.
- `services/`: application service layer. Most business modules access Firestore directly from the browser; some call Netlify Functions for privileged or third-party operations.
- `types/`: shared TypeScript domain types and view keys.
- `utils/`: shared permission, date, finance, board membership, validation, and dev-mode helpers.
- `config/`: Firebase config, constants, nationalities, collection names.
- `netlify/functions/`: server-side HTTP endpoints for Zoom, ToyyibPay, Cloudinary, auth admin actions, Lark sync, social AI rewrite, email, invites, push tests, audit logs, and scheduled birthday notifications.
- `firestore.rules`, `firestore.indexes.json`, `storage.rules`: Firebase security and indexing boundary.
- `scripts/`: migration, Lark, Firebase permission seeding/audit scripts.
- `tests/`: focused utility/property tests.

Approximate file counts from the scan: `components` 194, `services` 69, `hooks` 39, `utils` 18, `types` 15, `netlify/functions` 23, `tests` 8, `scripts` 15.

## Runtime Entry Points

### Browser App

`index.tsx` mounts the React app with:

- `HelmetProvider`
- `QueryClientProvider`
- `ToastProvider`
- `AuthProvider`
- `App`

It also installs global `error` and `unhandledrejection` handlers through `errorLoggingService`, and registers `/firebase-messaging-sw.js` for push/service-worker behavior.

### App Shell

`App.tsx` is the central navigation and layout shell. It keeps a `ViewType` state in `localStorage` as `jc_last_view`, switches between guest routes and authenticated workspace modules, and lazy-loads feature views such as:

- Dashboard, board dashboard, members
- Events, projects, flagship projects, activity plans
- Finance, payment requests, ToyyibPay
- Inventory, sponsorships, publications, advertisements
- Communication, surveys, social media, Zoom booking
- Automation Studio, workflow designer, system/config/developer tools

Guest routes are handled with `BrowserRouter` paths such as `/`, `/events`, `/projects`, `/about`, `/enewsletters`, and `/partnerships`.

### Serverless Functions

The repository has two server execution models:

- Netlify Functions are HTTP endpoints used for browser-to-server privileged operations and third-party integrations, plus scheduled jobs (birthday notifications, annual dues reminders).
- There are no Firebase Cloud Functions (Spark plan). Server-side or scheduled work belongs in Netlify Functions.

## Data And Domain Model

Collection names are centralized in `config/constants.ts` through `COLLECTIONS`. The app currently spans many domains, including:

- Member identity and profile: `members`, `memberEmails`, `promotionHistory`, `manualPromotionRequests`, `mentorMatches`.
- Events and participation: `events`, `eventRegistrations`, `eventBudgets`, `eventFeedback`.
- Finance: `transactions`, `projectTrx`, `bankAccounts`, `paymentRequests`, `reconciliations`, `transactionSplits`, `finance_alerts`, `counters`.
- Projects: `projects`, `tasks`, `projectReports`, `activityPlans`, `flagship_projects`.
- Engagement/gamification: `points`, `pointsRules`, `badges`, `achievements`, `incentivePrograms`, `loStarProgress`.
- Automation: `automationRules`, `workflows`, `workflow_executions`, `webhooks`, `webhook_logs`.
- Content/public: `communication`, `documents`, `publications`, `advertisements`, `partnerships`, `guestPageStats`.
- Integrations: `zoomBookings`, `toyyibBills`, `toyyibpay_webhooks`, `lark`-related scripts/config.

The app is currently mostly single-LO with `DEFAULT_LO_ID = 'jcikl'`, while many comments and rules show a future multi-LO intention.

## Access Control Model

There are three authorization layers:

1. UI permissions in `hooks/usePermissions.ts`.
2. Static role baseline in `utils/rolePermissions.ts`.
3. Firestore enforcement in `firestore.rules`.

Roles include `GUEST`, `MEMBER`, `BOARD`, `ADMIN`, `SUPER_ADMIN`, and `INACTIVE`. Dynamic board elevation depends on current board membership fields, and developer/dev-mode simulation can grant broader local permissions.

Important distinction: UI permission logic and Firestore rules intentionally differ in some places. Firestore `isBoard()` includes admin roles as a superset for collection access, while UI board-elevation excludes admin because admin already receives explicit permissions.

### External Members (Phase 0)

External users (`AFFILIATE`, `CHAPTER_ADMIN`: members of other chapters) are outside `isMember()` / `isActiveMember()` / `isBoard()` / `isAdmin()`.

- `utils/externalAccess.ts` is the single source of which views external users may open. Navigation and view rendering both read it; KL roles are not restricted by it. Access is client-side; `firestore.rules` (`isExternal()`, `isActiveExternal()`) is the real boundary.
- Public member cards live in `memberCards/{memberId}`. `services/memberCardsService.ts` (`MemberCardsService.syncCards`) writes them from `members` after each member write, using `utils/memberCard.mjs`. Cards are the only member data external users may read about other people.
- Scope and rule details: `SCHEMA.md` (`members.affiliation`, `memberCards`), `SCHEMA-PERMISSIONS.md`, `docs/PERMISSION_MATRIX.zh-CN.md`.

## Major Operation Flows

### Authentication

`useAuth.tsx` owns Firebase Auth state, member document loading, Google sign-in, email/password sign-in, self-registration, password reset, profile update, dev-mode login, role simulation, and impersonation. It requires an Auth user to have or link to a `members/{uid}` document before entering the authenticated app.

### Member Management

`MembersService` is the main member authority. It handles member reads/writes, profile synchronization, membership type computation, email deduplication patterns, board-field sync interaction, promotion/dues logic, and related cleanup/cascade operations.

### Finance And Payments

Finance spans `financeService`, `paymentRequestService`, `toyyibService`, `reconciliationService`, `projectFinancialService`, ToyyibPay Netlify endpoints, and the ToyyibPay callback handler. Several operations use transactions or batches for idempotency and reversal handling.

### Automation And Workflow

There are at least two overlapping workflow/automation implementations: `automationService.ts` and `workflowService.ts`. Both client-side services contain workflow execution concepts, idempotency guards, step execution, and webhook-like actions.

### External Integrations

- Zoom: `zoomBookingService.ts`, `zoom-create-meeting`, `zoom-cancel-meeting`, and `zoom-webhook`.
- ToyyibPay: `toyyibService.ts`, `toyyibpay-api`, and `toyyibpay-callback`.
- Cloudinary: `cloudinaryService.ts` and `cloudinary-delete`.
- Lark: `larkSyncService.ts`, `lark-sync`, and scripts under `scripts/lark/`.
- Email/invites: `emailService.ts`, `send-email`, `send-invite`, `auto-invite`.
- Social AI rewrite: `socialPostService.ts` and `social-ai-rewrite`.

## Testing And Quality Gates

Available scripts:

- `npm run build`
- `npm run test`
- `npm run dev`
- `npm run dev:netlify`

Existing tests are concentrated in `tests/property/` and some utility tests under `utils/`. Coverage appears stronger for pure logic than for UI flows, Firestore rules, Netlify Functions, or end-to-end workflows.

## Current Architecture Constraints

- The service layer is broad and mostly browser-side, so Firestore rules are the real security boundary.
- `App.tsx` remains a large orchestration file, which makes navigation and permission changes high-impact.
- There are two server runtimes and some duplicated domain logic across client services and server functions.
- Several files contain mojibake/encoding corruption in comments and user-facing strings.
- Existing BMAD architecture docs exist but appear older and partially encoding-corrupted; they are useful as intent/history, not as current implementation truth.

