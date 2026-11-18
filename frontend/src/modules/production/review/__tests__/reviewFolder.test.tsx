import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import type React from 'react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ReviewCopies, ReviewCopiesRemade, ReviewMedia, Version } from '@/api/production/review';
import { AuthContext } from '@/core/auth/AuthContext';
import type { AuthContextValue } from '@/core/auth/AuthContext';
import { tokenStorage } from '@/core/auth/tokenStorage';
import { DirectoryFormPage } from '@/modules/directory/DirectoryFormPage';
import { projectsFormConfig } from '@/modules/production/structure/configs';
import { mockFetch } from '@/test/fetchMock';
import type { MockCall, MockReply } from '@/test/fetchMock';
import { loadSample } from '@/test/samples';
import type { User } from '@/types/identity';
import { differingText, remadeText, sequencesText } from '../ReviewCopiesNotice';
import { isFramePattern, storageBody } from '../ReviewFromStorage';
import { canRemake, framesText, ReviewMoviePanel, storageText } from '../ReviewMoviePanel';

/**
 * RP-18 (C-RP-47 to C-RP-49): review copies of versions still in review, read by path from the project's review folder,
 * against _review_folder_flow.json (captured with a real ffmpeg on a temporary storage root).
 */
type Captured = { status: number; body: unknown };
const flow = loadSample<Record<string, Captured>>('production/_review_folder_flow.json');
const auth = loadSample('identity/_auth_flow.json');
const admin = auth.me_admin.body as unknown as User;
const artist = auth.me_artist.body as unknown as User; // version.create, not project.update
const ids = flow.ids as unknown as Record<string, string>;
const fromPath = flow.version_from_path.body as Version;
const moved = flow.version_after_move.body as Version;
const failed = flow.version_escaping_failed.body as Version;
const copy = (v: Version) => v.review_media as ReviewMedia;
const fresh = { ...fromPath, review_media: null, review_media_job: null } as Version;

const path = (c: MockCall) => new URL(c.url).pathname;
const captured = (key: string): MockReply => ({ status: flow[key].status, body: flow[key].body });

function mount(ui: React.ReactElement, user: User = admin, at = '/') {
  render(
    <MemoryRouter initialEntries={[at]}>
      <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } })}>
        <AuthContext.Provider value={{ user, refreshUser: vi.fn() } as unknown as AuthContextValue}>{ui}</AuthContext.Provider>
      </QueryClientProvider>
    </MemoryRouter>,
  );
}
const panel = () => screen.getByRole('region', { name: 'Review movie' });

beforeEach(() => tokenStorage.setTokens({ access: 'a', refresh: 'r' }));
afterEach(() => {
  cleanup();
  tokenStorage.clearTokens();
  vi.unstubAllGlobals();
});

describe('what is sent (C-RP-48)', () => {
  it('a frame pattern is %0Nd or # in the file name, not in a folder', () => {
    expect(isFramePattern('sh010/comp/v003/sh010.%04d.exr')).toBe(true);
    expect(isFramePattern('sh010/sh010.####.exr')).toBe(true);
    expect(isFramePattern('sh010/sh010.mov')).toBe(false);
    expect(isFramePattern('sh#10/sh010.mov')).toBe(false);
  });

  it('the range only for a pattern; refusals before anything is sent', () => {
    expect(storageBody(' sh020/a.mov ', '1001', '1002', '')).toEqual({ path: 'sh020/a.mov' });
    expect(storageBody('a.%04d.exr', '1001', '1002', 'ACEScg')).toEqual({ path: 'a.%04d.exr', first_frame: 1001, last_frame: 1002, color_space: 'ACEScg' });
    expect(storageBody('', '', '', '')).toEqual({ message: 'Name the render, relative to the project’s review folder.' });
    expect(storageBody('a.%04d.exr', '', '1002', '')).toEqual({ message: 'A frame pattern needs its first and last frame.' });
    expect(storageBody('a.%04d.exr', '1002', '1001', '')).toEqual({ message: 'The range runs from the first frame up to the last, from 0.' });
  });
});

