// Pure helpers for the unified business directory: one item shape for local (KL) businesses and
// sister-chapter member cards, one filter model, and faceted counts. No React, no Firestore.
import type { BusinessProfile } from '../../../types';
import type { SisterChapterCard } from '../../../utils/internationalCards';
import { KL_CHAPTER } from '../../../utils/internationalCards';

export type DirectorySource = 'local' | 'sister';

/** One directory entry, whatever its source. `key` is unique across sources. */
export interface DirectoryItem {
  key: string;
  /** BusinessProfile id (local) or member card id (sister). */
  id: string;
  source: DirectorySource;
  name: string;
  chineseName?: string;
  avatarUrl: string;
  company: string;
  position: string;
  chapter: string;
  country: string;
  industry: string;
  categories: string[];
  idealReferrals: string[];
  hasDeal: boolean;
  dealSummary: string;
  acceptsInternationalBusiness: boolean;
  description: string;
  website: string;
  /** Sister-chapter cards only, present when the member shares their card. */
  phone?: string;
  socials?: Record<string, string>;
}

/** Multi-value sections: OR inside a section, AND across sections. */
export type FacetSection = 'countries' | 'chapters' | 'industries' | 'categories' | 'idealReferrals';
export type FacetFlag = 'hasDeal' | 'acceptsIntl';

export interface DirectoryFilters {
  hasDeal: boolean;
  acceptsIntl: boolean;
  countries: string[];
  chapters: string[];
  industries: string[];
  categories: string[];
  idealReferrals: string[];
}

export const EMPTY_DIRECTORY_FILTERS: DirectoryFilters = {
  hasDeal: false, acceptsIntl: false, countries: [], chapters: [], industries: [], categories: [], idealReferrals: [],
};

/** Display order of the multi-value sections (after Quick Filters). */
export const FACET_SECTIONS: FacetSection[] = ['countries', 'chapters', 'industries', 'categories', 'idealReferrals'];

export interface FacetOption { value: string; count: number }

export interface DirectoryFacets {
  hasDeal: number;
  acceptsIntl: number;
  countries: FacetOption[];
  chapters: FacetOption[];
  industries: FacetOption[];
  categories: FacetOption[];
  idealReferrals: FacetOption[];
}

const splitList = (v: string | undefined): string[] =>
  (v ?? '').split(',').map(s => s.trim()).filter(Boolean);

/** Local business -> item. `owner` carries avatar / Chinese name / position from the member list. */
export function businessToDirectoryItem(
  biz: BusinessProfile,
  owner: { avatarUrl: string; chineseName?: string; position: string },
): DirectoryItem {
  const intl = biz.acceptsInternationalBusiness;
  return {
    key: `local:${biz.id}`,
    id: biz.id,
    source: 'local',
    name: biz.ownerName ?? '',
    chineseName: owner.chineseName,
    avatarUrl: owner.avatarUrl,
    company: biz.companyName ?? '',
    position: owner.position,
    chapter: KL_CHAPTER.name,
    country: KL_CHAPTER.country ?? 'Malaysia',
    industry: biz.industry ?? '',
    categories: splitList(biz.businessCategory),
    idealReferrals: biz.idealReferralTypes ?? [],
    hasDeal: !!biz.offer,
    dealSummary: biz.offer ?? '',
    acceptsInternationalBusiness: intl === 'Yes' || intl === true,
    description: biz.description ?? '',
    website: biz.website ?? '',
  };
}

/** Sister-chapter (or, for externals, any chapter's) member card -> item. */
export function cardToDirectoryItem(card: SisterChapterCard, fallbackAvatar: (name: string) => string): DirectoryItem {
  const name = card.displayName ?? '';
  return {
    key: `sister:${card.id}`,
    id: card.id,
    source: 'sister',
    name,
    avatarUrl: card.avatarUrl || fallbackAvatar(name),
    company: card.companyName ?? '',
    position: card.position ?? '',
    chapter: card.sisterChapter?.name ?? '',
    country: card.sisterChapter?.country || card.country || '',
    industry: card.industry ?? '',
    categories: card.businessCategory ?? [],
    idealReferrals: card.idealReferrals ?? [],
    hasDeal: !!card.specialOfferSummary,
    dealSummary: card.specialOfferSummary ?? '',
    acceptsInternationalBusiness: card.acceptInternationalBusiness === 'Yes',
    description: card.companyDescription ?? '',
    website: card.website ?? '',
    ...(card.phone ? { phone: card.phone } : {}),
    ...(card.socials && Object.keys(card.socials).length > 0 ? { socials: card.socials } : {}),
  };
}

