# JCI Gamification & Incentive Program Refactoring Tasks

## 🎯 Overview
Refactor the existing static, member-focused gamification system into a **Configuration-Driven**, dynamic reward engine centered around Local Organization (LO) Star Ratings. This will support multi-year configurations, hybrid submission handling (auto/manual), and a transparent progress tracking system.

---

## 🏗️ Phase 1: Data Model & Schema Updates (Firestore)

### 1.1 TypeScript Interfaces (`types.ts`)
- [x] define `IncentiveProgram` interface (Yearly program config, categories, special awards).
- [x] define `IncentiveStandard` interface (Specific rule, points, caps, deadlines, evidence requirements).
- [x] define `IncentiveSubmission` interface (Transaction log, approval status, evidence).
- [x] define `LOStarProgress` interface (Aggregated current progress for fast reads).

### 1.2 Firestore Setup & Seeding
- [x] Create corresponding Firestore collections (`incentive_programs`, `incentive_standards`, `incentive_submissions`, `lo_star_progress`).
- [x] Create a seed script or manual initial setup for the "2026_MY" default program.

---

## ⚙️ Phase 2: Service Layer Updates (`PointsService.ts`)

### 2.1 Configuration Services
- [x] Implement `getActiveProgram()`: Fetch the currently active yearly program.
- [x] Implement `getStandards(programId)`: Fetch all rules/standards for a given program.

### 2.2 Submission Services
- [x] Implement `submitIncentiveClaim(standardId, evidenceData)`: Support file uploads (to Firebase Storage) and URL submissions. Status defaults to `PENDING`.
- [x] Implement `getUserSubmissions(userId)` / `getLOSubmissions(loId)`: For history tracking.

### 2.3 Approval Services
- [x] Implement `getPendingSubmissions()`: Fetch submissions awaiting review.
- [x] Implement `approveClaim(submissionId, grantedPoints, approverId)`: Update status to `APPROVED` and trigger score aggregation.
- [x] Implement `rejectClaim(submissionId, reason, approverId)`: Update status to `REJECTED`.

---

## 🖥️ Phase 3: Frontend Refactoring (`GamificationView.tsx`)

### 3.1 Main Layout & Navigation
- [x] Refactor `GamificationView.tsx` into a multi-tab interface:
  - **My Profile**: Member's personal points.
  - **LO Star Rating**: Board dashboard for LO progress.
  - **Submit Evidence**: Quest board and submission portal.
  - **Program Config**: (Admin Only) Rule builder.
  - **Approvals**: (Admin/Approver Only) Queue.

### 3.2 View Components
- [x] **LO Star Dashboard**: Build visual elements representing the 5 JCI Stars, progress bars, and status indicators (Completed, Pending, Due Soon).
- [x] **Dynamic Submission Portal**: Replace old `handleLogActivity` modal with a multi-step wizard.
  - Dynamic fields based on the selected standard (e.g., required PDF upload vs URL).
  - Client-side deadline validation.
- [x] **Approval Workspace**: List view for pending tasks with quick-preview for evidence (images/PDFs) and Approve/Reject buttons.
- [x] **Rule Configurator**: UI for administrators to duplicate past years, add new standards, set points, caps, and deadlines without editing code.

---

## 🤖 Phase 4: Cloud Functions & Automation (Firebase)

### 4.1 Aggregation Engine
- [x] Create an `onSubmissionApproved` Firestore trigger: Automatically recalculate and update a given LO's `lo_star_progress` document when a new submission is approved.

### 4.2 Auto-Trigger Systems (Optional but recommended)
- [x] Implement trigger on `Events` (check-ins): Auto-generate an `APPROVED` `incentive_submission` for event attendance rules.
- [x] Implement trigger on `Dues` / `Transactions`: Auto-generate points for early dues payment.
- [x] Implement notification triggers: Send a system alert when an LO officially unlocked a new "Star".
