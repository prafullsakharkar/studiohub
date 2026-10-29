import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import React from 'react';

/**
 * Task 12 fix: /clients/new must be a real create page (previously a dead
 * link that fell into /clients/:id and 404'd). Submission must reach
 * masterDataApi.createClient via the re-homed useClientMutations.
 */
const createClientMock = vi.fn();

vi.mock('@/modules/clients/hooks/useClientsData', () => ({
  useClientMutations: () => ({
    createClient: {
      mutate: (payload: any, opts?: { onSuccess?: (data: any) => void }) => {
        createClientMock(payload);
        opts?.onSuccess?.({ id: 'c-1', name: payload.name, code: payload.code });
      },
      isPending: false,
    },
    updateClient: { mutate: vi.fn(), isPending: false },
  }),
}));

import { ClientCreatePage } from '@/modules/clients/pages/ClientCreatePage';

describe('ClientCreatePage', () => {
  it('submits the flat create payload via useClientMutations.createClient', async () => {
    render(
      <MemoryRouter initialEntries={['/clients/new']}>
        <ClientCreatePage />
      </MemoryRouter>
    );

    fireEvent.change(screen.getByLabelText(/studio name/i), {
      target: { value: 'Warner Nexus Studios' },
    });
    fireEvent.change(screen.getByLabelText(/studio identifier code/i), {
      target: { value: 'wns' },
    });

    fireEvent.click(screen.getByRole('button', { name: /create client entity/i }));

    await waitFor(() => {
      expect(createClientMock).toHaveBeenCalledTimes(1);
    });
    expect(createClientMock.mock.calls[0][0]).toMatchObject({
      name: 'Warner Nexus Studios',
      code: 'WNS',
      status: 'Active',
    });
  });

  it('does not submit when required name/code are missing', async () => {
    render(
      <MemoryRouter initialEntries={['/clients/new']}>
        <ClientCreatePage />
      </MemoryRouter>
    );

    fireEvent.click(screen.getByRole('button', { name: /create client entity/i }));

    await waitFor(() => {
      expect(createClientMock).not.toHaveBeenCalled();
    });
  });
});
