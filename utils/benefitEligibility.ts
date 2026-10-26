import type { AffiliationCategory } from '../types/member';

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

export type BenefitIneligibleReason = 'audience' | 'country';

export type BenefitEligibility =
  | { eligible: true }
  | { eligible: false; reason: BenefitIneligibleReason; label: string };

export const KL_COUNTRY = 'Malaysia';

const norm = (s: string | undefined | null) => (s ?? '').trim().toLowerCase().replace(/[\s_-]+/g, ' ');


/**
 * Decide whether `viewer` may redeem/claim `item`. Pure; no I/O.
 * - audiences: missing/empty = ['kl']; the viewer's audience is 'kl' or `category`.
 * - countries: when set, the viewer's country must be listed (case-insensitive).
 * - Existing `roles` / `tiers` data is intentionally NOT enforced here (audience + country only).
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

  return { eligible: true };
}

/**
 * Eligibility of a member's own special offer (members.business.specialOffers[] or a card's specialOffers[]):
 * the same rule as advertisements, reading the offer's own `audiences` / `countries`.
 */
export function getOfferEligibility(
  offer: { audiences?: BenefitAudience[]; countries?: string[] },
  viewer: BenefitViewer,
): BenefitEligibility {
  return getBenefitEligibility({ targetCriteria: { audiences: offer.audiences, countries: offer.countries } }, viewer);
}