describe('a copy read by path (C-RP-48, C-RP-49)', () => {
  it('says it was read from studio storage, and remakes from the render while it is in the folder', async () => {
    const media = copy(fromPath);
    expect([media.source, canRemake(media), framesText(media)]).toEqual(['storage_path', true, null]);
    const { calls } = mockFetch((c) => (c.method === 'POST' ? { status: 202, body: media } : { status: 200, body: fromPath }));
    mount(<ReviewMoviePanel version={fromPath} />);
    expect(within(panel()).getByText(/read from studio storage\./).textContent).toContain(media.source_name);
    expect(within(panel()).queryByRole('link')).toBeNull();
    expect(within(panel()).getByLabelText('Review copy').textContent).toContain("Read from the project's review folder on studio storage");
    const remake = within(panel()).getByRole('button', { name: 'Remake' });
    expect(remake.getAttribute('title')).toContain("render in the project's review folder");
    fireEvent.click(remake);
    await waitFor(() => expect(calls.map((c) => `${c.method} ${path(c)}`)).toContain(`POST /api/v1/review-media/${media.id}/remake/`));
  });

  it('once the folder moves there is no Remake, and the panel says why', () => {
    const media = copy(moved);
    expect([media.storage_readable, canRemake(media)]).toEqual([false, false]);
    expect(storageText(media)).toBe("Its render is no longer in the project's review folder, or the server no longer reads its storage root");
    mockFetch(() => ({ status: 200, body: moved }));
    mount(<ReviewMoviePanel version={moved} />);
    expect(within(panel()).queryByRole('button', { name: 'Remake' })).toBeNull();
    expect(within(panel()).queryByText(/Frames (kept|no longer)/)).toBeNull();
  });

  it('a render the worker could not read fails with the server’s sentence and can be retried', () => {
    mockFetch(() => ({ status: 200, body: failed }));
    mount(<ReviewMoviePanel version={failed} />);
    const alert = within(panel()).getByRole('alert');
    expect(alert.textContent).toContain("The render could not be read from the project's review folder on studio storage.");
    expect(within(alert).getByRole('button', { name: 'Retry' })).toBeTruthy();
  });
});

