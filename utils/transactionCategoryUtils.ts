/**
 * Shared category-field derivation and cleanup logic for bank transactions and splits.
 *
 * WHY this file exists: the same "if Membership → auto-set projectId/purpose; if Administrative →
 * clear memberId; if P&A → clear memberId" pattern was duplicated across handleAddTransaction,
 * handleUpdateTransaction, batchUpdateTransactionCategory, batchUpdateSplitCategory, and
 * TransactionSplitModal. Centralising here lets all call sites stay in sync.
 */

import type { Transaction, TransactionSplit } from '../types';
import type { MembershipType, MembershipRuleConfig } from '../types';
import { resolveMembershipPurpose } from '../services/membershipConfigService';

export type TransactionCategory = 'Projects & Activities' | 'Membership' | 'Administrative';

// ── Membership project-ID convention ─────────────────────────────────────────

/** Returns the canonical projectId for a membership year, e.g. "2026 membership". */
export function buildMembershipProjectId(year: number): string {
  return `${year} membership`;
}

/**
 * Extracts the membership year from a projectId like "2026 membership".
 * Returns `null` if the string doesn't match the convention.
 */
export function parseMembershipProjectId(projectId: string | undefined | null): number | null {
  const match = projectId?.match(/^(\d+)\s+membership$/i);
  return match ? parseInt(match[1], 10) : null;
}

// ── Administrative purpose convention ────────────────────────────────────────

/**
 * Splits an Administrative purpose string like "2024 Secretarial" into its
 * year and base components. Returns `null` if the string doesn't match.
 */
export function parseAdministrativePurpose(
  purpose: string | undefined | null
): { year: number; base: string } | null {
  const match = purpose?.match(/^(\d{4})\s+(.+)$/);
  if (!match) return null;
  return { year: parseInt(match[1], 10), base: match[2] };
}

/** Builds an Administrative purpose string from year + base, e.g. "2024 Secretarial". */
export function buildAdministrativePurpose(year: number, base: string): string {
  return `${year} ${base}`;
}

// ── Core: derive category-specific fields ────────────────────────────────────

export interface CategoryFieldInputs {
  category: TransactionCategory;
  /** Monetary amount — used only for Membership purpose auto-resolution. */
  amount?: number;
  /** Explicit year (Membership or Administrative). Falls back to date year when absent. */
  year?: number;
  /** Fallback date for year extraction when `year` is absent. */
  date?: string;
  /** For Membership: the member ID. */
  memberId?: string;
  /** For P&A or Administrative: caller-supplied projectId. */
  projectId?: string;
  /** For Administrative: the non-year part of the purpose string, e.g. "Secretarial". */
  purposeBase?: string;
  /** For P&A: the full purpose string supplied by the user. */
  purpose?: string;
  /**
   * Pre-loaded membership rules for purpose resolution.
   * When absent, `resolveMembershipPurpose` uses its built-in defaults.
   */
  rules?: Record<MembershipType, MembershipRuleConfig>;
}

export interface CategoryFieldOutputs {
  projectId?: string;
  purpose?: string;
  /** `null` means the field should be explicitly cleared in Firestore. */
  memberId?: string | null;
}

/**
 * Derives the canonical `{ projectId, purpose, memberId }` triplet for the
 * given category + inputs.  All logic is synchronous — load `rules` before
 * calling if Membership purpose auto-resolution is required.
 */
export function buildCategoryFields(inputs: CategoryFieldInputs): CategoryFieldOutputs {
  const {
    category,
    amount = 0,
    year,
    date,
    memberId,
    projectId,
    purposeBase,
    purpose,
    rules,
  } = inputs;

  const resolvedYear =
    year ?? (date ? new Date(date).getFullYear() : new Date().getFullYear());

  if (category === 'Membership') {
    const derivedProjectId = buildMembershipProjectId(resolvedYear);
    const derivedPurpose = resolveMembershipPurpose(
      amount,
      resolvedYear,
      rules ?? ({} as Record<MembershipType, MembershipRuleConfig>)
    );
    return {
      projectId: derivedProjectId,
      purpose: derivedPurpose,
      memberId: memberId ?? undefined,
    };
  }

  if (category === 'Administrative') {
    const derivedPurpose =
      purposeBase != null
        ? buildAdministrativePurpose(resolvedYear, purposeBase)
        : purpose ?? undefined;
    return {
      projectId: projectId ?? undefined,
      purpose: derivedPurpose,
      memberId: null, // Administrative never carries a memberId
    };
  }

  // 'Projects & Activities'
  return {
    projectId: projectId ?? undefined,
    purpose: purpose ?? undefined,
    memberId: null, // P&A never carries a memberId
  };
}

// ── Cleanup: null out stale fields when category changes ─────────────────────

