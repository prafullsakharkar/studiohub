import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { isEpisodicProject } from '@/types/production';

vi.mock('@/modules/production/hooks/useProjects', () => ({
  useProject: () => ({ data: undefined, isLoading: false }),
  useProjects: () => ({ data: { results: [] } }),
}));

const createProjectMock = vi.fn().mockResolvedValue({ id: 'p-new' });

vi.mock('@/modules/production/hooks/useProjectMutations', () => ({
  useProjectMutations: () => ({
    createProject: createProjectMock,
    updateProject: vi.fn(),
    isCreating: false,
    isUpdating: false,
  }),
}));

vi.mock('@/modules/clients', () => ({
  ClientSelect: () => null,
  ClientContactSelect: () => null,
}));

vi.mock('@/modules/vendors', () => ({
  VendorSelect: () => null,
}));

import { ProjectFormPage } from '@/modules/production/pages/ProjectFormPage';

describe('project workflow configuration', () => {
  it('treats an explicit workflow_type Episodic project as episodic', () => {
    expect(
      isEpisodicProject({ id: 'p1', workflow_type: 'Episodic' } as any)
    ).toBe(true);
  });

  it('leaves a Standard project on the legacy hierarchy', () => {
    expect(
      isEpisodicProject({ id: 'p1', workflow_type: 'Standard', type: 'Feature Film' } as any)
    ).toBe(false);
  });

  it('submits the chosen workflow_type in the create payload', async () => {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });

    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={['/projects/new']}>
          <ProjectFormPage />
        </MemoryRouter>
      </QueryClientProvider>
    );

    fireEvent.change(screen.getByLabelText(/workflow type/i), {
      target: { value: 'Episodic' },
    });

    fireEvent.change(screen.getByPlaceholderText(/neo-kyoto/i), {
      target: { value: 'Test Show' },
    });
    fireEvent.change(screen.getByPlaceholderText(/e\.g\. NK99/i), {
      target: { value: 'TST01' },
    });

    fireEvent.click(
      screen.getByRole('button', { name: /initialize project/i })
    );

    await waitFor(() => {
      expect(createProjectMock).toHaveBeenCalled();
    });
    expect(createProjectMock.mock.calls[0][0]).toMatchObject({
      workflow_type: 'Episodic',
    });
  });
});
