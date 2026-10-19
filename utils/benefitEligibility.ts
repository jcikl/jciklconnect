import type { AffiliationCategory } from '../types/member';
import { UserRole, MemberTier } from '../types/common';

/** Who a benefit is meant for. An item with no audiences is KL-only (owner decision 10). */
export type BenefitAudience = 'kl' | 'sister' | 'apicc' | 'global';

/** Subset of `Advertisement` that eligibility looks at. */
export interface BenefitTargetable {
  targetCriteria?: {
    tiers?: string[];
    roles?: string[];
    audiences?: BenefitAudience[];
    countries?: string[];
  } | null;
}

export interface BenefitViewer {
  /** true for JCI KL users (country 'Malaysia', audience 'kl'); false for externals. */
  isKl: boolean;
  role?: string;
  tier?: string;
  /** External viewers only: `affiliation.category`. */
  category?: AffiliationCategory;
  /** KL viewers: 'Malaysia'. External viewers: `affiliation.country`. */
  country?: string;
}

export type BenefitIneligibleReason = 'audience' | 'country' | 'role' | 'tier';

export type BenefitEligibility =
  | { eligible: true }
  | { eligible: false; reason: BenefitIneligibleReason; label: string };

export const KL_COUNTRY = 'Malaysia';

const norm = (s: string | undefined | null) => (s ?? '').trim().toLowerCase().replace(/[\s_-]+/g, ' ');

const ROLE_VALUES = new Set(Object.values(UserRole).map(norm));
const TIER_VALUES = new Set(Object.values(MemberTier).map(norm));
// ADMIN / SUPER_ADMIN always see everything KL-side.
const BYPASS_ROLES = new Set([norm(UserRole.ADMIN), norm(UserRole.SUPER_ADMIN)]);

/**
 * Decide whether `viewer` may redeem/claim `item`. Pure; no I/O.
 * - audiences: missing/empty = ['kl']; the viewer's audience is 'kl' or `category`.
 * - countries: when set, the viewer's country must be listed (case-insensitive).
 * - roles / tiers: only entries that are real UserRole / MemberTier values constrain
 *   (partnership-created ads carry legacy membership-type strings that must not grey out KL members).
 */
export function getBenefitEligibility(item: BenefitTargetable, viewer: BenefitViewer): BenefitEligibility {
  const tc = item.targetCriteria ?? {};
  const audiences: BenefitAudience[] = tc.audiences && tc.audiences.length > 0 ? tc.audiences : ['kl'];
  const viewerAudience: BenefitAudience | undefined = viewer.isKl ? 'kl' : viewer.category;

  if (!viewerAudience || !audiences.includes(viewerAudience)) {
    const klOnly = audiences.length === 1 && audiences[0] === 'kl';
    return {
      eligible: false,
      reason: 'audience',
      label: klOnly ? 'JCI KL members only' : viewer.isKl ? 'Not available to JCI KL members' : 'Not available to your chapter network',
    };
  }

  const countries = (tc.countries ?? []).map(norm).filter(Boolean);
  if (countries.length > 0) {
    const country = viewer.isKl ? KL_COUNTRY : viewer.country;
    if (!country || !countries.includes(norm(country))) {
      return { eligible: false, reason: 'country', label: `Not available in ${country || 'your country'}` };
    }
  }

  if (viewer.isKl && BYPASS_ROLES.has(norm(viewer.role))) return { eligible: true };

  const roles = (tc.roles ?? []).map(norm).filter(r => ROLE_VALUES.has(r));
  if (roles.length > 0 && !roles.includes(norm(viewer.role))) {
    return { eligible: false, reason: 'role', label: 'Not available for your role' };
  }

  const tiers = (tc.tiers ?? []).map(norm).filter(t => TIER_VALUES.has(t));
  if (tiers.length > 0 && !tiers.includes(norm(viewer.tier))) {
    return { eligible: false, reason: 'tier', label: 'Not available for your tier' };
  }

  return { eligible: true };
}
