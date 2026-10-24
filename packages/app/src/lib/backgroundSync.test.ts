/**
 * T-OFF-020: backgroundSync drain loop
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { startBackgroundSync, stopBackgroundSync } from './backgroundSync';
import * as offline from './offlineStore';

describe('T-OFF-020: background sync', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    stopBackgroundSync();
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    stopBackgroundSync();
  });

  it('invokes push for the oldest pending record and marks it synced', async () => {
    vi.spyOn(offline, 'listPendingSync').mockResolvedValueOnce(['p1']).mockResolvedValue([]);
    vi.spyOn(offline, 'loadDocument').mockResolvedValue('payload');
    const markSynced = vi.spyOn(offline, 'markSynced').mockResolvedValue(undefined);
    const push = vi.fn().mockResolvedValue(undefined);

    const stop = startBackgroundSync({ push, pollMs: 10 });
    // advance past the first poll
    await vi.advanceTimersByTimeAsync(15);

    expect(push).toHaveBeenCalledWith('p1', 'payload');
    expect(markSynced).toHaveBeenCalledWith('p1');
    stop();
  });

  it('backs off on push failure without spinning', async () => {
    vi.spyOn(offline, 'listPendingSync').mockResolvedValue(['p1']);
    vi.spyOn(offline, 'loadDocument').mockResolvedValue('payload');
    vi.spyOn(offline, 'markSynced').mockResolvedValue(undefined);
    const push = vi.fn().mockRejectedValue(new Error('boom'));
    // Retry delay = back-off + random jitter (0–999 ms); pin the jitter so a
    // near-zero draw can't land the retry inside the window under test.
    vi.spyOn(Math, 'random').mockReturnValue(0.5);

    const stop = startBackgroundSync({ push, pollMs: 10, maxBackoffMs: 200 });
    await vi.advanceTimersByTimeAsync(15); // first failure
    const after1 = push.mock.calls.length;
    expect(after1).toBe(1);
    await vi.advanceTimersByTimeAsync(15); // within back-off window → no retry
    expect(push.mock.calls.length).toBe(after1);
    await vi.advanceTimersByTimeAsync(600); // back-off (10) + jitter (500) elapsed → retry
    expect(push.mock.calls.length).toBe(after1 + 1);
    stop();
  });

  it('stop halts the drain loop', async () => {
    vi.spyOn(offline, 'listPendingSync').mockResolvedValue(['p1']);
    vi.spyOn(offline, 'loadDocument').mockResolvedValue('payload');
    vi.spyOn(offline, 'markSynced').mockResolvedValue(undefined);
    const push = vi.fn().mockResolvedValue(undefined);

    const stop = startBackgroundSync({ push, pollMs: 10 });
    stop();
    await vi.advanceTimersByTimeAsync(100);
    expect(push).not.toHaveBeenCalled();
  });
});
