import { describe, it, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { usePersistedViewMode } from '../usePersistedViewMode';

describe('usePersistedViewMode', () => {
  it('persists the mode per entity type across mounts', () => {
    localStorage.clear();
    const { result, unmount } = renderHook(() => usePersistedViewMode('department'));
    expect(result.current[0]).toBe('table');
    act(() => result.current[1]('grid'));
    unmount();
    const second = renderHook(() => usePersistedViewMode('department'));
    expect(second.result.current[0]).toBe('grid');
    const other = renderHook(() => usePersistedViewMode('team'));
    expect(other.result.current[0]).toBe('table');
  });
});
