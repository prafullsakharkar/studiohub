import fs from 'node:fs';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import type React from 'react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { reviewCopiesApi, reviewMediaApi, versionsApi } from '@/api/production/review';
import type { ReviewMedia } from '@/api/production/review';
import { projectsApi, sequencesApi } from '@/api/production/structure';
import type { Project } from '@/api/production/structure';
import { shotsApi } from '@/api/production/work';
import type { GradeImport, ShotGrade } from '@/api/production/work';
import { AuthProvider } from '@/core/auth/AuthProvider';
import { tokenStorage } from '@/core/auth/tokenStorage';
import { authService } from '@/modules/auth/services/AuthService';
import { DirectoryFormPage } from '@/modules/directory/DirectoryFormPage';
import { ReviewCopiesNotice } from '@/modules/production/review/ReviewCopiesNotice';
import { shotsFormConfig } from '@/modules/production/work/shots';
import { ShotWorkspacePage } from '@/modules/shots';
import { VersionWorkspacePage } from '@/modules/versions';
import { ProtectedRoute } from '@/routes/ProtectedRoute';
import { freshTotp, live } from './liveBackend';

/**
 * Review-pipeline RP-20 against a REAL backend started with SYNC_LIVE_MEDIA=1 (the harness processes queued rows with the
 * host's ffmpeg and the built-in ACES 2.0 OpenColorIO config). A project with Apply shot grades on: a grade typed on the
 * shot's edit page is stored; a client's .ccc file names the shot without the project's code, a dry run shows the change
 * and applying writes it with its source; EXR frames come out graded and the version page says from which file; a new
 * grade makes the notice count the copy and Remake them remakes it from its kept frames with the new grade
 * (C-RP-52 to C-RP-54, Q-RP-92 to Q-RP-96). Skipped without SYNC_LIVE_MEDIA.
 */
const uid = `${Date.now().toString(36)}`.toUpperCase();
const fixture = {} as { project: Project; shot: string; version: string };
const WARM: ShotGrade = { slope: [1.1, 1, 0.9], offset: [0.01, 0, -0.01], power: [1, 1, 1.05], saturation: 0.9 };
const COOL: ShotGrade = { slope: [0.9, 1, 1.1], offset: [-0.01, 0, 0.01], power: [1.05, 1, 1], saturation: 1.1 };

const tree = (ui: React.ReactElement, initial = '/') => (
  <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
    <MemoryRouter initialEntries={[initial]}>
      <AuthProvider>{ui}</AuthProvider>
    </MemoryRouter>
  </QueryClientProvider>
);

