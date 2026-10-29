import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { SavedViewsBar } from '@/shared/views/SavedViewsBar';
import { savedViewsStore } from '@/shared/views/savedViewsStore';

const baseProps = {
  entityType: 'department',
  activeViewId: 'view-department-default',
  activeViewMode: 'table' as const,
  onSelectView: vi.fn(),
  onChangeViewMode: vi.fn(),
};

describe('SavedViewsBar extraViewData', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });

  it('merges extraViewData into created views', () => {
    render(<SavedViewsBar {...baseProps} extraViewData={{ searchText: 'rig' }} />);
    fireEvent.click(screen.getByRole('button', { name: /Save View/i }));
    fireEvent.change(screen.getByPlaceholderText(/My Active Tasks/i), {
      target: { value: 'Rig only' },
    });
    fireEvent.click(screen.getByRole('button', { name: /Create View/i }));

    const created = savedViewsStore
      .getViewsForEntity('department')
      .find((v) => v.name === 'Rig only');
    expect(created).toBeDefined();
    expect(created!.searchText).toBe('rig');
  });
});
