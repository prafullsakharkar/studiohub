import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { apiClient } from '@/api/client/ApiClient';
import { projectsApi, sequencesApi } from '@/api/production/structure';
import { shotsApi } from '@/api/production/work';
import { AuthProvider } from '@/core/auth/AuthProvider';
import { tokenStorage } from '@/core/auth/tokenStorage';
import { authService } from '@/modules/auth/services/AuthService';
import { GradeExport } from '@/modules/shots/components/GradeExport';
import { pickEntity } from '../picker';
import { freshTotp, live } from './liveBackend';

/**
 * Review-pipeline RP-27 against a REAL backend (C-RP-62): the manager grades two shots of one sequence and one of another;
 * the supervisor exports the first sequence from *Export grades…*. The saved file is named after the project and holds
 * the sequence's graded shots with their values, and nothing of the other sequence.
 */
const uid = `${Date.now().toString(36)}`.toUpperCase();
const fixture = {} as { projectId: string; code: string; shots: string[]; other: string };
const WARM = { slope: [1.1, 1, 0.9], offset: [0.01, 0, -0.01], power: [1, 1, 1.05], saturation: 0.9 };

async function signIn(who: 'manager' | 'supervisor') {
  tokenStorage.clearTokens();
  const outcome = await authService.login(live.users[who]);
  if (who === 'manager') {
    if (outcome.status !== 'mfa_required') throw new Error('expected an MFA challenge for the manager');
    await authService.completeMfaLogin({ challenge: outcome.challenge, code: await freshTotp(live.manager.secret) });
  } else if (outcome.status === 'mfa_required') throw new Error(`${who} unexpectedly needs MFA`);
}

/** What the page saved: the name and the file's text (ApiClient.download clicks a link with `download`). */
let saved: Array<{ name: string; blob: Blob }> = [];
let lastBlob: Blob | null = null;

beforeEach(() => {
  localStorage.clear();
  saved = [];
  vi.stubGlobal(
    'URL',
    Object.assign(URL, {
      createObjectURL: vi.fn((blob: Blob) => {
        lastBlob = blob;
        return 'blob:grades';
      }),
      revokeObjectURL: vi.fn(),
    }),
  );
  vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) {
    if (lastBlob) saved.push({ name: this.download, blob: lastBlob });
  });
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});
afterAll(() => tokenStorage.clearTokens());

describe('exporting shot grades against a live backend (RP-27)', () => {
  beforeAll(async () => {
    await signIn('manager');
    const project = await projectsApi.create({ code: `GX${uid}`, name: 'Live grade export', workflow_type: 'standard' });
    await apiClient.post(`/api/organizations/projects/${project.id}/members/`, { email: live.users.supervisor.email, role: 'VFX Supervisor' });
    const opening = await sequencesApi.create({ project: project.id, code: `${project.code}_SQ010`, name: 'Opening' });
    const chase = await sequencesApi.create({ project: project.id, code: `${project.code}_SQ020`, name: 'Chase' });
    const shot = async (code: string, sequenceId: string) => {
      const made = await shotsApi.create({ project: project.id, code: `${project.code}_${code}`, sequence_id: sequenceId, name: code });
      await shotsApi.update(made.id, { grade: WARM });
      return made.code;
    };
    Object.assign(fixture, {
      projectId: project.id,
      code: project.code,
      shots: [await shot('SH0010', opening.id), await shot('SH0020', opening.id)],
      other: await shot('SH0030', chase.id),
    });
  }, 120000);

  it('the supervisor exports one sequence: the file names its graded shots, with their values', async () => {
    await signIn('supervisor');
    render(
      <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
        <MemoryRouter>
          <AuthProvider>
            <GradeExport projectId={fixture.projectId} />
          </AuthProvider>
        </MemoryRouter>
      </QueryClientProvider>,
    );
    fireEvent.click(await screen.findByRole('button', { name: 'Export grades…' }, { timeout: 20000 }));
    await screen.findByText(`Saved as ${fixture.code}_grades.ccc.`, {}, { timeout: 20000 });
    await pickEntity(/Sequence/, new RegExp(`${fixture.code}_SQ010`), { search: `${fixture.code}_SQ010`, timeout: 20000 });
    fireEvent.click(screen.getByRole('button', { name: 'Export' }));
    await waitFor(() => expect(saved).toHaveLength(1), { timeout: 20000 });
    expect(saved[0].name).toBe(`${fixture.code}_grades.ccc`);
    const text = await saved[0].blob.text();
    const ids = [...text.matchAll(/<ColorCorrection id="([^"]+)"/g)].map((m) => m[1]);
    expect(ids).toEqual(fixture.shots);
    expect(text).not.toContain(fixture.other);
    expect(text).toContain('<Slope>1.100000 1.000000 0.900000</Slope>');
    expect(text).toContain('<Saturation>0.900000</Saturation>');
  }, 90000);
});
