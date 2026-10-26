// Pure helpers for members' own special offers (members.business.specialOffers / legacy specialOffer).
// Plain JS (JSDoc types) so utils/memberCard.mjs and scripts/backfillMemberCards.mjs can share them.

/**
 * @typedef {{ description?: string, terms?: string, expiryDate?: string, logoUrl?: string, imageUrl?: string,
 *   status?: string, audiences?: string[], countries?: string[] }} OfferLike
 */

/**
 * Local calendar date as 'YYYY-MM-DD' (offer expiry dates come from a <input type="date">).
 * @param {Date} [date]
 * @returns {string}
 */
export function todayIso(date = new Date()) {
  const p = (/** @type {number} */ n) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${p(date.getMonth() + 1)}-${p(date.getDate())}`;
}

/**
 * True when the offer is active and not expired: non-empty description, status not 'Paused',
 * and expiryDate (if set) on or after `today` (the expiry day itself still counts).
 * A legacy string offer is live when non-empty.
 * @param {OfferLike | string | null | undefined} offer
 * @param {string} today 'YYYY-MM-DD'
 * @returns {boolean}
 */
export function isOfferLive(offer, today) {
  if (!offer) return false;
  if (typeof offer === 'string') return offer.trim() !== '';
  if (typeof offer.description !== 'string' || offer.description.trim() === '') return false;
  if (offer.status === 'Paused') return false;
  const expiry = typeof offer.expiryDate === 'string' ? offer.expiryDate.trim().slice(0, 10) : '';
  return expiry === '' || expiry >= today;
}

/**
 * A member's offers in one shape, across both storage formats: `business.specialOffers` when it is an
 * array (an empty array means "no offers"; the legacy field may be a stale mirror), else the legacy
 * `business.specialOffer` / top-level `specialOffer` (string → { description }). Blank offers are dropped.
 * @param {any} member
 * @returns {OfferLike[]}
 */
export function getMemberOffers(member) {
  const b = member?.business ?? {};
  const filled = (/** @type {any} */ o) => !!o && typeof o === 'object' && typeof o.description === 'string' && o.description.trim() !== '';
  if (Array.isArray(b.specialOffers)) return b.specialOffers.filter(filled);
  const legacy = b.specialOffer ?? member?.specialOffer;
  if (typeof legacy === 'string') return legacy.trim() ? [{ description: legacy }] : [];
  return filled(legacy) ? [legacy] : [];
}

/**
 * The member's live offers (both formats), in stored order.
 * @param {any} member
 * @param {string} today 'YYYY-MM-DD'
 * @returns {OfferLike[]}
 */
export function getLiveOffers(member, today) {
  return getMemberOffers(member).filter(o => isOfferLive(o, today));
}
