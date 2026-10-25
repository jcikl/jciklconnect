import { describe, it, expect } from 'vitest';
import {
  EMPTY_DIRECTORY_FILTERS, businessToDirectoryItem, cardToDirectoryItem, computeDirectoryFacets,
  countActiveDirectoryFilters, filterDirectoryItems, matchesDirectorySearch, toggleFacetValue,
  type DirectoryFilters, type DirectoryItem,
} from '../../components/modules/BusinessDirectory/directoryFacets';
import type { BusinessProfile } from '../../types';
import type { SisterChapterCard } from '../../utils/internationalCards';

const item = (o: Partial<DirectoryItem> & { id: string }): DirectoryItem => ({
  key: `local:${o.id}`, source: 'local', name: o.id, avatarUrl: '', company: '', position: '',
  chapter: 'JCI Kuala Lumpur', country: 'Malaysia', industry: '', categories: [], idealReferrals: [],
  hasDeal: false, dealSummary: '', acceptsInternationalBusiness: false, description: '', website: '', ...o,
});

const items: DirectoryItem[] = [
  item({ id: 'a', industry: 'IT', categories: ['Service Provider'], idealReferrals: ['Banks'], hasDeal: true, acceptsInternationalBusiness: true }),
  item({ id: 'b', industry: 'Finance', categories: ['Service Provider', 'Retailer'], idealReferrals: ['Lawyers'] }),
  item({ id: 'c', source: 'sister', key: 'sister:c', chapter: 'JCI Singapore', country: 'Singapore', industry: 'IT', categories: ['Retailer'], hasDeal: true }),
  item({ id: 'd', source: 'sister', key: 'sister:d', chapter: 'JCI Penang', country: 'Malaysia', industry: 'Food', idealReferrals: ['Banks'], acceptsInternationalBusiness: true }),
];

const f = (o: Partial<DirectoryFilters>): DirectoryFilters => ({ ...EMPTY_DIRECTORY_FILTERS, ...o });
const counts = (opts: { value: string; count: number }[]) => Object.fromEntries(opts.map(o => [o.value, o.count]));
const ids = (list: DirectoryItem[]) => list.map(i => i.id);

describe('filterDirectoryItems', () => {
  it('returns everything with no filters and no search', () => {
    expect(ids(filterDirectoryItems(items, EMPTY_DIRECTORY_FILTERS, ''))).toEqual(['a', 'b', 'c', 'd']);
  });
  it('ORs values inside a section and ANDs across sections', () => {
    expect(ids(filterDirectoryItems(items, f({ industries: ['IT', 'Food'] }), ''))).toEqual(['a', 'c', 'd']);
    expect(ids(filterDirectoryItems(items, f({ industries: ['IT', 'Food'], countries: ['Malaysia'] }), ''))).toEqual(['a', 'd']);
  });
  it('quick filters: Has Deal and Accepts International Business', () => {
    expect(ids(filterDirectoryItems(items, f({ hasDeal: true }), ''))).toEqual(['a', 'c']);
    expect(ids(filterDirectoryItems(items, f({ acceptsIntl: true }), ''))).toEqual(['a', 'd']);
    expect(ids(filterDirectoryItems(items, f({ hasDeal: true, acceptsIntl: true }), ''))).toEqual(['a']);
  });
  it('matches multi-value sections (categories, ideal referrals) on any value', () => {
    expect(ids(filterDirectoryItems(items, f({ categories: ['Retailer'] }), ''))).toEqual(['b', 'c']);
    expect(ids(filterDirectoryItems(items, f({ idealReferrals: ['Banks'] }), ''))).toEqual(['a', 'd']);
  });
  it('applies the search together with the filters', () => {
    expect(ids(filterDirectoryItems(items, f({ industries: ['IT'] }), 'singapore'))).toEqual(['c']);
  });
});

describe('matchesDirectorySearch', () => {
  const x = item({ id: 'x', name: 'Alice Tan', chineseName: '陈', company: 'Acme', chapter: 'JCI Penang', industry: 'Finance', categories: ['Retailer'], description: 'secret' });
  it('matches name, Chinese name, company, chapter, industry and categories, case-insensitively', () => {
    for (const q of ['alice', '陈', 'ACME', 'penang', 'finance', 'retail']) expect(matchesDirectorySearch(x, q)).toBe(true);
  });
  it('does not match other fields; blank term matches all', () => {
    expect(matchesDirectorySearch(x, 'secret')).toBe(false);
    expect(matchesDirectorySearch(x, '  ')).toBe(true);
  });
});