/** A multipart body by Node's fetch (jsdom's File loses its bytes in Node's Request; see reviewMedia.live). */
async function post(path: string, parts: { name: string; filename?: string; type?: string; data: Buffer | string }[]) {
  const boundary = `----live-grades-${uid}`;
  const pieces: Buffer[] = [];
  for (const part of parts) {
    const file = part.filename ? `; filename="${part.filename}"\r\nContent-Type: ${part.type ?? 'application/octet-stream'}` : '';
    pieces.push(Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="${part.name}"${file}\r\n\r\n`));
    pieces.push(Buffer.isBuffer(part.data) ? part.data : Buffer.from(part.data), Buffer.from('\r\n'));
  }
  pieces.push(Buffer.from(`--${boundary}--\r\n`));
  return fetch(`${live.url}${path}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${tokenStorage.getAccessToken()}`, 'Content-Type': `multipart/form-data; boundary=${boundary}` },
    body: Buffer.concat(pieces),
  });
}
const ccc = (id: string) =>
  `<?xml version="1.0" encoding="UTF-8"?>
<ColorCorrectionCollection xmlns="urn:ASC:CDL:v1.01">
  <ColorCorrection id="${id}">
    <SOPNode><Slope>1.1 1.0 0.9</Slope><Offset>0.01 0.0 -0.01</Offset><Power>1.0 1.0 1.05</Power></SOPNode>
    <SatNode><Saturation>0.9</Saturation></SatNode>
  </ColorCorrection>
  <ColorCorrection id="SH9990"><SOPNode><Slope>1 1 1</Slope><Offset>0 0 0</Offset><Power>1 1 1</Power></SOPNode></ColorCorrection>
</ColorCorrectionCollection>
`;
async function importGrades(dryRun: boolean): Promise<GradeImport> {
  const response = await post(`/api/v1/projects/${fixture.project.id}/grades/import/`, [
    { name: 'file', filename: 'live.ccc', type: 'application/xml', data: ccc('SH0010') },
    { name: 'dry_run', data: String(dryRun) },
  ]);
  expect(response.status).toBe(200);
  return (await response.json()) as GradeImport;
}
async function uploadSequence(): Promise<ReviewMedia> {
  const opened = await reviewMediaApi.openSequence(fixture.version, { name: 'live_comp', extension: 'exr', first_frame: 1001, last_frame: 1008 });
  const frames = [];
  for (let n = 1001; n <= 1008; n += 1) {
    const name = `live_comp.${n}.exr`;
    frames.push({ name: 'frames', filename: name, type: 'image/x-exr', data: fs.readFileSync(`${live.media?.sequence}/${name}`) });
  }
  expect((await post(`/api/v1/review-media/${opened.id}/frames/`, frames)).status).toBe(200);
  await reviewMediaApi.complete(opened.id);
  await waitFor(async () => expect((await reviewMediaApi.list(fixture.version))[0]?.status).toBe('ready'), { timeout: 90000, interval: 1000 });
  return (await reviewMediaApi.list(fixture.version))[0];
}

beforeEach(() => localStorage.clear());
afterEach(() => cleanup());
afterAll(() => tokenStorage.clearTokens());

describe.skipIf(!live.media)('shot grades on review copies against a live backend (SYNC_LIVE_MEDIA=1)', () => {
  beforeAll(async () => {
    const outcome = await authService.login(live.users.manager);
    if (outcome.status !== 'mfa_required') throw new Error('expected an MFA challenge for the manager');
    await authService.completeMfaLogin({ challenge: outcome.challenge, code: await freshTotp(live.manager.secret) });
    const project = await projectsApi.create({ code: `G${uid}`, name: 'Live grades', workflow_type: 'standard', review_grades: true });
    const sequence = await sequencesApi.create({ project: project.id, code: `${project.code}_SQ`, name: 'Sequence' });
    const shot = await shotsApi.create({ project: project.id, code: `${project.code}_SH0010`, sequence_id: sequence.id, name: 'Graded shot' });
    const version = await versionsApi.create({ project: project.id, shot: shot.id, department: 'Compositing' });
    Object.assign(fixture, { project: await projectsApi.get(project.id), shot: shot.id, version: version.id });
  }, 120000);

  it('a grade typed on the shot’s edit page is stored, with no source', async () => {
    expect(fixture.project.review_grades).toBe(true);
    render(
      tree(
        <Routes>
          <Route element={<ProtectedRoute />}>
            <Route path="/shots/:id/edit" element={<DirectoryFormPage config={shotsFormConfig} />} />
            <Route path="/shots/:id" element={<div>saved</div>} />
          </Route>
        </Routes>,
        `/shots/${fixture.shot}/edit`,
      ),
    );
    await waitFor(() => expect((screen.getByLabelText(/^Name/) as HTMLInputElement).value).toBe('Graded shot'), { timeout: 20000 });
    fireEvent.click(await screen.findByRole('button', { name: 'Add grade' }, { timeout: 20000 }));
    fireEvent.change(screen.getByLabelText('Slope B'), { target: { value: '1.2' } });
    fireEvent.change(screen.getByLabelText('Saturation'), { target: { value: '0.8' } });
    fireEvent.click(screen.getByRole('button', { name: /save changes/i }));
    await screen.findByText('saved', {}, { timeout: 20000 });
    expect(await shotsApi.get(fixture.shot)).toMatchObject({ grade: { slope: [1, 1, 1.2], offset: [0, 0, 0], power: [1, 1, 1], saturation: 0.8 }, grade_source: '' });
  }, 120000);

  it('a client’s file matches the shot without the project’s code: a dry run shows it, applying writes it', async () => {
    const dry = await importGrades(true);
    expect(dry).toMatchObject({ dry_run: true, file_name: 'live.ccc', corrections: 2, applied: 0, unmatched: ['SH9990'], invalid: [] });
    expect(dry.matched).toEqual([
      expect.objectContaining({ id: 'SH0010', shot: { id: fixture.shot, code: `${fixture.project.code}_SH0010` }, old: expect.objectContaining({ saturation: 0.8 }), new: WARM }),
    ]);
    expect((await shotsApi.get(fixture.shot)).grade?.saturation).toBe(0.8); // nothing written
    expect(await importGrades(false)).toMatchObject({ dry_run: false, applied: 1 });
    expect(await shotsApi.get(fixture.shot)).toMatchObject({ grade: WARM, grade_source: 'live.ccc (SH0010)' });

    render(tree(<Routes><Route path="/shots/:shotId" element={<ShotWorkspacePage />} /></Routes>, `/shots/${fixture.shot}`));
    await screen.findByText('slope 1.1 1 0.9 · offset 0.01 0 -0.01 · power 1 1 1.05 · sat 0.9 · from live.ccc (SH0010)', {}, { timeout: 20000 });
  }, 120000);

  it('EXR frames come out with the grade, and the version page says from which file', async () => {
    const row = await uploadSequence();
    expect(row.probe).toMatchObject({ colour: 'ocio', grade: WARM, grade_source: 'live.ccc (SH0010)', grade_skipped: null });
    render(tree(<Routes><Route path="/versions/:versionId" element={<VersionWorkspacePage />} /></Routes>, `/versions/${fixture.version}`));
    fireEvent.click(await screen.findByRole('tab', { name: 'Media' }, { timeout: 20000 }));
    const panel = await screen.findByRole('region', { name: 'Review movie' }, { timeout: 20000 });
    await within(panel).findByText(/Graded with the shot's CDL from live\.ccc \(SH0010\)/, {}, { timeout: 20000 });
  }, 180000);

  it('a new grade: the notice counts the copy, Remake them remakes it with the new grade', async () => {
    const before = (await reviewMediaApi.list(fixture.version))[0];
    await shotsApi.update(fixture.shot, { grade: COOL });
    const copies = await reviewCopiesApi.get(fixture.project.id);
    expect(copies).toMatchObject({ review_grades: true, grade_out_of_date: 1, sequences_out_of_date: 1, colour_out_of_date: 0 });
    expect(copies.differing).toEqual([expect.objectContaining({ review_media_id: before.id, kind: 'sequence', remakable: true, why: ['grade'] })]);

    render(tree(<ReviewCopiesNotice project={fixture.project} />));
    const notice = await screen.findByRole('region', { name: 'Review copies' }, { timeout: 20000 });
    fireEvent.click(within(notice).getByRole('button', { name: 'Show which' }));
    expect(within(notice).getByRole('list').textContent).toMatch(/grade differ/);
    // Remake them needs project.update, known once /auth/me has answered
    fireEvent.click(await within(notice).findByRole('button', { name: 'Remake them' }, { timeout: 20000 }));
    await within(notice).findByText('Remaking 1 review copy. Each one replaces its old copy when it is ready.', {}, { timeout: 20000 });
    cleanup();

    await waitFor(
      async () => expect((await reviewMediaApi.list(fixture.version)).find((r) => r.status === 'ready')?.remake_of).toBe(before.id),
      { timeout: 90000, interval: 1000 },
    );
    const remade = (await reviewMediaApi.list(fixture.version)).find((r) => r.status === 'ready');
    expect(remade?.probe).toMatchObject({ grade: COOL, grade_source: '' });
    expect(await reviewCopiesApi.get(fixture.project.id)).toMatchObject({ grade_out_of_date: 0, sequences_out_of_date: 0, differing: [] });
  }, 240000);
});
