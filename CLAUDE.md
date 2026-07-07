# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev          # Vite dev server on port 3000
npm run build        # Production build → dist/
npm run preview      # Preview production build locally
npm run dev:a11y     # Dev server with axe-core accessibility scanning enabled
npm test             # Vitest test suite
npm run test:ui      # Vitest with browser UI
```

There is no separate lint script; TypeScript strict-mode compilation (`tsc --noEmit` via build) is the linting gate.

## Architecture Overview

This is a production-grade React 19 + Firebase SPA for managing the JCI Kuala Lumpur chapter — covering members, events, projects, finance, gamification, governance, and AI insights.

**Tech stack:** React 19, TypeScript 5.8 (strict), Vite 6, Tailwind CSS, React Router v7, Firebase (Firestore, Auth, Storage, FCM), Netlify Functions, Cloudinary, ToyyibPay.

### Layer model

```
index.tsx            → providers (AuthContext, Toast, A11y)
App.tsx              → SPA router, lazy-loaded module views, layout shell
components/modules/  → Feature views (lazy-loaded via React.lazy)
hooks/               → Data hooks (wrap service calls, own loading/error state)
services/            → Business logic + all Firestore queries (static classes)
config/firebase.ts   → Firebase SDK init, auth persistence, App Check
config/constants.ts  → Firestore collection names, role constants
types.ts             → All domain TypeScript interfaces (~2000 lines)
```

### Data flow

1. **Auth** — `useAuth` hook (hooks/useAuth.tsx) owns the Firebase Auth session and exposes the current user + role to the whole app via React Context.
2. **Permissions** — `usePermissions` (hooks/usePermissions.ts) drives all conditional rendering and route guards. Roles: `GUEST → PROBATION → MEMBER → BOARD → ADMIN → SUPER_ADMIN / INACTIVE`.
3. **Services** — All Firestore reads/writes live in `services/`. Services are static utility classes; they never hold React state. Key ones: `membersService`, `eventsService`, `projectsService`, `pointsService`, `financeService`, `automationService`.
4. **Hooks** — `hooks/useXxx.ts` files wrap service calls with `useState` + `useEffect`, returning `{ data, loading, error }` plus mutation helpers. Components call hooks, never services directly.
5. **State** — No Redux or Zustand. Global state is AuthContext + Firestore real-time listeners. Local UI state stays in components. `contexts/` holds two lightweight contexts (BatchMode, HelpModal).

### Key patterns

- **Dev mode** (`utils/devMode.ts`) — all services check `isDevMode()` and return mock data, enabling offline development without Firebase credentials.
- **Caching** — `cacheService.ts` provides TTL-based in-memory caching (typically 3–5 min) with prefix-based invalidation; services call it before hitting Firestore.
- **Code splitting** — All module views in `components/modules/` are `React.lazy()`-wrapped in App.tsx. Add new views the same way.
- **UI primitives** — Use `components/ui/Common.tsx` (Button, Card, Modal, Badge, Drawer, Toast, ProgressBar) and `components/ui/Form.tsx` (Input, Select, Checkbox, FormField) before creating new UI. `components/ui/Combobox.tsx` is the searchable-select component.
- **Error handling** — Wrap new async operations with `errorLoggingService` (logs to Firestore). `ErrorBoundary` and `AsyncErrorBoundary` are in `components/ui/`.

### Domain model highlights (types.ts)

- **Member** — nested `general / contact / business / jciCareer` sub-objects; flat aliases exist for backward compatibility.
- **Event / Project** — full lifecycle with committee assignments, financials, and attendance.
- **Points / Award / Badge** — gamification engine with tiers (Bronze → Legendary), milestones, escrow/bounty mechanics, and `IncentiveProgram` (yearly JCI-specific star targets).
- **Transaction / BankAccount** — double-entry finance with `TransactionSplit`, reconciliation, and `ProjectFinancialAccount` budgeting.
- **Workflow / Rule** — automation engine; triggers, conditions, and actions are all stored in Firestore and executed by `automationService` + `workflowExecutionService`.

### Firebase collections

Collection names are all in `config/constants.ts`. There are 48+ collections. The most-touched ones are: `members`, `events`, `projects`, `transactions`, `bankAccounts`, `points`, `pointRules`, `badges`, `achievements`, `incentivePrograms`, `incentiveSubmissions`, `paymentRequests`, `eventRegistrations`, `notifications`, `workflows`, `automationRules`.

Firestore security rules are in `firestore.rules` (34 KB). Composite indexes are in `firestore.indexes.json`.

### Deployment

- **Netlify** — primary hosting; config in `netlify.toml` (build command, redirects, CSP headers, cache-control rules). Serverless functions live in `netlify/functions/`.
- **Firebase Hosting** — secondary; config in `firebase.json` also covers Firestore rules, Storage rules, and Cloud Functions (Node 18).
- **PWA** — `vite-plugin-pwa` generates a service worker; `public/firebase-messaging-sw.js` handles FCM push notifications.

### Path aliases

`tsconfig.json` maps `@/*` → project root, so imports use `@/services/...`, `@/hooks/...`, etc.