export interface CategoryCleanupOptions {
  finalCategory: TransactionCategory | undefined;
  /**
   * The category on the record BEFORE this update.
   * When absent (new record), no cleanup is applied.
   */
  previousCategory?: TransactionCategory;
  /**
   * Keys that the caller has explicitly supplied — these are never nulled out
   * even if cleanup rules would otherwise clear them.
   */
  explicitKeys?: Set<string>;
}

/**
 * Returns the fields that must be set to `null` in Firestore because the
 * category changed and the old values no longer apply.
 *
 * Rules:
 * - → Membership : memberId kept, projectId auto-set (not nulled here),
 *                  purpose auto-set (not nulled here).
 * - → Administrative or P&A : memberId nulled unless explicitly provided;
 *                              projectId and purpose nulled only when the
 *                              previous category was different (to avoid
 *                              wiping values the user just set).
 *
 * Call `buildCategoryFields` first to get the positive values; merge this
 * cleanup object over the top so explicit user values are never lost.
 */
export function buildCategoryCleanupUpdates(
  opts: CategoryCleanupOptions
): Partial<Record<'projectId' | 'purpose' | 'memberId', null>> {
  const { finalCategory, previousCategory, explicitKeys = new Set() } = opts;
  const cleanup: Partial<Record<'projectId' | 'purpose' | 'memberId', null>> = {};

  if (!finalCategory) return cleanup;

  const categoryChanged = previousCategory !== undefined && previousCategory !== finalCategory;

  if (finalCategory === 'Administrative' || finalCategory === 'Projects & Activities') {
    if (!explicitKeys.has('memberId')) {
      cleanup.memberId = null;
    }
    if (categoryChanged) {
      if (!explicitKeys.has('projectId')) cleanup.projectId = null;
      if (!explicitKeys.has('purpose')) cleanup.purpose = null;
    }
  }

  // Membership: no nulling — projectId and purpose are auto-derived positively.

  return cleanup;
}

// ── Convenience: build a full update payload for a category change ────────────

export interface BuildCategoryUpdatePayloadParams {
  finalCategory: TransactionCategory;
  previousCategory?: TransactionCategory;
  /** Fields the user explicitly provided in this update. */
  explicitUpdates: Partial<{
    memberId: string;
    projectId: string;
    purpose: string;
    purposeBase: string;
  }>;
  /** Current record values (before this update). */
  current?: Partial<Transaction | TransactionSplit>;
  /** For amount-based purpose resolution (Membership). */
  amount?: number;
  year?: number;
  date?: string;
  rules?: Record<MembershipType, MembershipRuleConfig>;
}

/**
 * One-stop helper used by batch update paths and form submit handlers.
 *
 * Returns a partial update object containing the derived/cleaned fields that
 * should be merged into the Firestore update payload.  Caller is responsible
 * for adding their own fields (date, description, type, etc.).
 */
export function buildCategoryUpdatePayload(
  params: BuildCategoryUpdatePayloadParams
): Partial<Transaction & TransactionSplit> {
  const {
    finalCategory,
    previousCategory,
    explicitUpdates,
    current,
    amount,
    year,
    date,
    rules,
  } = params;

  const explicitKeys = new Set(Object.keys(explicitUpdates).filter(
    k => explicitUpdates[k as keyof typeof explicitUpdates] !== undefined
  ));

  // Positive derived fields
  const derived = buildCategoryFields({
    category: finalCategory,
    amount: amount ?? (current as Transaction | undefined)?.amount,
    year,
    date: date ?? (current as Transaction | undefined)?.date,
    memberId: explicitUpdates.memberId ?? (current as Transaction | undefined)?.memberId,
    projectId: explicitUpdates.projectId ?? current?.projectId,
    purposeBase: explicitUpdates.purposeBase,
    purpose: explicitUpdates.purpose ?? current?.purpose,
    rules,
  });

  // Null-out fields no longer relevant
  const cleanup = buildCategoryCleanupUpdates({
    finalCategory,
    previousCategory,
    explicitKeys,
  });

  // Merge: cleanup first, derived values on top (derived wins over null)
  const payload: Partial<Transaction & TransactionSplit> = {
    ...cleanup,
    category: finalCategory,
  };

  if (derived.projectId !== undefined) payload.projectId = derived.projectId;
  else if (cleanup.projectId === null) payload.projectId = null as unknown as string;

  if (derived.purpose !== undefined) payload.purpose = derived.purpose;
  else if (cleanup.purpose === null) payload.purpose = null as unknown as string;

  if (derived.memberId !== undefined) payload.memberId = derived.memberId as string;
  else if (cleanup.memberId === null) payload.memberId = null as unknown as string;

  return payload;
}
