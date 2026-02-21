# Join Us (Register Modal) Survey Modification Plan

This document outlines the step-by-step implementation plan to replace the current "Area of Interest" field in the Join Us (Register) modal with a professional 5-question Q&A system mapping to JCI pillars and activities.

## 1. Context & Analysis
### Current State
*   `RegisterModal.tsx` Step 3 captures `areaOfInterest` (single select) and `selectedHobbies`.
*   Data is saved to the membership profile via `signUp` hook.

### Objectives
*   Remove basic "Area of Interest" dropdown.
*   Implement 5 psychological mapping questions (Q1-Q5).
*   Diagnose the applicant's **Persona** (Learning, Practical, Backbone, Explorer).
*   Tag the member with Directional, Category, and Activity tags for future recommendations.

---

## 2. To-Dos & Implementation Steps

### Step 1: Update Data Structures (`types.ts`)
Add new fields to the `Member` interface to store the survey intelligence.

**Target File:** `c:\Users\User\Documents\Cursor projects\BMAD Project\JCI-LO-Management-App - Copy\types.ts`
*   Add `surveyAnswers: Record<string, string>` (stores Q1-Q5 choices).
*   Add `personaType: string` (e.g., "Learning-oriented").
*   Add `tendencyTags: string[]` (e.g., `["Ind", "S", "Effective Communications"]`).

### Step 2: Define Survey Mappings (`config/constants.ts`)
Create a comprehensive constant for the survey to keep the UI component clean.

**Target File:** `c:\Users\User\Documents\Cursor projects\BMAD Project\JCI-LO-Management-App - Copy\config\constants.ts`
*   Define `JOIN_US_SURVEY_QUESTIONS` array.
*   Each question entry should include:
    *   `id`: `Q1`...`Q5`
    *   `text`: The Chinese/English question text.
    *   `options`: Array of `{ label, value, mapping: { direction, category, items } }`.

### Step 3: UI Implementation (`components/auth/RegisterModal.tsx`)
Refactor Step 3 of the registration flow.

**Target File:** `c:\Users\User\Documents\Cursor projects\BMAD Project\JCI-LO-Management-App - Copy\components\auth\RegisterModal.tsx`
*   **State Update**: Add `surveyAnswers: Record<string, string>` to the `formData` initialization.
*   **Remove Code**: Delete the `areaOfInterest` `<Select>` component.
*   **New Component**: Create a sub-component or render function for the Survey.
    *   Use a "Question by Question" flow or a list layout.
    *   Use a polished card-based choice UI instead of simple radio buttons to make it feel premium.
*   **Validation**: Update `validateStep(3)` to ensure all 5 questions are answered.

### Step 4: Diagnosis & Tagging Logic
Implement the logic to "calculate" the persona before submission.

**Target File:** `c:\Users\User\Documents\Cursor projects\BMAD Project\JCI-LO-Management-App - Copy\components\auth\RegisterModal.tsx`
*   Create a helper function `diagnosePersona(answers)`:
    *   Count occurrences of directions (A: Individual, B: Business, etc.).
    *   Determine the dominant direction.
    *   Map to the Persona strings (e.g., "Learning-oriented" for A-dominance).
*   Aggregate the `tendencyTags` based on the mapping defined in `constants.ts`.

### Step 5: Submission Integration
Update the `handleSubmit` call.

**Target File:** `c:\Users\User\Documents\Cursor projects\BMAD Project\JCI-LO-Management-App - Copy\components\auth\RegisterModal.tsx`
*   Include `surveyAnswers`, `personaType`, and `tendencyTags` in the metadata passed to `signUp`.

---

## 3. Scenario & Logic Detail

### The Diagnosis Algorithm
| Dominant Choice | Persona (Diagnosis) | JCI Push Strategy | Preferred Activities |
| :--- | :--- | :--- | :--- |
| **A (Individual)** | **学习型 (Learning-oriented)** | Skill development, Confidence, Public Speaking | Local Academy, Inspire |
| **B (Business)** | **务实型 (Practical-oriented)** | Networking, Business Matching, B2B | JIB, BSP, CYEA |
| **C (Community)** | **骨干型 (Backbone-oriented)** | Project Management, Leadership Roles | Project Chairperson, SDA |
| **D (International)** | **探索型 (Explorer-oriented)** | World stage, Twin Chapters, ASPAC | Overseas Conferences, Twin Chapters |

### Tagging Example (Output Data)
If a user picks `A` for Q1:
*   **Survey Answer**: `Q1: "A"`
*   **Tags**: `["Ind", "S", "Effective Communications", "JCIM Inspire", "Public Speaking"]`

---

## 4. Technical Blind Spots & Solutions
*   **Tie-breaking**: If a user has equal counts for A and B, the system should prioritize based on a defined order (e.g., A > B > C > D) or list both. *Solution: Implement a priority-weighted sorting.*
*   **UI Layout**: 5 questions with 4 options each might make the modal too long. *Solution: Use a vertical scrollable area or mini-steps within Step 3 (Step 3.1, 3.2, etc.).*
*   **Future Filtering**: The `tendencyTags` should be indexed in Firestore (if using) or easily searchable to enable the "Follow-up Recommendation Logic".

---

## 5. Next Steps for Developer
1.  Read `config/constants.ts` to prepare the `JOIN_US_SURVEY_QUESTIONS` data.
2.  Review `RegisterModal.tsx` to identify the best insertion point for the survey UI.
3.  Implement the calculation utility.
4.  Verify data persistence in the database after a test registration.
