import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, render, screen } from '@testing-library/react';
import type React from 'react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { projectsApi, sequencesApi } from '@/api/production/structure';
import type { Project } from '@/api/production/structure';
import { shotsApi } from '@/api/production/work';
import type { GradeImport } from '@/api/production/work';
import { AuthProvider } from '@/core/auth/AuthProvider';
import { tokenStorage } from '@/core/auth/tokenStorage';
import { authService } from '@/modules/auth/services/AuthService';
import { importSummary } from '@/modules/shots/components/GradeImport';
import { ShotWorkspacePage } from '@/modules/shots';
import { freshTotp, live } from './liveBackend';

/**
 * Review-pipeline RP-22 against a REAL backend: a cut's EDL and a dailies ALE are read by Import grades (C-RP-55,
 * Q-RP-101 to Q-RP-104). The EDL's locator names a shot without the project's code, a camera clip name matches nothing,
 * a shot cut in twice with one grade is one correction, black is ungraded; applying writes the grade with the event as
 * its source, and the shot's page says so. An ALE's Shot column names the shot. The multipart body is sent with Node's
 * fetch (jsdom's File loses its bytes in Node's Request; see shotGrades.live).
 */
const uid = `${Date.now().toString(36)}`.toUpperCase();
const fixture = {} as { project: Project; first: string; second: string };
const TC = '01:00:00:00 01:00:02:00 01:00:00:00 01:00:02:00';

const tree = (ui: React.ReactElement, initial: string) => (
  <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
    <MemoryRouter initialEntries={[initial]}>
      <AuthProvider>{ui}</AuthProvider>
    </MemoryRouter>
  </QueryClientProvider>
);

async function importFile(name: string, text: string, dryRun: boolean): Promise<GradeImport> {
  const boundary = `----live-grade-files-${uid}`;
  const body = [
    `--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="${name}"\r\nContent-Type: text/plain\r\n\r\n${text}\r\n`,
    `--${boundary}\r\nContent-Disposition: form-data; name="dry_run"\r\n\r\n${dryRun}\r\n`,
    `--${boundary}--\r\n`,
  ].join('');
  const response = await fetch(`${live.url}/api/v1/projects/${fixture.project.id}/grades/import/`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${tokenStorage.getAccessToken()}`, 'Content-Type': `multipart/form-data; boundary=${boundary}` },
    body,
  });
  expect(response.status).toBe(200);
  return (await response.json()) as GradeImport;
}

const edl = () =>
  [
    `TITLE: LIVE CUT ${uid}`,
    'FCM: NON-DROP FRAME',
    '',
    `001  BL       V     C        ${TC}`,
    `002  A001     V     C        ${TC}`,
    '* FROM CLIP NAME: A001C003_220101_R1AB.mov',
    '* LOC: 01:00:01:12 YELLOW SH0010',
    '*ASC_SOP (1.1 1.0 0.9)(0.01 0.0 -0.01)(1.0 1.0 1.05)',
    '*ASC_SAT 0.9',
    `003  A001     V     C        ${TC}`,
    '* LOC: 01:00:03:00 YELLOW SH0010',
    '*ASC_SOP (1.1 1.0 0.9)(0.01 0.0 -0.01)(1.0 1.0 1.05)',
    '*ASC_SAT 0.9',
    '',
  ].join('\n');

beforeEach(() => localStorage.clear());
afterEach(() => cleanup());
afterAll(() => tokenStorage.clearTokens());

describe('grades from an EDL and an ALE against a live backend (RP-22)', () => {
  beforeAll(async () => {
    const outcome = await authService.login(live.users.manager);
    if (outcome.status !== 'mfa_required') throw new Error('expected an MFA challenge for the manager');
    await authService.completeMfaLogin({ challenge: outcome.challenge, code: await freshTotp(live.manager.secret) });
    const project = await projectsApi.create({ code: `E${uid}`, name: 'Live grade files', workflow_type: 'standard' });
    const sequence = await sequencesApi.create({ project: project.id, code: `${project.code}_SQ`, name: 'Sequence' });
    const first = await shotsApi.create({ project: project.id, code: `${project.code}_SH0010`, sequence_id: sequence.id, name: 'From the cut' });
    const second = await shotsApi.create({ project: project.id, code: `${project.code}_SH0020`, sequence_id: sequence.id, name: 'From dailies' });
    Object.assign(fixture, { project, first: first.id, second: second.id });
  }, 120000);

  it('an EDL: a dry run reads the events, applying writes the shot, and its page names the event', async () => {
    const dry = await importFile('live.edl', edl(), true);
    expect(dry).toMatchObject({ dry_run: true, corrections: 2, ungraded: 1, unmatched: [], invalid: [], applied: 0 });
    expect(dry.matched.map((m) => [m.id, m.shot.code])).toEqual([['event 2: SH0010', `${fixture.project.code}_SH0010`]]);
    expect(importSummary(dry)).toBe('2 graded events in live.edl. 1 event without a grade. 1 shot would get a new grade.');
    expect((await shotsApi.get(fixture.first)).grade).toBeNull(); // nothing written
    expect(await importFile('live.edl', edl(), false)).toMatchObject({ dry_run: false, applied: 1 });
    expect(await shotsApi.get(fixture.first)).toMatchObject({ grade_source: 'live.edl (event 2: SH0010)' });

    render(tree(<Routes><Route path="/shots/:shotId" element={<ShotWorkspacePage />} /></Routes>, `/shots/${fixture.first}`));
    await screen.findByText('slope 1.1 1 0.9 · offset 0.01 0 -0.01 · power 1 1 1.05 · sat 0.9 · from live.edl (event 2: SH0010)', {}, { timeout: 20000 });
  }, 120000);

  it('an ALE: its Shot column names the shot; a row without a grade is counted', async () => {
    const ale = [
      'Heading', 'FIELD_DELIM\tTABS', 'FPS\t24', '',
      'Column', 'Name\tTracks\tASC_SOP\tASC_SAT\tShot', '',
      'Data', 'B002C001.mov\tV\t(0.9 1.0 1.1)(0.0 0.0 0.0)(1.0 1.0 1.0)\t1.0\tSH0020', 'B002C002\tV\t\t\t', '',
    ].join('\n'); // prettier-ignore
    const applied = await importFile('live.ale', ale, false);
    expect(applied).toMatchObject({ corrections: 1, ungraded: 1, applied: 1 });
    expect(await shotsApi.get(fixture.second)).toMatchObject({
      grade: { slope: [0.9, 1, 1.1], offset: [0, 0, 0], power: [1, 1, 1], saturation: 1 },
      grade_source: 'live.ale (row 1: SH0020)',
    });
  }, 60000);
});
