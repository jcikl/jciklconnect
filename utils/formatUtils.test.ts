import { describe, it, expect } from 'vitest';
import { formatEventPrice } from './formatUtils';

describe('formatEventPrice', () => {
  it('keeps the RM format for MYR (default)', () => {
    expect(formatEventPrice(50)).toBe('RM 50');
    expect(formatEventPrice(50, 50, 'MYR')).toBe('RM 50');
    expect(formatEventPrice(50, 80)).toBe('RM 50 – 80');
  });
  it('shows the same number in USD via formatCurrency', () => {
    expect(formatEventPrice(50, undefined, 'USD')).toBe('$50.00');
    expect(formatEventPrice(50, 80, 'USD')).toBe('$50.00 – $80.00');
    expect(formatEventPrice(50, 50, 'USD')).toBe('$50.00');
  });
});
