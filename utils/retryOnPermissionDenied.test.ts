import { describe, it, expect, vi } from 'vitest';
import { retryOnPermissionDenied } from './retryOnPermissionDenied';

const denied = Object.assign(new Error('Missing or insufficient permissions.'), { code: 'permission-denied' });

describe('retryOnPermissionDenied', () => {
  it('refreshes the credential and succeeds when the first read is rejected (reload race)', async () => {
    const read = vi.fn().mockRejectedValueOnce(denied).mockResolvedValueOnce('member');
    const refresh = vi.fn(async () => 'token');
    await expect(retryOnPermissionDenied(read, refresh, { delayMs: 0 })).resolves.toBe('member');
    expect(read).toHaveBeenCalledTimes(2);
    expect(refresh).toHaveBeenCalledTimes(1);
  });

  it('still fails a genuinely forbidden read after the retries', async () => {
    const read = vi.fn().mockRejectedValue(denied);
    const refresh = vi.fn(async () => 'token');
    await expect(retryOnPermissionDenied(read, refresh, { retries: 2, delayMs: 0 })).rejects.toBe(denied);
    expect(read).toHaveBeenCalledTimes(3);
    expect(refresh).toHaveBeenCalledTimes(2);
  });

  it('does not retry other errors, and a failed refresh does not stop the retry', async () => {
    const offline = Object.assign(new Error('offline'), { code: 'unavailable' });
    const read = vi.fn().mockRejectedValue(offline);
    await expect(retryOnPermissionDenied(read, vi.fn(), { delayMs: 0 })).rejects.toBe(offline);
    expect(read).toHaveBeenCalledTimes(1);

    const read2 = vi.fn().mockRejectedValueOnce(denied).mockResolvedValueOnce('ok');
    await expect(retryOnPermissionDenied(read2, vi.fn(async () => { throw new Error('network'); }), { delayMs: 0 })).resolves.toBe('ok');
  });
});
