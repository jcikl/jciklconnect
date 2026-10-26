import { describe, it, expect } from 'vitest';
import { isOfferLive, getMemberOffers, getLiveOffers, todayIso } from './specialOffers.mjs';

const TODAY = '2026-10-26';

describe('isOfferLive', () => {
  it('active with no expiry is live; status missing counts as active', () => {
    expect(isOfferLive({ description: '10% off' }, TODAY)).toBe(true);
    expect(isOfferLive({ description: '10% off', status: 'Active' }, TODAY)).toBe(true);
  });

  it('paused is not live', () => {
    expect(isOfferLive({ description: '10% off', status: 'Paused' }, TODAY)).toBe(false);
  });

  it('expiry: past is not live, today and future are live, blank means no expiry', () => {
    expect(isOfferLive({ description: 'x', expiryDate: '2026-10-25' }, TODAY)).toBe(false);
    expect(isOfferLive({ description: 'x', expiryDate: '2026-10-26' }, TODAY)).toBe(true);
    expect(isOfferLive({ description: 'x', expiryDate: '2027-01-01' }, TODAY)).toBe(true);
    expect(isOfferLive({ description: 'x', expiryDate: '' }, TODAY)).toBe(true);
    // A full ISO timestamp compares by its date part.
    expect(isOfferLive({ description: 'x', expiryDate: '2026-10-25T23:59:00.000Z' }, TODAY)).toBe(false);
  });

  it('paused wins over a future expiry', () => {
    expect(isOfferLive({ description: 'x', status: 'Paused', expiryDate: '2030-01-01' }, TODAY)).toBe(false);
  });

  it('blank / missing offers are not live; a legacy string is live when non-empty', () => {
    expect(isOfferLive(undefined, TODAY)).toBe(false);
    expect(isOfferLive(null, TODAY)).toBe(false);
    expect(isOfferLive({ description: '  ' }, TODAY)).toBe(false);
    expect(isOfferLive('', TODAY)).toBe(false);
    expect(isOfferLive('free coffee', TODAY)).toBe(true);
  });
});

describe('getMemberOffers / getLiveOffers', () => {
  it('reads business.specialOffers when it is an array (blank entries dropped)', () => {
    const m = { business: { specialOffers: [{ description: 'A' }, { description: ' ' }, { description: 'B', status: 'Paused' }], specialOffer: { description: 'stale' } } };
    expect(getMemberOffers(m).map(o => o.description)).toEqual(['A', 'B']);
    expect(getLiveOffers(m, TODAY).map(o => o.description)).toEqual(['A']);
  });

  it('an empty specialOffers array means no offers (legacy mirror ignored)', () => {
    expect(getMemberOffers({ business: { specialOffers: [], specialOffer: 'stale' } })).toEqual([]);
  });

  it('falls back to legacy business.specialOffer (object or string), then top-level specialOffer', () => {
    expect(getMemberOffers({ business: { specialOffer: { description: 'Obj' } } })).toEqual([{ description: 'Obj' }]);
    expect(getMemberOffers({ business: { specialOffer: 'Str' } })).toEqual([{ description: 'Str' }]);
    expect(getMemberOffers({ specialOffer: 'Top' })).toEqual([{ description: 'Top' }]);
    expect(getMemberOffers({ business: { specialOffer: '' } })).toEqual([]);
    expect(getMemberOffers(null)).toEqual([]);
  });

  it('legacy expired offer is not live', () => {
    expect(getLiveOffers({ business: { specialOffer: { description: 'Old', expiryDate: '2020-01-01' } } }, TODAY)).toEqual([]);
  });
});

describe('todayIso', () => {
  it('formats the local date as YYYY-MM-DD', () => {
    expect(todayIso(new Date(2026, 0, 5, 23, 30))).toBe('2026-01-05');
  });
});
