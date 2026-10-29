import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useTransientFeedback } from '../useTransientFeedback';

describe('useTransientFeedback', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('shows a value then auto-clears after the timeout', () => {
    const { result } = renderHook(() => useTransientFeedback<string>(3000));
    act(() => result.current[1]('saved'));
    expect(result.current[0]).toBe('saved');
    act(() => vi.advanceTimersByTime(3000));
    expect(result.current[0]).toBeNull();
  });

  it('resets the timer when shown twice', () => {
    const { result } = renderHook(() => useTransientFeedback<string>(3000));
    act(() => result.current[1]('one'));
    act(() => vi.advanceTimersByTime(2000));
    act(() => result.current[1]('two'));
    act(() => vi.advanceTimersByTime(2000));
    expect(result.current[0]).toBe('two');
    act(() => vi.advanceTimersByTime(1000));
    expect(result.current[0]).toBeNull();
  });
});
