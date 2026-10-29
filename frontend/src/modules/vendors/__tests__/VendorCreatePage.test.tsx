import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import React from 'react';

/**
 * Task 12 fix: /vendors/new must be a real create page (previously a dead
 * link that fell into /vendors/:id and 404'd). Submission must reach
 * masterDataApi.createVendor via the re-homed useVendorMutations.
 */
const createVendorMock = vi.fn();

vi.mock('@/modules/vendors/hooks/useVendorsData', () => ({
  useVendorMutations: () => ({
    createVendor: {
      mutate: (payload: any, opts?: { onSuccess?: (data: any) => void }) => {
        createVendorMock(payload);
        opts?.onSuccess?.({ id: 'v-1', name: payload.name, code: payload.code });
      },
      isPending: false,
    },
    updateVendor: { mutate: vi.fn(), isPending: false },
  }),
}));

import { VendorCreatePage } from '@/modules/vendors/pages/VendorCreatePage';

describe('VendorCreatePage', () => {
  it('submits the flat create payload via useVendorMutations.createVendor', async () => {
    render(
      <MemoryRouter initialEntries={['/vendors/new']}>
        <VendorCreatePage />
      </MemoryRouter>
    );

    fireEvent.change(screen.getByLabelText(/vendor name/i), {
      target: { value: 'Apex Silhouette Labs' },
    });
    fireEvent.change(screen.getByLabelText(/vendor code/i), {
      target: { value: 'asl' },
    });

    fireEvent.click(screen.getByRole('button', { name: /create vendor partner/i }));

    await waitFor(() => {
      expect(createVendorMock).toHaveBeenCalledTimes(1);
    });
    expect(createVendorMock.mock.calls[0][0]).toMatchObject({
      name: 'Apex Silhouette Labs',
      code: 'ASL',
      status: 'Active',
    });
  });

  it('does not submit when required name/code are missing', async () => {
    render(
      <MemoryRouter initialEntries={['/vendors/new']}>
        <VendorCreatePage />
      </MemoryRouter>
    );

    fireEvent.click(screen.getByRole('button', { name: /create vendor partner/i }));

    await waitFor(() => {
      expect(createVendorMock).not.toHaveBeenCalled();
    });
  });
});
