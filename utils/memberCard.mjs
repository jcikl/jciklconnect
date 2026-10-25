// Pure helpers for the public member card (`memberCards/{memberId}`), Phase 0 WP2.
// Plain JS (JSDoc types) so scripts/backfillMemberCards.mjs can share it with the app.
// firestore.rules (memberCardKeys / validMemberCard) accepts EXACTLY the keys built here, so:
//  - never emit undefined / null / empty values for the optional keys;
//  - `loId` and `international` must equal the member doc's values after the write.

/** KL's own chapter id (same as DEFAULT_LO_ID in config/constants.ts). */
export const KL_LO_ID = 'jcikl';

const INTERNAL_CARD_ROLES = ['MEMBER', 'BOARD', 'ADMIN', 'SUPER_ADMIN'];
const EXTERNAL_ROLES = ['AFFILIATE', 'CHAPTER_ADMIN'];

/** @param {unknown} v @returns {string | undefined} trimmed non-empty string, else undefined */
function str(v) {
  return typeof v === 'string' && v.trim() !== '' ? v.trim() : undefined;
}

/**
 * Non-empty, trimmed, de-duplicated strings from an array or a ',' / '||' separated string.
 * @param {unknown} v
 * @returns {string[]}
 */
function strList(v) {
  const parts = Array.isArray(v) ? v : typeof v === 'string' ? v.split(/,|\|\|/) : [];
  return [...new Set(parts.filter(p => typeof p === 'string').map(p => p.trim()).filter(Boolean))];
}

/** @param {any} member @returns {boolean} */
export function isExternalMember(member) {
  return EXTERNAL_ROLES.includes(member?.role);
}

/**
 * Whether the member should have a card: role MEMBER and above (not GUEST / INACTIVE), or an
 * external member (AFFILIATE / CHAPTER_ADMIN) whose affiliation is active.
 * @param {any} member
 * @returns {boolean}
 */
export function shouldHaveCard(member) {
  if (!member) return false;
  if (INTERNAL_CARD_ROLES.includes(member.role)) return true;
  if (isExternalMember(member)) return member.affiliation?.status === 'active';
  return false;
}

/**
 * Builds the card document for a member (call only when shouldHaveCard). No undefined values.
 * @param {any} member
 * @param {string} [nowIso] injectable for tests
 * @returns {import('../types/member').MemberCard}
 */
export function buildMemberCard(member, nowIso = new Date().toISOString()) {
  const g = member?.general ?? {};
  const b = member?.business ?? {};
  const external = isExternalMember(member);
  const categories = Array.isArray(b.businessCategory)
    ? b.businessCategory.filter(c => typeof c === 'string' && c.trim() !== '')
    : [];
  const offer = b.specialOffer;
  // Ideal referral types: business.idealReferrals (array or string), else the legacy flat idealReferralIndustry.
  const ownReferrals = strList(b.idealReferrals);
  const idealReferrals = ownReferrals.length > 0 ? ownReferrals : strList(member?.idealReferralIndustry);
  const offerSummary = str(typeof offer === 'string' ? offer : offer?.description);

  /** @type {Record<string, unknown>} */
  const optional = {
    avatarUrl: str(g.avatarUrl) ?? str(g.avatar),
    // 'Malaysia' only for KL (loId jcikl / missing); other chapters get a country only from affiliation.country.
    country: str(member?.affiliation?.country) ?? (!external && (str(member?.loId) ?? KL_LO_ID) === KL_LO_ID ? 'Malaysia' : undefined),
    companyName: str(b.companyName) ?? str(member?.companyName),
    position: str(b.position),
    department: str(b.departmentAndPosition),
    industry: str(b.industry) ?? str(member?.industry),
    businessCategory: categories.length > 0 ? categories : undefined,
    companyDescription: str(b.companyDescription) ?? str(b.introduction),
    website: str(b.companyWebsite),
    acceptInternationalBusiness: str(b.acceptInternationalBusiness),
    specialOfferSummary: offerSummary,
    idealReferrals: idealReferrals.length > 0 ? idealReferrals : undefined,
  };
  /** @type {Record<string, unknown>} */
  const card = {
    displayName: str(g.name) ?? str(member?.name) ?? '',
    loId: str(member?.loId) ?? KL_LO_ID,
    international: member?.privacy?.shareCardInternationally === true,
    updatedAt: nowIso,
  };
  for (const [k, v] of Object.entries(optional)) if (v !== undefined) card[k] = v;
  return /** @type {any} */ (card);
}

/**
 * What to do with the card when a member changes from `before` to `after`.
 * 'upsert' = write the card, 'delete' = remove it, 'none' = leave it alone (nothing card-relevant changed).
 * @param {any} before member before the write (null when creating)
 * @param {any} after member after the write
 * @param {{ forceDelete?: boolean }} [opts] forceDelete: delete even if the member did not qualify before
 * @returns {'upsert' | 'delete' | 'none'}
 */
export function planCardSync(before, after, opts = {}) {
  if (!shouldHaveCard(after)) return shouldHaveCard(before) || opts.forceDelete ? 'delete' : 'none';
  if (!shouldHaveCard(before)) return 'upsert';
  const { updatedAt: _a, ...cardBefore } = buildMemberCard(before, '');
  const { updatedAt: _b, ...cardAfter } = buildMemberCard(after, '');
  return JSON.stringify(sortKeys(cardBefore)) === JSON.stringify(sortKeys(cardAfter)) ? 'none' : 'upsert';
}

/** @param {Record<string, any>} o */
function sortKeys(o) {
  return Object.fromEntries(Object.entries(o).sort(([a], [b]) => (a < b ? -1 : 1)));
}

/**
 * Applies a Firestore setDoc(..., { merge: true }) payload to a member snapshot: plain objects are merged
 * recursively, everything else (arrays, strings, null…) replaces the value. Used for the card sync after
 * useAuth().updateMemberProfile, which saves with merge.
 * @param {any} member
 * @param {Record<string, any>} updates
 * @returns {any}
 */
export function applyMergeUpdates(member, updates) {
  const isPlain = (v) => v !== null && typeof v === 'object' && !Array.isArray(v) && Object.getPrototypeOf(v) === Object.prototype;
  /** @param {any} base @param {any} patch */
  const merge = (base, patch) => {
    const out = isPlain(base) ? { ...base } : {};
    for (const [k, v] of Object.entries(patch ?? {})) {
      if (v === undefined) continue;
      out[k] = isPlain(v) ? merge(out[k], v) : v;
    }
    return out;
  };
  return merge(member ?? {}, updates);
}

/**
 * Applies a Firestore updateDoc-style payload to a member snapshot: top-level keys replace the whole
 * field, dot-path keys ('business.companyName') set a nested value, deleteField() removes it.
 * @param {any} member
 * @param {Record<string, any>} updates
 * @returns {any}
 */
export function applyMemberUpdates(member, updates) {
  const out = { ...(member ?? {}) };
  for (const [key, value] of Object.entries(updates ?? {})) {
    if (value === undefined) continue;
    const isDelete = value && typeof value === 'object' && value._methodName === 'deleteField';
    const path = key.split('.');
    let node = out;
    for (let i = 0; i < path.length - 1; i++) {
      const next = node[path[i]];
      node[path[i]] = next && typeof next === 'object' ? { ...next } : {};
      node = node[path[i]];
    }
    const last = path[path.length - 1];
    if (isDelete) delete node[last];
    else node[last] = value;
  }
  return out;
}
