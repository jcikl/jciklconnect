# 决策协议：Skill/工具发现 & 第三方库 vs 自建

> 从 CLAUDE.md 迁出（原第 102–184 行），内容未改动。引入新库或新 skill 前读取。

## Skill & Tool Discovery Protocol (Auto-enforced)

**When a recurring development pain point is identified — whether in analysis, code quality, workflow, or delivery — always check if the market has a mature skill, tool, or methodology that addresses it before improvising a solution from scratch.**

### When to trigger this protocol

Trigger automatically when any of these situations arise:

| Situation | Example |
|---|---|
| A type of analysis needs to be repeated across many files or collections | "I need to check all 10 collections for the same class of bug" |
| A development workflow step keeps being described from scratch each time | "Before writing UI, scan existing components, then..." |
| A class of error keeps appearing across different features | "Cache not invalidated after write" appearing in 5 different services |
| A delivery or quality concern has no systematic answer yet | "How do we ensure Firestore rules match service-layer permissions?" |
| A task is complex enough that an ad-hoc approach produces inconsistent results | Multi-collection dependency analysis |

### Step 1 — Search for existing solutions

Look across three sources in order:

1. **Existing project skills** — check `.claude/commands/` first; the problem may already be solved
2. **Claude / AI workflow patterns** — is there a known prompting pattern, agent workflow, or skill structure that addresses this? (e.g., multi-agent parallel analysis, structured output schemas, loop-until-dry patterns)
3. **Industry methodology** — is there a named practice that fits? (e.g., ADR for architecture decisions, contract testing for API boundaries, feature flags for gradual rollout, schema migration protocols)

### Step 2 — Evaluate fit

| Criterion | Question |
|---|---|
| Coverage | Does it address at least 70% of the pain point as-is? |
| Adaptability | Can the remaining 30% be customised without breaking the core approach? |
| Complexity | Is the overhead of adopting it lower than the cost of the recurring pain? |
| Project fit | Does it work within the existing Firebase + React + hook/service architecture? |

### Step 3 — Decision output

- **Adopt and customise** → implement it, strip parts that don't apply, add project-specific steps, save as a new skill in `.claude/commands/` or as a section in `CLAUDE.md`
- **Partial adoption** → take only the relevant parts, document what was kept and why
- **Build from scratch** → only if no existing solution fits; design it to be reusable from the start, not one-off

### What gets saved after adoption

Every adopted skill or methodology must be persisted in one of two places:

- **`.claude/commands/`** — if it's a repeatable task triggered by a slash command (e.g., `/analyze-collection`, `/develop-feature`)
- **`CLAUDE.md`** — if it's a standing protocol that applies automatically to all development (e.g., the cache invalidation rule, the writeBatch rule)

Never leave an adopted practice living only in conversation context — it will be lost when the session ends.

---

## Library vs Self-Build Decision Protocol (Auto-enforced)

**Before implementing any non-trivial feature, evaluate whether a mature library already solves the problem. This is mandatory — do not skip straight to writing code.**

### Step 1 — Identify the nature of the problem

| Problem type | Default decision |
|---|---|
| Complex interaction logic (date picker, drag-and-drop, rich text, virtual scroll) | Evaluate existing libraries first |
| Simple UI components (buttons, cards, forms, badges) | Extend `components/ui/` — do not bring in a library |
| Data processing (charts, Excel export, PDF generation, CSV parsing) | Evaluate bundle size impact before deciding |
| Business logic (membership rules, finance reconciliation, points calculation) | Always self-build — no external library understands the business rules |
| Firebase / auth / routing | Already solved by existing stack — do not replace |

### Step 2 — If a library is a candidate, evaluate on four criteria

1. **Bundle size** — would adding this library keep data load under 2 seconds? Check the minified + gzipped size (via bundlephobia.com mental check). If the library is large but only a small part is needed, look for a lighter alternative or self-build that part only.
2. **Maintenance health** — is it actively maintained? (recent commits, open issues being addressed, compatible with React 19)
3. **Architecture fit** — does it work alongside Tailwind CSS, Firebase, and the existing hook/service layer without conflict?
4. **Usage ratio** — will at least 30% of the library's features be used? If using less, self-build the specific part needed.

### Step 3 — Decision output

- **Use the library** → install it, document why it was chosen in a brief code comment, lazy-load it if it's heavy (`React.lazy` or dynamic `import()`)
- **Self-build** → implement in `components/ui/` (UI) or `services/` (data logic), following the existing layer protocol
- **Uncertain** → default to self-build for now, leave a `// TODO: evaluate [library name] if this grows more complex` comment

### What this protocol is NOT

- It does not apply to libraries already in the stack (React, Firebase, Tailwind, Vite, React Router, etc.)
- It does not require asking the user for approval on every library decision — make the call, state the reasoning in the commit message

---
