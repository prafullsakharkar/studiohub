import { describe, it, expect, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { useEntitySelection } from '@/shared/hooks/useEntitySelection';
import { BulkDeleteBar } from '@/shared/crud/BulkDeleteBar';

describe('useEntitySelection', () => {
  it('toggles ids and clears', () => {
    const { result } = renderHook(() => useEntitySelection());
    act(() => result.current.toggleSelect('a'));
    act(() => result.current.toggleSelect('b'));
    expect(result.current.selectedIds).toEqual(['a', 'b']);
    act(() => result.current.toggleSelect('a'));
    expect(result.current.selectedIds).toEqual(['b']);
    act(() => result.current.toggleSelectAll(['b', 'c']));
    expect(result.current.selectedIds).toEqual(['b', 'c']);
    act(() => result.current.clearSelection());
    expect(result.current.selectedIds).toEqual([]);
  });
});

describe('BulkDeleteBar', () => {
  it('renders nothing without selection or permission', () => {
    const { rerender } = render(
      <BulkDeleteBar selectedCount={0} entityLabel="squads" canDelete={true} onDelete={() => {}} onClear={() => {}} />,
    );
    expect(screen.queryByRole('toolbar')).toBeNull();
    rerender(
      <BulkDeleteBar selectedCount={3} entityLabel="squads" canDelete={false} onDelete={() => {}} onClear={() => {}} />,
    );
    expect(screen.queryByRole('toolbar')).toBeNull();
  });

  it('shows count and fires delete', () => {
    const onDelete = vi.fn();
    render(
      <BulkDeleteBar selectedCount={3} entityLabel="squads" canDelete={true} onDelete={onDelete} onClear={() => {}} />,
    );
    expect(screen.getByText('3 selected')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Delete squads/i }));
    expect(onDelete).toHaveBeenCalledTimes(1);
  });
});