describe('computeDirectoryFacets', () => {
  it('counts every option over all items when nothing is selected', () => {
    const facets = computeDirectoryFacets(items, EMPTY_DIRECTORY_FILTERS, '');
    expect(facets.hasDeal).toBe(2);
    expect(facets.acceptsIntl).toBe(2);
    expect(counts(facets.countries)).toEqual({ Malaysia: 3, Singapore: 1 });
    expect(counts(facets.chapters)).toEqual({ 'JCI Kuala Lumpur': 2, 'JCI Penang': 1, 'JCI Singapore': 1 });
    expect(counts(facets.industries)).toEqual({ Finance: 1, Food: 1, IT: 2 });
    expect(counts(facets.categories)).toEqual({ Retailer: 2, 'Service Provider': 2 });
    expect(counts(facets.idealReferrals)).toEqual({ Banks: 2, Lawyers: 1 });
  });

  it('a section ignores its own selection but applies the others (facet behaviour)', () => {
    const facets = computeDirectoryFacets(items, f({ countries: ['Singapore'] }), '');
    // Country counts ignore the Country selection, so the other countries stay clickable.
    expect(counts(facets.countries)).toEqual({ Malaysia: 3, Singapore: 1 });
    // Other sections are narrowed to Singapore; options outside it drop to 0 (shown disabled).
    expect(counts(facets.industries)).toEqual({ Finance: 0, Food: 0, IT: 1 });
    expect(counts(facets.chapters)).toEqual({ 'JCI Kuala Lumpur': 0, 'JCI Penang': 0, 'JCI Singapore': 1 });
    expect(facets.hasDeal).toBe(1);
    expect(facets.acceptsIntl).toBe(0);
  });

  it('the count of an unselected single-value option equals what clicking it adds', () => {
    const filters = f({ industries: ['IT'], countries: ['Malaysia'] });
    const before = filterDirectoryItems(items, filters, '').length;
    const food = computeDirectoryFacets(items, filters, '').industries.find(o => o.value === 'Food')!.count;
    const after = filterDirectoryItems(items, toggleFacetValue(filters, 'industries', 'Food'), '').length;
    expect(after - before).toBe(food);
  });

  it('the count of a quick filter equals the result size when it is turned on', () => {
    const filters = f({ countries: ['Malaysia'] });
    const facets = computeDirectoryFacets(items, filters, '');
    expect(filterDirectoryItems(items, { ...filters, hasDeal: true }, '').length).toBe(facets.hasDeal);
    expect(filterDirectoryItems(items, { ...filters, acceptsIntl: true }, '').length).toBe(facets.acceptsIntl);
  });

  it('respects the search box', () => {
    const facets = computeDirectoryFacets(items, EMPTY_DIRECTORY_FILTERS, 'penang');
    expect(counts(facets.chapters)).toEqual({ 'JCI Kuala Lumpur': 0, 'JCI Penang': 1, 'JCI Singapore': 0 });
  });

  it('keeps a selected value that no item has any more (so it can be cleared), with count 0', () => {
    const facets = computeDirectoryFacets(items, f({ countries: ['Thailand'] }), '');
    expect(counts(facets.countries)).toMatchObject({ Thailand: 0 });
  });

  it('counts an item once per option even if a value repeats', () => {
    const dup = [item({ id: 'z', categories: ['Retailer', 'Retailer'] })];
    expect(counts(computeDirectoryFacets(dup, EMPTY_DIRECTORY_FILTERS, '').categories)).toEqual({ Retailer: 1 });
  });
});

describe('countActiveDirectoryFilters / toggleFacetValue', () => {
  it('counts flags and selected values', () => {
    expect(countActiveDirectoryFilters(EMPTY_DIRECTORY_FILTERS)).toBe(0);
    expect(countActiveDirectoryFilters(f({ hasDeal: true, countries: ['A', 'B'], idealReferrals: ['X'] }))).toBe(4);
  });
  it('adds and removes a value without mutating the input', () => {
    const on = toggleFacetValue(EMPTY_DIRECTORY_FILTERS, 'chapters', 'JCI Penang');
    expect(on.chapters).toEqual(['JCI Penang']);
    expect(toggleFacetValue(on, 'chapters', 'JCI Penang').chapters).toEqual([]);
    expect(EMPTY_DIRECTORY_FILTERS.chapters).toEqual([]);
  });
});

describe('normalisers', () => {
  it('local business: KL chapter and country, split categories, deal and international flags', () => {
    const biz = {
      id: 'b1', memberId: 'b1', ownerName: 'Ali', companyName: 'Acme', industry: 'IT', description: 'd', website: 'w',
      offer: '10% off', logo: '', businessCategory: 'Service Provider, Retailer', acceptsInternationalBusiness: 'Yes',
      idealReferralTypes: ['Banks'],
    } as BusinessProfile;
    expect(businessToDirectoryItem(biz, { avatarUrl: 'av', position: 'CEO' })).toMatchObject({
      key: 'local:b1', source: 'local', name: 'Ali', company: 'Acme', position: 'CEO', chapter: 'JCI Kuala Lumpur',
      country: 'Malaysia', categories: ['Service Provider', 'Retailer'], idealReferrals: ['Banks'], hasDeal: true,
      acceptsInternationalBusiness: true,
    });
    expect(businessToDirectoryItem({ ...biz, offer: '', acceptsInternationalBusiness: 'Willing to Explore' }, { avatarUrl: '', position: '' }))
      .toMatchObject({ hasDeal: false, acceptsInternationalBusiness: false });
  });

  it('sister card: chapter and country from the sister chapter, fallback avatar, ideal referrals', () => {
    const card = {
      id: 'c1', displayName: 'Mei', loId: 'sg', international: true, updatedAt: '', companyName: 'Lion',
      businessCategory: ['Retailer'], idealReferrals: ['Lawyers'], specialOfferSummary: 'free', acceptInternationalBusiness: 'Yes',
      sisterChapter: { id: 'sg', name: 'JCI Singapore', country: 'Singapore' },
    } as unknown as SisterChapterCard;
    expect(cardToDirectoryItem(card, n => `svg:${n}`)).toMatchObject({
      key: 'sister:c1', source: 'sister', name: 'Mei', avatarUrl: 'svg:Mei', company: 'Lion', chapter: 'JCI Singapore',
      country: 'Singapore', categories: ['Retailer'], idealReferrals: ['Lawyers'], hasDeal: true, dealSummary: 'free',
      acceptsInternationalBusiness: true,
    });
  });
});
