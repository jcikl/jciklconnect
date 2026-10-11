# UI 组件与数据层协议（完整版）

> 从 CLAUDE.md 迁出（原第 186–245 行）。
> **变更：** 原「Iterative improvement rule（顺手改进规则）」已删除，因为它与 Karpathy「外科手术式修改」原则冲突（会产生与任务无关的 diff）。新规则：发现缺失的 loading / empty / error 状态时，**在交付说明中列出，不顺手修改**。

**Every development task — whether a new feature, a bug fix, or a refactor — must run this protocol automatically, without waiting for explicit instruction.**

### Before writing any UI code

1. **Read `components/ui/Common.tsx` and `components/ui/Form.tsx`** to inventory what primitives already exist.
   - Available UI primitives: `Button`, `Card`, `Modal`, `Badge`, `Drawer`, `Toast`, `ProgressBar`, `Table`, `Spinner`, `EmptyState`, `ConfirmDialog`
   - Available form primitives: `Input`, `Select`, `Checkbox`, `FormField`, `Textarea`
   - Available search: `components/ui/Combobox.tsx`
   - Scan `components/ui/` for any additional primitives added since this doc was written.

2. **Decision rule — reuse vs. extend vs. create:**
   - If an existing primitive covers the need → use it directly, no changes.
   - If an existing primitive is 80%+ there but missing one prop or variant → **extend it in place** (add the prop, keep backward compat, update the type).
   - If the need is genuinely new and will recur in ≥2 places → **create a new primitive in `components/ui/`** with full prop types and both light/dark theme support.
   - If the need is one-off and local → implement inline in the feature component, do not extract.

3. **Never create a feature-local copy of an existing primitive.** If `Button` doesn't support a needed variant, add the variant to `Button`, not a `MySpecialButton` in the feature folder.

### Before writing any data/hook code

1. **Scan `hooks/` for existing hooks** that already manage the relevant data. Check if the hook already exposes the mutation or query you need.
   - If yes → call the existing hook, do not duplicate the Firestore query.
   - If the hook is missing one method → **add the method to the existing hook**, return it alongside existing methods.
   - If the concern is genuinely separate (different Firestore collection, different lifecycle) → create a new `hooks/useXxx.ts`.

2. **Scan `services/` for existing service methods** before writing new ones.
   - If a service method already does what you need → call it.
   - If it's close but missing a parameter or variant → extend it (add optional param, keep existing callers unbroken).
   - New service methods must follow the mandatory pattern:
     - `static async` method on the service class
     - `isDevMode()` check at the top, returning mock data in dev
     - Cache read before Firestore query (TTL 3–5 min via `cacheService`)
     - `writeBatch` for any multi-document write
     - `invalidateXxxCache()` after every write
     - Errors propagated (never swallowed), logged via `errorLoggingService`


### Mandatory checks before any PR / commit

- [ ] No new component duplicates an existing `components/ui/` primitive
- [ ] No new hook duplicates an existing hook's Firestore query
- [ ] Every new service method has a `devMode` path
- [ ] Every write path uses `writeBatch` (if touching >1 document)
- [ ] Every write path calls `invalidateXxxCache()` after commit
- [ ] New UI primitives support both light and dark theme via CSS variables

---
