import fs from 'node:fs';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import type React from 'react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { reviewCopiesApi, reviewMediaApi, versionsApi } from '@/api/production/review';
import { projectsApi, sequencesApi } from '@/api/production/structure';
import type { Project } from '@/api/production/structure';
import { shotsApi } from '@/api/production/work';
import { AuthProvider } from '@/core/auth/AuthProvider';
import { tokenStorage } from '@/core/auth/tokenStorage';
import { authService } from '@/modules/auth/services/AuthService';
import { DirectoryFormPage } from '@/modules/directory/DirectoryFormPage';
import { ReviewCopiesNotice } from '@/modules/production/review/ReviewCopiesNotice';
import { projectsFormConfig } from '@/modules/production/structure/configs';
import { VersionWorkspacePage } from '@/modules/versions';
import { ProtectedRoute } from '@/routes/ProtectedRoute';
import { freshTotp, live } from './liveBackend';

/**
 * Review-pipeline RP-15 (WP 15.6) against a REAL backend started with SYNC_LIVE_MEDIA=1 (the harness processes queued
 * rows with the host's ffmpeg and the built-in ACES 2.0 OpenColorIO config). EXR frames uploaded to a new project (ACEScg)
 * come out through the ACES 2.0 view and the version page says so; the project form offers the config's views; another
 * view makes the project's notice count the sequence copy made with the old one; frames uploaded again use the new view
 * and the notice goes (C-RP-39, C-RP-40, Q-RP-72). Skipped without SYNC_LIVE_MEDIA.
 */
const uid = `${Date.now().toString(36)}`.toUpperCase();
const fixture = {} as { project: Project; version: string };
const SDR = 'ACES 2.0 - SDR 100 nits (Rec.709)';

const tree = (ui: React.ReactElement, initial = '/') => (
  <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
    <MemoryRouter initialEntries={[initial]}>
      <AuthProvider>{ui}</AuthProvider>
    </MemoryRouter>
  </QueryClientProvider>
);

/** The frames by Node's fetch (jsdom's File loses its bytes in Node's Request; see reviewMedia.live). */
async function sendFrames(mediaId: string) {
  const boundary = `----live-colour-${uid}`;
  const pieces: Buffer[] = [];
  for (let n = 1001; n <= 1008; n += 1) {
    const name = `live_comp.${n}.exr`;
    pieces.push(Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="frames"; filename="${name}"\r\nContent-Type: image/x-exr\r\n\r\n`));
    pieces.push(fs.readFileSync(`${live.media?.sequence}/${name}`), Buffer.from('\r\n'));
  }
  pieces.push(Buffer.from(`--${boundary}--\r\n`));
  const response = await fetch(`${live.url}/api/v1/review-media/${mediaId}/frames/`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${tokenStorage.getAccessToken()}`, 'Content-Type': `multipart/form-data; boundary=${boundary}` },
    body: Buffer.concat(pieces),
  });
  return response.status;
}
async function uploadSequence() {
  const opened = await reviewMediaApi.openSequence(fixture.version, { name: 'live_comp', extension: 'exr', first_frame: 1001, last_frame: 1008 });
  expect(await sendFrames(opened.id)).toBe(200);
  await reviewMediaApi.complete(opened.id);
  await waitFor(async () => expect((await reviewMediaApi.list(fixture.version))[0]?.status).toBe('ready'), { timeout: 90000, interval: 1000 });
  return (await reviewMediaApi.list(fixture.version))[0];
}

beforeEach(() => localStorage.clear());
afterEach(() => cleanup());
afterAll(() => tokenStorage.clearTokens());

