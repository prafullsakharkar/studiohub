import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { act } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { Project } from '@/types/production';

const mockState = vi.hoisted(() => ({
  episodes: [] as any[],
  createShot: vi.fn(),
  createEpisode: vi.fn(),
}));

vi.mock('@/modules/shots', () => ({
  useShots: () => ({ data: { results: [] }, isLoading: false, refetch: vi.fn() }),
  useShotMutations: () => ({
    createShot: mockState.createShot,
    updateShot: vi.fn(),
    isCreating: false,
  }),
  useBulkShots: () => ({
    bulkUpdate: vi.fn(),
    bulkArchive: vi.fn(),
    bulkRestore: vi.fn(),
  }),
  ShotBulkManager: () => null,
}));

vi.mock('@/modules/production/hooks/useProjectScopedData', async (importOriginal) => {
  const mod = await importOriginal<any>();
  return {
    ...mod,
    useProjectEpisodes: () => ({
      data: { results: mockState.episodes },
      isLoading: false,
      refetch: vi.fn(),
    }),
    useProjectSequences: () => ({
      data: undefined,
      isLoading: false,
      refetch: vi.fn(),
    }),
  };
});

vi.mock('@/modules/episodes', () => ({
  useEpisodeMutations: () => ({
    createEpisode: mockState.createEpisode,
    isCreating: false,
  }),
}));

vi.mock('@/modules/sequences', () => ({
  useSequenceMutations: () => ({
    createSequence: vi.fn(),
    isCreating: false,
  }),
}));

vi.mock('@/core/permissions/PermissionComponents', () => ({
  PermissionButton: ({ children, onClick }: any) => (
    <button onClick={onClick}>{children}</button>
  ),
}));

import { ProjectShotsTab } from '../ProjectShotsTab';

const episodicProject = {
  id: 'proj-102',
  code: 'SOL03',
  name: 'Solar Odyssey 3000',
  organization_id: 'org-vanguard-02',
  type: 'Episodic Series',
  status: 'In Progress',
  start_date: '2026-03-15',
  delivery_date: '2027-04-15',
} as unknown as Project;

const standardProject = {
  id: 'proj-101',
  code: 'NEB01',
  name: 'Nebula Raiders: Starfall',
  organization_id: 'org-vanguard-02',
  type: 'Feature Film',
  status: 'In Progress',
  start_date: '2026-02-01',
  delivery_date: '2027-02-28',
} as unknown as Project;

function renderTab(project: Project) {
  return render(
    <MemoryRouter>
      <ProjectShotsTab project={project} onNavigateTab={() => {}} />
    </MemoryRouter>
  );
}

beforeEach(() => {
  mockState.episodes = [];
  mockState.createShot.mockReset();
  mockState.createEpisode.mockReset();
  mockState.createEpisode.mockResolvedValue({
    id: 'ep-101',
    code: 'EP101',
    name: 'Pilot',
    project_id: 'proj-102',
  });
});

