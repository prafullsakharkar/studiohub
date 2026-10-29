import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { EntityTable } from '@/shared/crud/EntityTable';

const rows = [
  { id: 'r1', method: 'GET', endpoint: '/api/v1/a' },
  { id: 'r2', method: 'POST', endpoint: '/api/v1/b' },
];
const fields = [
  { key: 'method', label: 'Method' },
  { key: 'endpoint', label: 'Endpoint' },
];

describe('EntityTable controlled (server-side) mode', () => {
  it('renders a server search input bound to searchQuery/onSearchChange', () => {
    vi.useFakeTimers();
    try {
      const onSearchChange = vi.fn();
      render(
        <EntityTable
          data={rows} fields={fields} page={1} totalCount={2}
          onPageChange={() => {}} searchQuery="" onSearchChange={onSearchChange}
          searchPlaceholder="Search records..."
        />
      );
      const input = screen.getByPlaceholderText('Search records...');
      fireEvent.change(input, { target: { value: 'shot' } });
      // Debounced: no request yet, input stays responsive.
      expect(onSearchChange).not.toHaveBeenCalled();
      expect(input).toHaveValue('shot');
      vi.advanceTimersByTime(300);
      expect(onSearchChange).toHaveBeenCalledWith('shot');
    } finally {
      vi.useRealTimers();
    }
  });

  it('paginates via the controlled page props, not local state', () => {
    const onPageChange = vi.fn();
    render(
      <EntityTable
        data={rows} fields={fields} page={2} totalCount={95} pageSize={10}
        onPageChange={onPageChange}
      />
    );
    expect(screen.getByText('95 items')).toBeTruthy();
    fireEvent.click(screen.getByText('3'));
    expect(onPageChange).toHaveBeenCalledWith(3);
  });

  it('forwards row clicks without local selection state', () => {
    const onRowClick = vi.fn();
    render(
      <EntityTable
        data={rows} fields={fields} page={1} totalCount={2}
        onPageChange={() => {}} onRowClick={onRowClick}
      />
    );
    fireEvent.click(screen.getByText('/api/v1/a'));
    expect(onRowClick).toHaveBeenCalledWith(rows[0]);
  });
});