describe.skipIf(!live.media)('colour-managed review copies against a live backend (SYNC_LIVE_MEDIA=1)', () => {
  beforeAll(async () => {
    const outcome = await authService.login(live.users.manager);
    if (outcome.status !== 'mfa_required') throw new Error('expected an MFA challenge for the manager');
    await authService.completeMfaLogin({ challenge: outcome.challenge, code: await freshTotp(live.manager.secret) });
    const project = await projectsApi.create({ code: `C${uid}`, name: 'Live colour', workflow_type: 'standard' });
    const sequence = await sequencesApi.create({ project: project.id, code: `${project.code}_SQ`, name: 'Sequence' });
    const shot = await shotsApi.create({ project: project.id, code: `${project.code}_SH`, sequence_id: sequence.id, name: 'Colour shot' });
    const version = await versionsApi.create({ project: project.id, shot: shot.id, department: 'Compositing' });
    Object.assign(fixture, { project: await projectsApi.get(project.id), version: version.id });
  }, 120000);

  it('EXR frames come out through the project’s view, and the version page says how', async () => {
    expect(fixture.project).toMatchObject({ color_space: 'ACEScg', review_view: '', review_look: '' });
    const options = await reviewMediaApi.colourOptions();
    expect(options).toMatchObject({ available: true, display: 'sRGB - Display', default_view: SDR });
    const row = await uploadSequence();
    expect(row.probe).toMatchObject({ colour: 'ocio', colour_skipped: null, ocio: { input: 'ACEScg', view: SDR, look: '' } });

    render(tree(<Routes><Route path="/versions/:versionId" element={<VersionWorkspacePage />} /></Routes>, `/versions/${fixture.version}`));
    fireEvent.click(await screen.findByRole('tab', { name: 'Media' }, { timeout: 20000 }));
    const panel = await screen.findByRole('region', { name: 'Review movie' }, { timeout: 20000 });
    await within(panel).findByText(`ACEScg → sRGB - Display, ${SDR}`, {}, { timeout: 20000 });
    // the upload's colour choice lists the real config's colour spaces
    const choice = (await within(panel).findByLabelText('Colour space of the upload', {}, { timeout: 20000 })) as HTMLSelectElement;
    expect(Array.from(choice.options).some((o) => o.value === 'ACEScct')).toBe(true);
  }, 180000);

  it('the project form picks another view; the notice counts the old copy; frames sent again use the new view', async () => {
    render(
      tree(
        <Routes>
          {/* as in the app: the form opens once the signed-in user is known, so its permission-gated fields are there when it fills */}
          <Route element={<ProtectedRoute />}>
            <Route path="/projects/:id/edit" element={<DirectoryFormPage config={projectsFormConfig} />} />
            <Route path="/projects/:id" element={<div>saved</div>} />
          </Route>
        </Routes>,
        `/projects/${fixture.project.id}/edit`,
      ),
    );
    const view = (await screen.findByLabelText('Review view', {}, { timeout: 20000 })) as HTMLSelectElement;
    await waitFor(() => expect(view.disabled).toBe(false), { timeout: 20000 });
    // the record is in the form before anything is changed (the options can arrive first)
    await waitFor(() => expect((screen.getByLabelText(/^Name/) as HTMLInputElement).value).toBe('Live colour'), { timeout: 20000 });
    expect(view.options[0].textContent).toBe(`Default: ${SDR}`);
    fireEvent.change(view, { target: { value: 'Un-tone-mapped' } });
    fireEvent.click(screen.getByRole('button', { name: /save changes/i }));
    await screen.findByText('saved', {}, { timeout: 20000 });
    const project = await projectsApi.get(fixture.project.id);
    expect(project.review_view).toBe('Un-tone-mapped');
    cleanup();

    expect(await reviewCopiesApi.get(project.id)).toEqual({ review_burn_ins: false, out_of_date: 0, sequences_out_of_date: 1, colour_out_of_date: 1 });
    render(tree(<ReviewCopiesNotice project={project} />));
    const notice = await screen.findByRole('region', { name: 'Review copies' }, { timeout: 20000 });
    expect(notice.textContent).toContain('1 image sequence was made with other settings.');
    expect(within(notice).queryByRole('button', { name: 'Remake them' })).toBeNull();
    cleanup();

    const again = await uploadSequence();
    expect(again.probe?.ocio).toMatchObject({ input: 'ACEScg', view: 'Un-tone-mapped' });
    expect(await reviewCopiesApi.get(project.id)).toEqual({ review_burn_ins: false, out_of_date: 0, sequences_out_of_date: 0, colour_out_of_date: 0 });
  }, 240000);
});
