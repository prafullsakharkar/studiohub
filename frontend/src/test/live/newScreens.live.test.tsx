import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import type React from 'react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { reviewsApi, versionsApi, workflowsApi } from '@/api/production/review';
import type { Review, Version } from '@/api/production/review';
import { projectScopedApi, projectsApi, sequencesApi } from '@/api/production/structure';
import { shotsApi, tasksApi } from '@/api/production/work';
import { publishApi } from '@/api/publishing/publishing';
import type { Publish } from '@/api/publishing/publishing';
import { bookingsApi, resourcesApi } from '@/api/scheduling/scheduling';
import { AuthProvider } from '@/core/auth/AuthProvider';
import { tokenStorage } from '@/core/auth/tokenStorage';
import { authService } from '@/modules/auth/services/AuthService';
import { PublishingPage, PublishWorkspacePage } from '@/modules/publishing';
import { ReviewWorkspacePage } from '@/modules/reviews';
import { SchedulingAssignmentsPage, SchedulingUtilizationPage } from '@/modules/scheduling';
import { VersionsListPage, VersionWorkspacePage } from '@/modules/versions';
import { WorkflowWorkspacePage } from '@/modules/workflows';
import { freshTotp, live } from './liveBackend';

/**
 * The screens added in phases 29 to 33 against a REAL backend: the version cards, a version's Media and Compare tabs, the
 * review's overview, its viewer with the A/B compare and the Versions tab button that opens it, and the workflow board
 * saved through the API. The page reads what the server sent (the same `video_url`, ids and codes), which is what these
 * checks are for; a browser would play the videos, jsdom cannot. Run on a fresh live_backend.py seed; the manager
 * signs in once and builds the project.
 */
const uid = `${Date.now().toString(36)}`.toUpperCase();
const fixture = {} as { project: string; shot: string; v1: Version; v2: Version; review: Review; workflow: string; jobs: Publish[]; resource: { id: string; name: string }; free: { id: string; name: string } };

const tree = (ui: React.ReactElement, initial: string) => (
  <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
    <MemoryRouter initialEntries={[initial]}>
      <AuthProvider>{ui}</AuthProvider>
    </MemoryRouter>
  </QueryClientProvider>
);
const pages = (
  <Routes>
    <Route path="/versions" element={<VersionsListPage />} />
    <Route path="/versions/:versionId" element={<VersionWorkspacePage />} />
    <Route path="/reviews/:reviewId" element={<ReviewWorkspacePage />} />
    <Route path="/workflows/:workflowId" element={<WorkflowWorkspacePage />} />
    <Route path="/publishing" element={<PublishingPage />} />
    <Route path="/publishing/:publishId" element={<PublishWorkspacePage />} />
    <Route path="/scheduling/utilization" element={<SchedulingUtilizationPage />} />
    <Route path="/scheduling/assignments" element={<SchedulingAssignmentsPage />} />
  </Routes>
);
const tab = async (name: string) => fireEvent.click(await screen.findByRole('tab', { name }, { timeout: 20000 }));
const wait = { timeout: 20000 };

const boardNodes = [
  { id: 'a', type: 'start', title: 'Assigned', position: { x: 60, y: 120 } },
  { id: 'b', type: 'condition', title: 'Approved?', position: { x: 400, y: 120 } },
  { id: 'c', type: 'end', title: 'Done', position: { x: 740, y: 120 } },
  { id: 'd', type: 'task', title: 'Retake', position: { x: 740, y: 320 } },
];
const boardEdges = [
  { id: 'e1', source_node_id: 'a', target_node_id: 'b', source_port: 'out', label: '' },
  { id: 'e2', source_node_id: 'b', target_node_id: 'c', source_port: 'true', label: 'Yes' },
  { id: 'e3', source_node_id: 'b', target_node_id: 'd', source_port: 'false', label: 'No' },
];

beforeEach(() => localStorage.clear());
afterEach(() => cleanup());
afterAll(() => tokenStorage.clearTokens());

