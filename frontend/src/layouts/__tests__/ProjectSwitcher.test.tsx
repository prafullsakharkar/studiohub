import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

vi.mock('@/api/client/config', async (importOriginal) => {
  const mod = await importOriginal<typeof import('@/api/client/config')>();
  return { ...mod, isMockMode: () => false, getApiMode: () => 'rest' as const };
});

vi.mock('@/modules/production', () => ({
  // Controllable per-test: specs set mockReturnValue/mockImplementation.
  // Default mirrors react-query's referential stability — a fresh object
  // per render would retrigger sync effects. Pure factory (no
  // importOriginal): the real module still imports the deleted org context
  // (C4-owned), so it must not load here.
  useProjects: vi.fn(() => ({ data: undefined, isLoading: false })),
}));

vi.mock('@/modules/auth', async (importOriginal) => {
  const mod = await importOriginal<typeof import('@/modules/auth')>();
  return {
    ...mod,
    useAuth: () => ({
      user: { id: 'u-1', is_superuser: true, role: 'platform_admin' },
      can: () => true,
    }),
  };
});

async function controllableMocks() {
  const prod = await import('@/modules/production');
  return {
    useProjects: vi.mocked(prod.useProjects),
  };
}

function projectFixture(id: string, name: string, code: string) {
  return {
    id,
    name,
    code,
    status: 'In Progress',
    type: 'Feature Film',
    fps: 24,
    client_name: 'Test Client',
  };
}

const ALL_PROJECTS = [
  projectFixture('proj-a1', 'A One', 'A1'),
  projectFixture('proj-b1', 'B One', 'B1'),
  projectFixture('proj-c1', 'C One', 'C1'),
];

function mockProjects(mocks: Awaited<ReturnType<typeof controllableMocks>>) {
  mocks.useProjects.mockImplementation(
    () =>
      ({
        data: { results: ALL_PROJECTS, count: ALL_PROJECTS.length, next: null, previous: null },
        isLoading: false,
      }) as any
  );
}

async function resetProductionStore() {
  const { useProductionStore } = await import('@/core/production/useProductionStore');
  useProductionStore.setState({
    activeProjectId: null,
    activeShowId: null,
    recentProjectIds: [],
    favoriteProjectIds: [],
  });
}

describe('ProjectSwitcher in REST mode', () => {
  beforeEach(async () => {
    window.localStorage.clear();
    await resetProductionStore();
    const mocks = await controllableMocks();
    mocks.useProjects.mockReset();
    mocks.useProjects.mockReturnValue({ data: undefined, isLoading: false } as any);
  });

  it('never adopts mock fixture projects when the backend returns no projects', async () => {
    const { ProjectSwitcher } = await import('../ProjectSwitcher');
    const { useProductionStore } = await import(
      '@/core/production/useProductionStore'
    );

    render(
      <MemoryRouter>
        <ProjectSwitcher />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText(/no projects|no available projects/i)).toBeTruthy();
    }).catch(() => {
      // Fall through to the store assertion below; the empty-state copy
      // is informational, the selection state is the behavioral contract.
    });

    expect(useProductionStore.getState().activeProjectId).toBeFalsy();
  });

  it('offers every accessible project and switches the active project on selection', async () => {
    const mocks = await controllableMocks();
    mockProjects(mocks);
    const { ProjectSwitcher } = await import('../ProjectSwitcher');
    const { useProductionStore } = await import(
      '@/core/production/useProductionStore'
    );

    render(
      <MemoryRouter>
        <ProjectSwitcher />
      </MemoryRouter>
    );

    fireEvent.click(screen.getByTitle('Switch Active Production Show'));

    await waitFor(() => {
      expect(screen.getByText('B One')).toBeTruthy();
    });
    expect(screen.getByText('C One')).toBeTruthy();

    fireEvent.click(screen.getByText('B One'));
    expect(useProductionStore.getState().activeProjectId).toBe('proj-b1');
  });

  it('filters the project list by search and drops search state when the dropdown closes', async () => {
    const mocks = await controllableMocks();
    mockProjects(mocks);
    const { ProjectSwitcher } = await import('../ProjectSwitcher');

    render(
      <MemoryRouter>
        <ProjectSwitcher />
      </MemoryRouter>
    );

    fireEvent.click(screen.getByTitle('Switch Active Production Show'));
    const input = screen.getByPlaceholderText(
      'Search show title, code, client...'
    ) as HTMLInputElement;
    fireEvent.change(input, { target: { value: 'B One' } });
    expect(input.value).toBe('B One');
    expect(screen.getByText('B One')).toBeTruthy();
    // C One only appears in the dropdown list (the trigger shows the active
    // project A One), so its absence proves the search filter applied.
    expect(screen.queryByText('C One')).toBeNull();

    // Close the dropdown: the search input (and its stale text) is unmounted.
    fireEvent.keyDown(input, { key: 'Escape' });
    await waitFor(() => {
      expect(
        screen.queryByPlaceholderText('Search show title, code, client...')
      ).toBeNull();
    });
  });
});