/** The values an item has for a section (empty = the item has no value there). */
function valuesOf(item: DirectoryItem, section: FacetSection): string[] {
  switch (section) {
    case 'countries': return item.country ? [item.country] : [];
    case 'chapters': return item.chapter ? [item.chapter] : [];
    case 'industries': return item.industry ? [item.industry] : [];
    case 'categories': return item.categories;
    case 'idealReferrals': return item.idealReferrals;
  }
}

/** Free-text match over name, Chinese name, company, chapter, industry and categories (case-insensitive). */
export function matchesDirectorySearch(item: DirectoryItem, term: string): boolean {
  const q = term.trim().toLowerCase();
  if (!q) return true;
  return [item.name, item.chineseName, item.company, item.chapter, item.industry, ...item.categories]
    .some(v => !!v && v.toLowerCase().includes(q));
}

type Skip = FacetSection | FacetFlag | null;

function matchesFilters(item: DirectoryItem, f: DirectoryFilters, skip: Skip): boolean {
  if (skip !== 'hasDeal' && f.hasDeal && !item.hasDeal) return false;
  if (skip !== 'acceptsIntl' && f.acceptsIntl && !item.acceptsInternationalBusiness) return false;
  for (const section of FACET_SECTIONS) {
    if (section === skip || f[section].length === 0) continue;
    const values = valuesOf(item, section);
    if (!f[section].some(v => values.includes(v))) return false;
  }
  return true;
}

/** Items matching the search and every selected filter. Order is preserved. */
export function filterDirectoryItems(items: DirectoryItem[], filters: DirectoryFilters, search: string): DirectoryItem[] {
  return items.filter(item => matchesDirectorySearch(item, search) && matchesFilters(item, filters, null));
}

/**
 * Faceted counts. Each option's count = items matching the search and all OTHER sections' filters that
 * have that option (standard facet behaviour). Options come from all items (so an option filtered down
 * to 0 still shows, disabled), plus any selected value no item has any more; sorted by name.
 */
export function computeDirectoryFacets(items: DirectoryItem[], filters: DirectoryFilters, search: string): DirectoryFacets {
  const searched = items.filter(item => matchesDirectorySearch(item, search));
  const countFlag = (flag: FacetFlag, has: (i: DirectoryItem) => boolean) =>
    searched.filter(i => has(i) && matchesFilters(i, filters, flag)).length;

  const section = (s: FacetSection): FacetOption[] => {
    const counts = new Map<string, number>();
    for (const item of items) for (const v of valuesOf(item, s)) counts.set(v, 0);
    for (const v of filters[s]) counts.set(v, 0);
    for (const item of searched) {
      if (!matchesFilters(item, filters, s)) continue;
      for (const v of new Set(valuesOf(item, s))) counts.set(v, (counts.get(v) ?? 0) + 1);
    }
    return [...counts.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([value, count]) => ({ value, count }));
  };

  return {
    hasDeal: countFlag('hasDeal', i => i.hasDeal),
    acceptsIntl: countFlag('acceptsIntl', i => i.acceptsInternationalBusiness),
    countries: section('countries'),
    chapters: section('chapters'),
    industries: section('industries'),
    categories: section('categories'),
    idealReferrals: section('idealReferrals'),
  };
}

export function countActiveDirectoryFilters(f: DirectoryFilters): number {
  return (f.hasDeal ? 1 : 0) + (f.acceptsIntl ? 1 : 0) + FACET_SECTIONS.reduce((n, s) => n + f[s].length, 0);
}

/** Toggle one value of a multi-value section (pure). */
export function toggleFacetValue(f: DirectoryFilters, s: FacetSection, value: string): DirectoryFilters {
  const has = f[s].includes(value);
  return { ...f, [s]: has ? f[s].filter(v => v !== value) : [...f[s], value] };
}
