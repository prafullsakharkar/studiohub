import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { Project } from '@/types/production';

const mockState = vi.hoisted(() => ({
  episodes: [] as any[],
  sequences: undefined as any[] | undefined,
  createShot: vi.fn(),
  createEpisode: vi.fn(),
  createSequence: vi.fn(),
  refetchEpisodes: vi.fn(),
  refetchSequences: vi.fn(),
  bulkManagerProps: null as any,
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
  ShotBulkManager: (props: any) => {
    mockState.bulkManagerProps = props;
    return null;
  },
}));

vi.mock('@/modules/production/hooks/useProjectScopedData', async (importOriginal) => {
  const mod = await importOriginal<any>();
  return {
    ...mod,
    useProjectEpisodes: () => ({
      data: { results: mockState.episodes },
      isLoading: false,
      refetch: mockState.refetchEpisodes,
    }),
    useProjectSequences: () => ({
      data: mockState.sequences === undefined ? undefined : { results: mockState.sequences },
      isLoading: false,
      refetch: mockState.refetchSequences,
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
    createSequence: mockState.createSequence,
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
  mockState.episodes = [
    { id: 'ep-101', code: 'EP101', name: 'Pilot', project_id: 'proj-102' },
  ];
  mockState.sequences = [
    { id: 'seq-1', code: 'SOL03_010', episode_id: 'ep-101', project_id: 'proj-102' },
  ];
  mockState.bulkManagerProps = null;
  mockState.createShot.mockReset();
  mockState.createEpisode.mockReset();
  mockState.createSequence.mockReset();
  mockState.refetchEpisodes.mockReset();
  mockState.refetchSequences.mockReset();
  mockState.createEpisode.mockResolvedValue({
    id: 'ep-102',
    code: 'EP102',
    name: 'Second',
    project_id: 'proj-102',
  });
  mockState.createSequence.mockResolvedValue({
    id: 'seq-2',
    code: 'SOL03_020',
    episode_id: 'ep-101',
  });
});

describe('bulk manager production wiring', () => {
  it('passes real episode/sequence lists and mutation callbacks on episodic projects', async () => {
    renderTab(episodicProject);
    const props = mockState.bulkManagerProps;

    expect(props.projectId).toBe('proj-102');
    expect(props.isEpisodic).toBe(true);
    expect(props.episodes).toEqual([
      { id: 'ep-101', code: 'EP101', name: 'Pilot' },
    ]);
    expect(props.sequences).toEqual([
      { id: 'seq-1', code: 'SOL03_010', episode_id: 'ep-101' },
    ]);
    expect(typeof props.onCreateEpisode).toBe('function');
    expect(typeof props.onCreateSequence).toBe('function');

    // Callbacks hit the real mutations with hierarchy context and refetch.
    const createdEp = await props.onCreateEpisode({
      project_id: 'proj-102',
      project_code: 'SOL03',
      code: 'EP102',
      name: 'Second',
    });
    expect(mockState.createEpisode).toHaveBeenCalledWith(
      expect.objectContaining({
        project_id: 'proj-102',
        code: 'EP102',
        name: 'Second',
        status: 'In Progress',
      })
    );
    expect(createdEp.id).toBe('ep-102');
    expect(mockState.refetchEpisodes).toHaveBeenCalled();

    const createdSeq = await props.onCreateSequence({
      project_id: 'proj-102',
      project_code: 'SOL03',
      episode_id: 'ep-101',
      code: 'sol03_020',
    });
    expect(mockState.createSequence).toHaveBeenCalledWith(
      expect.objectContaining({
        project_id: 'proj-102',
        episode_id: 'ep-101',
        episode_code: 'EP101',
        code: 'SOL03_020',
      })
    );
    expect(createdSeq.id).toBe('seq-2');
    expect(mockState.refetchSequences).toHaveBeenCalled();
  });

  it('passes none of the episodic props on standard projects', async () => {
    renderTab(standardProject);
    const props = mockState.bulkManagerProps;

    expect(props.projectId).toBe('proj-101');
    expect(props.isEpisodic).toBeUndefined();
    expect(props.episodeId).toBeUndefined();
    expect(props.episodes).toBeUndefined();
    expect(props.sequences).toBeUndefined();
    expect(props.onCreateEpisode).toBeUndefined();
    expect(props.onCreateSequence).toBeUndefined();
  });

  it('withholds the sequence list while the query has no data yet', async () => {
    mockState.sequences = undefined;
    renderTab(episodicProject);
    const props = mockState.bulkManagerProps;

    expect(props.isEpisodic).toBe(true);
    expect(props.episodes).toHaveLength(1);
    // Unknown (not known-empty): the manager must not prompt blind.
    expect(props.sequences).toBeUndefined();
  });
});
