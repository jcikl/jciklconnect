// One normaliser for the member "ideal referral" fields, shared by the app (membersService, the
// directory, forms), the member card (utils/memberCard.mjs) and scripts/normalizeIdealReferrals.mjs.
//
// Canonical format (SCHEMA.md members):
//   business.idealReferrals   string[]  referral TYPES (IDEAL_REFERRAL_OPTIONS labels), one value per element
//   idealReferralIndustry     string    referral INDUSTRIES (INDUSTRY_OPTIONS), joined with '||'. It stays a
//                                       string because installed app versions call .split() on it; '||' never
//                                       appears in an option, while ',' does ("Architecture, Engineering & ...").
import { INDUSTRY_OPTIONS, IDEAL_REFERRAL_OPTIONS } from '../config/referralOptions.mjs';

/** Separator for the legacy string field idealReferralIndustry. */
export const IDEAL_REFERRAL_INDUSTRY_SEPARATOR = '||';

/** @param {string} s */
const key = s => s.replace(/\s+/g, ' ').trim().toLowerCase();

const INDUSTRY_KEYS = new Set(INDUSTRY_OPTIONS.map(key));
const TYPE_KEYS = new Set(IDEAL_REFERRAL_OPTIONS.map(o => key(o.label)));
/** lower-cased option -> its exact label */
const KNOWN = new Map([...INDUSTRY_OPTIONS, ...IDEAL_REFERRAL_OPTIONS.map(o => o.label)].map(o => [key(o), o]));
/** The most comma-separated pieces in any known option. */
const MAX_PIECES = Math.max(...[...KNOWN.values()].map(o => o.split(',').length));

/**
 * Greedy left-to-right: joins the longest run of consecutive items (", ") that is a known option.
 * @param {string[]} items
 * @returns {{ value: string, known: boolean }[]}
 */
function rejoin(items) {
  const out = [];
  for (let i = 0; i < items.length;) {
    let n = Math.min(MAX_PIECES, items.length - i);
    for (; n >= 1; n--) {
      const hit = KNOWN.get(key(items.slice(i, i + n).join(', ')));
      if (hit) { out.push({ value: hit, known: true }); break; }
    }
    if (n >= 1) { i += n; continue; }
    out.push({ value: items[i], known: false });
    i++;
  }
  return out;
}

/**
 * Turns any stored ideal-referral value into a clean list, one value per element:
 *  - array elements and strings are split on '||';
 *  - consecutive pieces that together form a known option are rejoined
 *    (["Architecture", "Engineering & Construction"] -> "Architecture, Engineering & Construction");
 *  - a piece is split on ',' only when every part (after rejoining) is a known option; otherwise it is
 *    kept whole as free text;
 *  - known options take their exact label; values are trimmed; duplicates (ignoring case) are dropped.
 * @param {unknown} value
 * @returns {string[]}
 */
export function normalizeIdealReferrals(value) {
  const raw = Array.isArray(value) ? value : typeof value === 'string' ? [value] : [];
  const parts = raw
    .filter(v => typeof v === 'string')
    .flatMap(v => v.split('||'))
    .map(v => v.trim())
    .filter(Boolean);
  const values = [];
  for (const { value: part, known } of rejoin(parts)) {
    if (known || !part.includes(',')) { values.push(part); continue; }
    const pieces = rejoin(part.split(',').map(v => v.trim()).filter(Boolean));
    if (pieces.every(p => p.known)) values.push(...pieces.map(p => p.value));
    else values.push(part);
  }
  const seen = new Set();
  return values.filter(v => !seen.has(key(v)) && seen.add(key(v)));
}

/**
 * Canonical stored value of idealReferralIndustry: the normalised list joined with '||'.
 * @param {unknown} value
 * @returns {string}
 */
export function joinIdealReferralIndustries(value) {
  return normalizeIdealReferrals(value).join(IDEAL_REFERRAL_INDUSTRY_SEPARATOR);
}

/** @param {string} v @returns {boolean} an INDUSTRY_OPTIONS value */
export function isIndustryOption(v) {
  return INDUSTRY_KEYS.has(key(v));
}

/** @param {string} v @returns {boolean} an IDEAL_REFERRAL_OPTIONS label */
export function isReferralTypeOption(v) {
  return TYPE_KEYS.has(key(v));
}