describe('the form (C-RP-48)', () => {
  it('shows the folder to whoever may change the project, fills the range from the version, and sends the path as typed', async () => {
    const { calls } = mockFetch((c) => {
      if (c.method === 'POST') return captured('from_storage_sequence_202');
      if (path(c) === `/api/v1/projects/${ids.project}/`) return captured('project_as_producer');
      return { status: 200, body: fresh };
    });
    mount(<ReviewMoviePanel version={fresh} />);
    await new Promise((resolve) => setTimeout(resolve, 50)); // time enough for a query that would run on mount
    expect(calls.some((c) => path(c) === `/api/v1/projects/${ids.project}/`)).toBe(false);
    fireEvent.click(within(panel()).getByRole('button', { name: 'From studio storage' }));
    const form = await screen.findByRole('region', { name: 'Render on studio storage' });
    expect((await within(form).findByTestId('review-folder')).textContent).toBe('STUDIO:shows/rpf/renders/');
    expect(within(form).queryByLabelText('First frame')).toBeNull(); // a movie takes no range
    fireEvent.change(within(form).getByLabelText('Path'), { target: { value: 'sh010/comp/v003/rpf_sh010_comp_v003.%04d.exr' } });
    expect((within(form).getByLabelText('First frame') as HTMLInputElement).value).toBe(String(fresh.start_frame));
    expect((within(form).getByLabelText('Last frame') as HTMLInputElement).value).toBe(String(fresh.end_frame));
    fireEvent.click(within(form).getByRole('button', { name: 'Make the copy' }));
    await waitFor(() => expect(calls.some((c) => c.method === 'POST')).toBe(true));
    const post = calls.find((c) => c.method === 'POST');
    expect(path(post as MockCall)).toBe(`/api/v1/versions/${fresh.id}/review-media/from-storage/`);
    expect(post?.body).toEqual({ path: 'sh010/comp/v003/rpf_sh010_comp_v003.%04d.exr', first_frame: 1001, last_frame: 1002 });
    await waitFor(() => expect(screen.queryByRole('region', { name: 'Render on studio storage' })).toBeNull());
  });

  it('the version’s artist makes the copy without reading the project, and sees the server’s refusal', async () => {
    const own = { ...fresh, artist_id: artist.id } as Version;
    const { calls } = mockFetch((c) => (c.method === 'POST' ? captured('from_storage_leaves_folder_400') : { status: 200, body: own }));
    mount(<ReviewMoviePanel version={own} />, artist);
    fireEvent.click(within(panel()).getByRole('button', { name: 'From studio storage' }));
    const form = await screen.findByRole('region', { name: 'Render on studio storage' });
    expect(within(form).queryByTestId('review-folder')).toBeNull();
    expect(form.textContent).toContain("relative to the project's review folder");
    fireEvent.change(within(form).getByLabelText('Path'), { target: { value: '../other/x.mov' } });
    fireEvent.click(within(form).getByRole('button', { name: 'Make the copy' }));
    const refused = (flow.from_storage_leaves_folder_400.body as { path: string[] }).path[0];
    expect((await within(panel()).findByText(refused)).getAttribute('role')).toBe('alert');
    expect(calls.some((c) => path(c).startsWith('/api/v1/projects/'))).toBe(false);
  });

  it('a pattern without its range is refused here, and nothing is sent', async () => {
    const { calls } = mockFetch(() => ({ status: 200, body: fresh }));
    mount(<ReviewMoviePanel version={{ ...fresh, start_frame: null, end_frame: null }} />);
    fireEvent.click(within(panel()).getByRole('button', { name: 'From studio storage' }));
    const form = await screen.findByRole('region', { name: 'Render on studio storage' });
    fireEvent.change(within(form).getByLabelText('Path'), { target: { value: 'a.%04d.exr' } });
    fireEvent.click(within(form).getByRole('button', { name: 'Make the copy' }));
    expect(within(form).getByRole('alert').textContent).toBe('A frame pattern needs its first and last frame.');
    expect(calls.some((c) => c.method === 'POST')).toBe(false);
  });

  it('a project without a folder says so to whoever may set it', async () => {
    mockFetch((c) => (path(c) === `/api/v1/projects/${ids.project}/` ? captured('folder_cleared_200') : { status: 200, body: fresh }));
    mount(<ReviewMoviePanel version={fresh} />);
    fireEvent.click(within(panel()).getByRole('button', { name: 'From studio storage' }));
    const form = await screen.findByRole('region', { name: 'Render on studio storage' });
    expect((await within(form).findByText(/This project has no review folder/)).textContent).toContain("Set one on the project's edit page.");
  });

  it('someone who cannot manage the copy has no form', () => {
    const reader = { ...artist, permissions: ['project.view', 'version.view'] } as User;
    mockFetch(() => ({ status: 200, body: fresh }));
    mount(<ReviewMoviePanel version={fresh} />, reader);
    expect(within(panel()).queryByRole('button', { name: 'From studio storage' })).toBeNull();
  });
});

describe('the project’s copies (C-RP-49)', () => {
  it('the sentences name the review folder', () => {
    const listed = flow.copies_switch_on.body as ReviewCopies;
    const sequence = listed.differing.find((d) => d.kind === 'sequence' && d.source === 'storage_path');
    expect(differingText(sequence as ReviewCopies['differing'][number])).toBe("burn-ins differ · can be remade from the project's review folder");
    expect(sequencesText(listed)).toContain("1 can be remade from the project's review folder.");
    const after = flow.copies_after_move.body as ReviewCopies;
    const gone = after.differing.find((d) => d.kind === 'sequence') as ReviewCopies['differing'][number];
    expect(differingText(gone)).toBe("burn-ins differ · its render is no longer in the project's review folder");
    expect(sequencesText(after)).toContain("1 can no longer read its render from the project's review folder");
    expect(remadeText(flow.remake_after_move_200.body as ReviewCopiesRemade)).toContain('left: their files on studio storage can no longer be read.');
  });
});