beforeAll(async () => {
  const outcome = await authService.login(live.users.manager);
  if (outcome.status !== 'mfa_required') throw new Error('expected an MFA challenge for the manager');
  await authService.completeMfaLogin({ challenge: outcome.challenge, code: await freshTotp(live.manager.secret) });
  const project = await projectsApi.create({ code: `N${uid}`, name: 'New screens', workflow_type: 'standard' });
  await projectScopedApi.addMember(project.id, { email: live.users.lead.email, role: 'Lead' }); // reads the workflow, may not change it
  const sequence = await sequencesApi.create({ project: project.id, code: `${project.code}_SQ`, name: 'Sequence' });
  const shot = await shotsApi.create({ project: project.id, code: `${project.code}_SH`, sequence_id: sequence.id, name: 'Screen shot' });
  const task = await tasksApi.create({ project: project.id, code: `${project.code}_T1`, title: 'Comp', entity_type: 'Shot', entity_id: shot.id });
  const make = (n: number) =>
    versionsApi.create({
      project: project.id,
      shot: shot.id,
      task: task.id,
      department: 'Compositing',
      notes: `pass ${n}`,
      fps: 24,
      start_frame: 1001,
      end_frame: 1072,
      video_url: `https://cdn.example.com/p/${project.code}_v${n}.mp4`,
      thumbnail_url: `https://cdn.example.com/p/${project.code}_v${n}.jpg`,
    });
  const v1 = await make(1);
  const v2 = await make(2);
  const review = await reviewsApi.create({ project: project.id, title: `Compare ${uid}`, code: `RV${uid}`, entity_type: 'Shot', entity_id: shot.id });
  await reviewsApi.addVersion(review.id, v1.id);
  await reviewsApi.addVersion(review.id, v2.id);
  const workflow = await workflowsApi.create({ project: project.id, name: `Board ${uid}`, code: `WB${uid}`, nodes: boardNodes, transitions: boardEdges });
  // two export jobs of the delivery project's first published version (the same shot), and a resource with 8 of its 40 weekly hours booked today
  const first = live.dlv.versions[0];
  const jobs = [];
  for (const n of [1, 2]) jobs.push(await publishApi.create({ name: `Screens export ${n} ${uid}`, project_id: live.dlv.project, version_id: first.id, dcc_tool: 'Nuke', dcc_version: '15.0' }));
  const resource = await resourcesApi.create({ name: `Utilization node ${uid}`, code: `UN${uid}`, resource_type: 'Equipment', capacity_hours_per_week: 40 });
  const today = new Date().toISOString().slice(0, 10);
  await bookingsApi.create({ resource: resource.id, start_time: `${today}T12:00:00Z`, end_time: `${today}T20:00:00Z`, status: 'Booked' });
  // the same hours as free time (what a booking made without a status is): they must not count as used
  const free = await resourcesApi.create({ name: `Free node ${uid}`, code: `FN${uid}`, resource_type: 'Equipment', capacity_hours_per_week: 40 });
  await bookingsApi.create({ resource: free.id, start_time: `${today}T12:00:00Z`, end_time: `${today}T20:00:00Z`, status: 'Available' });
  Object.assign(fixture, { project: project.id, shot: shot.id, v1, v2, review: await reviewsApi.get(review.id), workflow: workflow.id, jobs, resource: { id: resource.id, name: resource.name }, free: { id: free.id, name: free.name } });
}, 120000);

