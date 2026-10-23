/**
 * T-A11Y-01: Screen reader announcer
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useSrAnnouncer } from './useSrAnnouncer';

describe('T-A11Y-01: useSrAnnouncer', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    document.body.innerHTML = '<div id="sr-announcer" aria-live="polite"></div>';
  });

  afterEach(() => {
    vi.useRealTimers();
    document.body.innerHTML = '';
  });

  it('writes the latest message to the live region after the throttle window', () => {
    const { result } = renderHook(() => useSrAnnouncer());

    result.current('1 element selected');
    result.current('2 elements selected');
    vi.advanceTimersByTime(500);
    vi.runAllTimers();

    expect(document.getElementById('sr-announcer')?.textContent).toBe('2 elements selected');
  });

  it('cancels the pending announcement on unmount', () => {
    const { result, unmount } = renderHook(() => useSrAnnouncer());
    const getById = vi.spyOn(document, 'getElementById');

    result.current('1 element selected');
    unmount();
    vi.advanceTimersByTime(500);

    expect(getById).not.toHaveBeenCalled();
  });
});