describe('the project form (C-RP-47)', () => {
  const project = flow.project_as_producer.body as { id: string };
  const editRoutes = (
    <Routes>
      <Route path="/projects/:id/edit" element={<DirectoryFormPage config={projectsFormConfig} />} />
      <Route path="/projects/:id" element={<div>opened</div>} />
    </Routes>
  );

  it('an edit shows the folder as stored and sends only the change', async () => {
    const { calls } = mockFetch((c) => (c.method === 'PATCH' ? captured('folder_moved_200') : captured('project_as_producer')));
    mount(editRoutes, admin, `/projects/${project.id}/edit`);
    const folder = (await screen.findByLabelText(/^Review folder: folder on the root/)) as HTMLInputElement;
    await waitFor(() => expect(folder.value).toBe('shows/rpf/renders'));
    expect((screen.getByLabelText(/^Review folder: storage root/) as HTMLInputElement).value).toBe('STUDIO');
    fireEvent.change(folder, { target: { value: 'shows/rpf/renders_v2' } });
    fireEvent.click(screen.getByRole('button', { name: /save changes/i }));
    expect(await screen.findByText('opened')).toBeTruthy();
    expect(calls.find((c) => c.method === 'PATCH')?.body).toEqual({ review_source_folder: 'shows/rpf/renders_v2' });
  });

  it('a refused folder shows its sentence under the field', async () => {
    mockFetch((c) => (c.method === 'PATCH' ? captured('folder_unsafe_400') : captured('project_as_producer')));
    mount(editRoutes, admin, `/projects/${project.id}/edit`);
    const folder = (await screen.findByLabelText(/^Review folder: folder on the root/)) as HTMLInputElement;
    await waitFor(() => expect(folder.value).toBe('shows/rpf/renders'));
    fireEvent.change(folder, { target: { value: 'shows/../x' } });
    fireEvent.click(screen.getByRole('button', { name: /save changes/i }));
    const sentence = (flow.folder_unsafe_400.body as { review_source_folder: string[] }).review_source_folder[0];
    expect(await screen.findByText(sentence)).toBeTruthy();
  });

  it('a new project has no folder fields and never sends them, even named in the address', async () => {
    const { calls } = mockFetch((c) => (c.method === 'POST' ? { status: 201, body: flow.project_as_producer.body } : { status: 200, body: { count: 0, next: null, previous: null, results: [] } }));
    mount(
      <Routes>
        <Route path="/projects/new" element={<DirectoryFormPage config={projectsFormConfig} />} />
        <Route path="/projects/:id" element={<div>opened</div>} />
      </Routes>,
      admin,
      '/projects/new?review_source_root=STUDIO&review_source_folder=shows/x',
    );
    expect(screen.queryByLabelText(/^Review folder/)).toBeNull();
    fireEvent.change(screen.getByLabelText(/^Name/), { target: { value: 'Gamma' } });
    fireEvent.change(screen.getByLabelText(/^Code/), { target: { value: 'GAMMA' } });
    fireEvent.click(screen.getByRole('button', { name: /create project/i }));
    await waitFor(() => expect(calls.some((c) => c.method === 'POST')).toBe(true));
    const body = calls.find((c) => c.method === 'POST')?.body as Record<string, unknown>;
    expect(body).toMatchObject({ name: 'Gamma', code: 'GAMMA' });
    expect(body).not.toHaveProperty('review_source_root');
    expect(body).not.toHaveProperty('review_source_folder');
  });
});
