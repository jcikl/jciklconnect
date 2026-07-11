import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock authStorage so tests don't touch localStorage
vi.mock('./authStorage', () => ({
  isDevModeStored: vi.fn(() => false),
}));

import { isDevMode, setDevMode, checkDevMode, withDevMode } from './devMode';
import { isDevModeStored } from './authStorage';

describe('isDevMode', () => {
  beforeEach(() => {
    setDevMode(false);
    vi.mocked(isDevModeStored).mockReturnValue(false);
  });

  afterEach(() => {
    setDevMode(false);
  });

  it('returns false by default', () => {
    expect(isDevMode()).toBe(false);
  });

  it('returns true after setDevMode(true)', () => {
    setDevMode(true);
    expect(isDevMode()).toBe(true);
  });

  it('returns true when localStorage has dev mode enabled', () => {
    vi.mocked(isDevModeStored).mockReturnValue(true);
    expect(isDevMode()).toBe(true);
  });

  it('checkDevMode is an alias for isDevMode', () => {
    setDevMode(true);
    expect(checkDevMode()).toBe(isDevMode());
  });
});

describe('withDevMode', () => {
  beforeEach(() => {
    setDevMode(false);
    vi.mocked(isDevModeStored).mockReturnValue(false);
  });

  afterEach(() => {
    setDevMode(false);
  });

  it('calls real function when dev mode is off', async () => {
    const result = await withDevMode(() => 'mock', async () => 'real');
    expect(result).toBe('real');
  });

  it('returns mock data when dev mode is on', async () => {
    setDevMode(true);
    const result = await withDevMode(() => 'mock', async () => 'real');
    expect(result).toBe('mock');
  });

  it('supports async mock functions', async () => {
    setDevMode(true);
    const result = await withDevMode(async () => 42, async () => 0);
    expect(result).toBe(42);
  });

  it('does not call real function when dev mode is on', async () => {
    setDevMode(true);
    const realFn = vi.fn(async () => 'real');
    await withDevMode(() => 'mock', realFn);
    expect(realFn).not.toHaveBeenCalled();
  });

  it('does not call mock function when dev mode is off', async () => {
    const mockFn = vi.fn(() => 'mock');
    await withDevMode(mockFn, async () => 'real');
    expect(mockFn).not.toHaveBeenCalled();
  });
});
