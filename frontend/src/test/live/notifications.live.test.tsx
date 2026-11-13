import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import type React from 'react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { notificationsApi } from '@/api/notifications/notifications';
import { projectScopedApi, projectsApi, sequencesApi } from '@/api/production/structure';
import { shotsApi, tasksApi } from '@/api/production/work';
import { AuthProvider } from '@/core/auth/AuthProvider';
import { tokenStorage } from '@/core/auth/tokenStorage';
import { authService } from '@/modules/auth/services/AuthService';
import { NotificationBell, NotificationsPage } from '@/modules/notifications';
import { freshTotp, live } from './liveBackend';

/**
 * Review-pipeline RP-10 (WP 10.6): in-app notifications (RP-6) against a REAL backend. The manager assigns the artist a
 * task, writes a note that mentions them and moves the task; the artist's bell counts the three, a row opens its record
 * and marks itself read, and the Notifications page marks the rest read. The manager, who acted, is told nothing.
 */
const uid = `${Date.now().toString(36)}`.toUpperCase();
const fixture = {} as { project: string; task: string; taskCode: string; subject: string; managerBefore: number };

const Where: React.FC = () => {
  const location = useLocation();
  return <output aria-label="Location">{location.pathname}</output>;
};
const tree = (ui: React.ReactElement) => (
  <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
    <MemoryRouter initialEntries={['/']}>
      <AuthProvider>
        {ui}
        <Routes>
          <Route path="*" element={<Where />} />
        </Routes>
      </AuthProvider>
    </MemoryRouter>
  </QueryClientProvider>
);
const count = async () => (await notificationsApi.unreadCount()).count;

beforeEach(() => localStorage.clear());
afterEach(() => cleanup());
afterAll(() => tokenStorage.clearTokens());

beforeAll(async () => {
  const outcome = await authService.login(live.users.manager);
  if (outcome.status !== 'mfa_required') throw new Error('expected an MFA challenge for the manager');
  await authService.completeMfaLogin({ challenge: outcome.challenge, code: await freshTotp(live.manager.secret) });
  const managerBefore = await count();
  const project = await projectsApi.create({ code: `N${uid}`, name: 'Live notifications', workflow_type: 'standard' });
  const artist = await projectScopedApi.addMember(project.id, { email: live.users.artist.email, role: 'Artist' });
  await projectScopedApi.addMember(project.id, { email: live.users.lead.email, role: 'Lead' });
  const sequence = await sequencesApi.create({ project: project.id, code: `${project.code}_SQ`, name: 'Sequence' });
  const shot = await shotsApi.create({ project: project.id, code: `${project.code}_SH`, sequence_id: sequence.id, name: 'Notified shot' });
  // 1: an assignment
  const task = await tasksApi.create({ project: project.id, code: `${project.code}_T`, title: 'Comp', entity_type: 'Shot', entity_id: shot.id, assignee: artist.user_id });
  // 2: a note on the shot that mentions the artist
  const subject = `Edge flicker ${uid}`;
  await projectScopedApi.addNote(project.id, { subject, body: 'Frames 1010 to 1020', entity_type: 'Shot', entity_id: shot.id, mention_ids: [artist.user_id] });
  // 3: the artist's task moved
  await tasksApi.update(task.id, { status: 'In Progress' });
  expect(await count()).toBe(managerBefore); // whoever acted is never told
  Object.assign(fixture, { project: project.id, task: task.id, taskCode: task.code, subject, managerBefore });
  tokenStorage.clearTokens();
  const signed = await authService.login(live.users.artist);
  if (signed.status === 'mfa_required') throw new Error('the artist unexpectedly needs MFA');
}, 120000);

describe('notifications against a live backend', () => {
  it('the bell counts the assignment, the mention and the status change; a row opens its task and marks itself read', async () => {
    // The fan-out runs after each action has committed: the rows are there before the artist looks.
    // Other live files of the same run may have told the artist about their own projects: count this project's rows.
    const ours = (await notificationsApi.list({ page: 1, page_size: 25, project_id: fixture.project })).results;
    expect(ours.map((n) => n.kind).sort()).toEqual(['note_mention', 'task_assigned', 'task_status']);
    expect(ours.every((n) => n.read_at === null && n.actor?.name === live.users.manager.email)).toBe(true);
    const total = await count();
    render(tree(<NotificationBell />));
    fireEvent.click(await screen.findByRole('button', { name: `Notifications, ${total} unread` }, { timeout: 20000 }));
    const panel = await screen.findByRole('dialog', { name: 'Notifications' });
    await within(panel).findByText(new RegExp(`assigned you ${fixture.taskCode}$`));
    within(panel).getByText(new RegExp(`mentioned you in “${fixture.subject}”$`));
    within(panel).getByText(new RegExp(`moved your task ${fixture.taskCode} Not Started → In Progress$`));

    const row = within(panel)
      .getAllByRole('button')
      .find((b) => b.getAttribute('data-unread') && (b.textContent ?? '').includes(`assigned you ${fixture.taskCode}`)) as HTMLElement; // the row also shows the project and the time
    fireEvent.click(row);
    await waitFor(() => expect(screen.getByLabelText('Location').textContent).toBe(`/tasks/${fixture.task}`));
    await waitFor(async () => expect(await count()).toBe(total - 1));
  }, 60000);

  it('the Notifications page marks every row read', async () => {
    render(tree(<NotificationsPage />));
    await screen.findAllByText(new RegExp(`mentioned you in “${fixture.subject}”$`), {}, { timeout: 20000 });
    await waitFor(() => expect((screen.getByRole('button', { name: 'Mark all read' }) as HTMLButtonElement).disabled).toBe(false));
    fireEvent.click(screen.getByRole('button', { name: 'Mark all read' }));
    await waitFor(async () => expect(await count()).toBe(0), { timeout: 15000 });
    const listed = await notificationsApi.list({ page: 1, page_size: 25, project_id: fixture.project });
    expect(listed.count).toBe(3);
    expect(listed.results.filter((n) => n.read_at === null)).toHaveLength(0);
  }, 60000);
});