describe('versions as cards', () => {
  it('the list switches to cards, one per version the server returned, with its code, number and thumbnail', async () => {
    render(tree(pages, '/versions'));
    fireEvent.click(await screen.findByRole('button', { name: 'Card view' }, wait));
    for (const v of [fixture.v1, fixture.v2]) {
      expect(await screen.findByRole('link', { name: v.code }, wait)).toBeTruthy();
      const thumbnail = (await screen.findByAltText(`${v.code} thumbnail`, {}, wait)) as HTMLImageElement;
      expect(thumbnail.getAttribute('src')).toBe(v.thumbnail_url);
    }
    expect(screen.queryByRole('table')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Table view' }));
    expect(await screen.findByRole('table', {}, wait)).toBeTruthy();
  });
});

describe('a version’s Media and Compare tabs', () => {
  it('Media plays the preview the server linked, from the version’s own first frame', async () => {
    render(tree(pages, `/versions/${fixture.v2.id}`));
    await tab('Media');
    const video = (await screen.findByLabelText(`${fixture.v2.code} preview video`, {}, wait)) as HTMLVideoElement;
    expect(video.getAttribute('src')).toBe(fixture.v2.video_url);
    expect(screen.getByLabelText('Current frame').textContent).toBe('1001');
  });

  it('Compare puts this version (A) against the other of the same shot (B), both read from the server, and either can be switched', async () => {
    render(tree(pages, `/versions/${fixture.v2.id}`));
    await tab('Compare');
    const group = await screen.findByRole('group', { name: `${fixture.v2.code} against ${fixture.v1.code}` }, wait);
    expect(group).toBeTruthy();
    expect(screen.getByLabelText(`${fixture.v2.code} video`).getAttribute('src')).toBe(fixture.v2.video_url);
    expect(screen.getByLabelText(`${fixture.v1.code} video`).getAttribute('src')).toBe(fixture.v1.video_url);
    expect(screen.getByRole('slider', { name: 'Wipe position' })).toBeTruthy(); // the wipe is the first mode
    const a = screen.getByLabelText('Version A') as HTMLSelectElement;
    expect([...a.options].map((o) => o.value).sort()).toEqual([fixture.v1.id, fixture.v2.id].sort());
    expect(a.value).toBe(fixture.v2.id);
    fireEvent.click(screen.getByRole('button', { name: 'Swap A and B' }));
    expect(screen.getByText(`A: ${fixture.v1.code}`)).toBeTruthy();
    expect((screen.getByLabelText('Version A') as HTMLSelectElement).value).toBe(fixture.v1.id);
    expect((screen.getByLabelText('Version B') as HTMLSelectElement).value).toBe(fixture.v2.id);
  });
});

describe('a review', () => {
  it('the overview counts what the server holds and lists both versions', async () => {
    render(tree(pages, `/reviews/${fixture.review.id}`));
    const versions = await screen.findByRole('list', { name: 'Versions' }, wait);
    expect(within(versions).getAllByRole('listitem')).toHaveLength(2);
    expect(within(versions).getByText(new RegExp(fixture.v1.code))).toBeTruthy();
    expect(within(versions).getByText(new RegExp(fixture.v2.code))).toBeTruthy();
    expect(screen.getByLabelText('Review details').textContent).toContain(fixture.review.code);
    expect(screen.getByLabelText('Review counts')).toBeTruthy();
  });

  it('the viewer loads the first version, compares it with the second as an A/B wipe or side by side, and goes back to the player', async () => {
    render(tree(pages, `/reviews/${fixture.review.id}`));
    await tab('Media viewer');
    const video = (await screen.findByLabelText(/in review video$/, {}, wait)) as HTMLVideoElement;
    expect(video.getAttribute('src')).toBe(fixture.v1.video_url);

    const compare = await screen.findByRole('group', { name: 'Compare versions' }, wait);
    fireEvent.click(within(compare).getByRole('button', { name: 'A/B Wipe' }));
    expect(await screen.findByRole('group', { name: `${fixture.v1.code} against ${fixture.v2.code}` }, wait)).toBeTruthy();
    expect(screen.getByLabelText(`${fixture.v2.code} video`).getAttribute('src')).toBe(fixture.v2.video_url);
    expect(screen.getByRole('slider', { name: 'Wipe position' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Draw on this frame' })).toBeNull();

    fireEvent.click(within(compare).getByRole('button', { name: 'Side-by-Side' }));
    expect((await screen.findAllByRole('figure', {}, wait)).length).toBe(2);
    fireEvent.click(within(compare).getByRole('button', { name: 'Side-by-Side' }));
    expect(await screen.findByLabelText(/in review video$/, {}, wait)).toBeTruthy();
  });

  it('the Versions tab’s “Compare in A/B Wipe” opens the viewer on that version against the first', async () => {
    render(tree(pages, `/reviews/${fixture.review.id}`));
    await tab('Versions');
    expect(screen.queryByRole('button', { name: `Compare ${fixture.v1.code} in A/B Wipe` })).toBeNull(); // the first is the one shown
    fireEvent.click(await screen.findByRole('button', { name: `Compare ${fixture.v2.code} in A/B Wipe` }, wait));
    expect(await screen.findByRole('group', { name: `${fixture.v1.code} against ${fixture.v2.code}` }, wait)).toBeTruthy();
    expect(screen.getByRole('tab', { name: 'Media viewer' }).getAttribute('aria-selected')).toBe('true');
  });
});

describe('publishing', () => {
  it('the job summary counts the jobs the server counts, with every status in one of its tiles', async () => {
    render(tree(pages, '/publishing'));
    const summary = await screen.findByRole('list', { name: 'Job summary' }, wait).catch(() => screen.findByLabelText('Job summary', {}, wait));
    const total = (await publishApi.list({ page_size: 1 })).count;
    expect(total).toBeGreaterThanOrEqual(2);
    const tile = (label: string) => (within(summary as HTMLElement).getByText(label).parentElement as HTMLElement).querySelector('dd')?.textContent;
    expect(tile('Jobs')).toBe(String(total)); // the per-status counts add up to all the jobs: no status the page does not know
    expect(Number(tile('Running'))).toBeGreaterThanOrEqual(2); // both new jobs are Pending
  });

  it('a job’s History lists the export jobs of the same shot, newest first, and marks this one', async () => {
    const [one, two] = fixture.jobs;
    render(tree(pages, `/publishing/${two.id}`));
    await tab('History');
    const named = await screen.findByRole('list', { name: /^Jobs for / }, wait);
    const rows = within(named).getAllByRole('listitem');
    expect(rows.length).toBeGreaterThanOrEqual(2);
    expect(rows[0].textContent).toContain(two.code); // the newest first
    expect(rows.find((r) => r.getAttribute('aria-current') === 'true')?.textContent).toContain(two.code);
    expect(within(named).getByRole('link', { name: new RegExp(one.code) }).getAttribute('href')).toBe(`/publishing/${one.id}`);
  });
});

describe('scheduling', () => {
  it('Utilization shows the resource’s booked hours against its weekly capacity, from the bookings the server holds', async () => {
    render(tree(pages, '/scheduling/utilization'));
    const meter = await screen.findByRole('meter', { name: `${fixture.resource.name} utilization` }, wait);
    expect(meter.getAttribute('aria-valuenow')).toBe('20'); // 8 of 40 hours
    const row = meter.closest('li') as HTMLElement;
    expect(row.textContent).toContain('20%');
    expect(within(screen.getByLabelText('Summary')).getByText('Average')).toBeTruthy();
    // free time is not use: the same hours as an Available slot count for nothing
    expect((await screen.findByRole('meter', { name: `${fixture.free.name} utilization` }, wait)).getAttribute('aria-valuenow')).toBe('0');
  });

  it('Assignments lists the booking under its resource', async () => {
    render(tree(pages, '/scheduling/assignments'));
    const list = await screen.findByRole('list', { name: `Bookings of ${fixture.resource.name}` }, wait);
    expect(within(list).getAllByRole('listitem')).toHaveLength(1);
    expect(list.textContent).toMatch(/8\s?h/);
  });
});

describe('the workflow board', () => {
  it('draws the stored nodes, and an added node is saved through the API with the transitions and positions kept', async () => {
    render(tree(pages, `/workflows/${fixture.workflow}`));
    for (const title of ['Assigned', 'Approved?', 'Done', 'Retake']) expect(await screen.findByRole('group', { name: `Node ${title}` }, wait)).toBeTruthy();
    expect(screen.getByRole('img', { name: 'Transitions' })).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Edit board' }));
    fireEvent.change(screen.getByLabelText('Add node'), { target: { value: 'review' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save board' }));
    await waitFor(async () => expect((await workflowsApi.get(fixture.workflow)).nodes).toHaveLength(5), wait);

    const saved = await workflowsApi.get(fixture.workflow);
    expect(saved.transitions).toHaveLength(3);
    expect(saved.nodes.find((n) => n.id === 'b')).toMatchObject({ title: 'Approved?', type: 'condition', position: { x: 400, y: 120 } });
    expect(saved.nodes.filter((n) => n.type === 'review')).toHaveLength(1);

    // a page opened afterwards draws the saved graph: five nodes
    cleanup();
    render(tree(pages, `/workflows/${fixture.workflow}`));
    await screen.findByRole('group', { name: 'Node Assigned' }, wait);
    expect(screen.getAllByRole('group', { name: /^Node / })).toHaveLength(5);
  });

  it('a lead (workflow.view, not update) sees the board and no way to edit it', async () => {
    tokenStorage.clearTokens();
    const outcome = await authService.login(live.users.lead);
    if (outcome.status === 'mfa_required') throw new Error('lead unexpectedly needs MFA');
    render(tree(pages, `/workflows/${fixture.workflow}`));
    await screen.findByRole('group', { name: 'Node Assigned' }, wait);
    expect(screen.getAllByRole('group', { name: /^Node / })).toHaveLength(5);
    expect(screen.queryByRole('button', { name: 'Edit board' })).toBeNull();
  });
});