describe('shot create on episodic projects', () => {
  it('requires an episode and submits the full id chain', async () => {
    // No episodes yet: the shot modal must show the required-episode prompt
    // with inline episode creation instead of an episode select.
    const { rerender } = renderTab(episodicProject);
    fireEvent.click(screen.getByRole('button', { name: /new shot/i }));

    expect(await screen.findByText(/no episodes found/i)).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /^create episode$/i })
    ).toBeInTheDocument();
    // Submit is blocked while no episode exists.
    expect(
      screen.getByRole('button', { name: /^create shot$/i })
    ).toBeDisabled();
    expect(mockState.createShot).not.toHaveBeenCalled();

    // Enter shot values, then create the episode inline; the pending shot
    // form must survive the episode creation round-trip.
    fireEvent.change(screen.getByPlaceholderText(/close up hero/i), {
      target: { value: 'Hero close-up' },
    });
    fireEvent.click(screen.getByRole('button', { name: /^create episode$/i }));
    expect(await screen.findByText(/create new episode/i)).toBeInTheDocument();

    fireEvent.change(screen.getByPlaceholderText(/e\.g\. SOL_EP01/i), {
      target: { value: 'EP101' },
    });
    fireEvent.change(screen.getByPlaceholderText(/e\.g\. The Arrival/i), {
      target: { value: 'Pilot' },
    });
    const createButtons = screen.getAllByRole('button', {
      name: /^create episode$/i,
    });
    fireEvent.click(createButtons[createButtons.length - 1]);

    await waitFor(() =>
      expect(mockState.createEpisode).toHaveBeenCalledWith(
        expect.objectContaining({ project_id: 'proj-102' })
      )
    );
    await waitFor(() =>
      expect(screen.queryByText(/create new episode/i)).not.toBeInTheDocument()
    );
    expect(screen.getByPlaceholderText(/close up hero/i)).toHaveValue(
      'Hero close-up'
    );

    // Episodes arrive: select ep-101 and submit the full id chain.
    mockState.episodes = [
      { id: 'ep-101', code: 'EP101', name: 'Pilot', project_id: 'proj-102' },
    ];
    rerender(
      <MemoryRouter>
        <ProjectShotsTab project={episodicProject} onNavigateTab={() => {}} />
      </MemoryRouter>
    );
    const episodeSelect = await screen.findByLabelText(/target episode/i);
    fireEvent.change(episodeSelect, { target: { value: 'ep-101' } });
    fireEvent.click(screen.getByRole('button', { name: /^create shot$/i }));

    await waitFor(() =>
      expect(mockState.createShot).toHaveBeenCalledWith(
        expect.objectContaining({
          project_id: 'proj-102',
          episode_id: 'ep-101',
          episode_code: 'EP101',
          episode_name: 'Pilot',
          sequence_code: expect.any(String),
          code: expect.any(String),
        })
      )
    );
  });

  it('revalidates the pending payload when the project changes mid-dialog', async () => {
    mockState.episodes = [
      { id: 'ep-101', code: 'EP101', name: 'Pilot', project_id: 'proj-102' },
    ];
    const { rerender } = renderTab(episodicProject);
    fireEvent.click(screen.getByRole('button', { name: /new shot/i }));
    expect(await screen.findByLabelText(/target episode/i)).toBeInTheDocument();

    // Switch to a standard project mid-dialog: the episode selector must
    // disappear and submit must carry no episode_id.
    rerender(
      <MemoryRouter>
        <ProjectShotsTab project={standardProject} onNavigateTab={() => {}} />
      </MemoryRouter>
    );
    await waitFor(() =>
      expect(screen.queryByLabelText(/target episode/i)).not.toBeInTheDocument()
    );

    fireEvent.change(screen.getByPlaceholderText(/close up hero/i), {
      target: { value: 'Standard shot' },
    });
    fireEvent.click(screen.getByRole('button', { name: /^create shot$/i }));

    await waitFor(() =>
      expect(mockState.createShot).toHaveBeenCalledWith(
        expect.objectContaining({ project_id: 'proj-101' })
      )
    );
    const payload = mockState.createShot.mock.calls[0][0];
    expect(payload.episode_id).toBeUndefined();
    expect(payload.episode_code).toBeUndefined();
    expect(payload.episode_name).toBeUndefined();
  });

  it('blocks submit with an alert when no episode is selected', async () => {
    mockState.episodes = [
      { id: 'ep-101', code: 'EP101', name: 'Pilot', project_id: 'proj-102' },
    ];
    renderTab(episodicProject);
    fireEvent.click(screen.getByRole('button', { name: /new shot/i }));
    const episodeSelect = await screen.findByLabelText(/target episode/i);
    // Auto-defaulted to episodes[0] on open.
    expect(episodeSelect).toHaveValue('ep-101');
    fireEvent.change(screen.getByPlaceholderText(/close up hero/i), {
      target: { value: 'Guard probe' },
    });

    // Clear the selection and submit inside one act() scope with raw
    // dispatches: the auto-default effect recovers an empty selection on
    // effect flush (and nested fireEvent act() scopes flush early), so both
    // events must land before any flush for the episode guard to observe it.
    const htmlSelect = episodeSelect as HTMLSelectElement;
    const form = screen
      .getByRole('button', { name: /^create shot$/i })
      .closest('form')!;
    act(() => {
      htmlSelect.value = '';
      htmlSelect.dispatchEvent(new Event('change', { bubbles: true }));
      form.dispatchEvent(
        new Event('submit', { bubbles: true, cancelable: true })
      );
    });

    expect(await screen.findByRole('alert')).toHaveTextContent(
      /an episode is required/i
    );
    expect(mockState.createShot).not.toHaveBeenCalled();
  });
});
