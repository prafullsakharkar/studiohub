import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import type React from 'react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { deliveriesApi, destinationsApi } from '@/api/deliveries/deliveries';
import { clientsApi } from '@/api/masterdata/directory';
import { AuthProvider } from '@/core/auth/AuthProvider';
import { tokenStorage } from '@/core/auth/tokenStorage';
import { authService } from '@/modules/auth/services/AuthService';
import { DeliveriesPage, DeliveryWorkspacePage } from '@/modules/deliveries';
import { freshTotp, live } from './liveBackend';

/**
 * Phase 8 against a REAL backend, with the roles the studio seeds. A supervisor prepares a delivery; they cannot
 * sign it off (separation of duties), a producer does, sends it, reads the passcode, records the client's answer
 * and completes it. A rejected delivery is revised. Two drafts are cancelled together from the list. An artist
 * only reads. Run on a fresh live_backend.py seed (the project and its published versions are made there).
 */
const uid = `${Date.now().toString(36)}`.toUpperCase();
const fixture = {} as { client: string; destination: string };

const tree = (ui: React.ReactElement, initial: string) => (
  <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
    <MemoryRouter initialEntries={[initial]}>
      <AuthProvider>{ui}</AuthProvider>
    </MemoryRouter>
  </QueryClientProvider>
);
const pages = (
  <Routes>
    <Route path="/deliveries" element={<DeliveriesPage />} />
    <Route path="/deliveries/:deliveryId" element={<DeliveryWorkspacePage />} />
  </Routes>
);

async function signIn(who: 'supervisor' | 'producer' | 'artist') {
  tokenStorage.clearTokens();
  const outcome = await authService.login(live.users[who]);
  if (outcome.status === 'mfa_required') throw new Error(`${who} unexpectedly needs MFA`);
}
const toolbar = () => screen.findByRole('toolbar', { name: 'Delivery actions' }, { timeout: 20000 });
const actionsNow = () => (screen.queryByRole('toolbar', { name: 'Delivery actions' }) ? within(screen.getByRole('toolbar', { name: 'Delivery actions' })).getAllByRole('button').map((b) => b.textContent) : []);
const act = async (name: string, fill?: (dialog: ReturnType<typeof within>) => void) => {
  fireEvent.click(within(await toolbar()).getByRole('button', { name }));
  const dialog = within(await screen.findByRole('dialog'));
  fill?.(dialog);
  fireEvent.click(dialog.getByRole('button', { name }));
  return dialog;
};
const status = async (id: string) => (await deliveriesApi.get(id)).status;
const heading = (code: string) => screen.findByRole('heading', { name: new RegExp(code) }, { timeout: 20000 });

beforeEach(() => localStorage.clear());
afterEach(() => cleanup());
afterAll(() => tokenStorage.clearTokens());

beforeAll(async () => {
  const outcome = await authService.login(live.users.manager);
  if (outcome.status !== 'mfa_required') throw new Error('expected an MFA challenge for the manager');
  await authService.completeMfaLogin({ challenge: outcome.challenge, code: await freshTotp(live.manager.secret) });
  const client = await clientsApi.create({ name: `Acme ${uid}`, code: `AC${uid}` } as never);
  fixture.client = client.id;
  tokenStorage.clearTokens();
  await signIn('supervisor');
  const destination = await destinationsApi.create({ name: `Acme S3 ${uid}`, type: 'AWS S3 Bucket', endpoint: 's3://acme/incoming', is_default: true });
  fixture.destination = destination.id;
  tokenStorage.clearTokens();
}, 180000);

describe('a delivery from draft to completed', () => {
  it('the supervisor prepares it, cannot sign it off; the producer signs off, sends, reads the passcode, records the client’s approval and completes it', async () => {
    const { project, versions } = live.dlv;
    await signIn('supervisor');
    const delivery = await deliveriesApi.create({ name: `Reel ${uid}`, project_id: project, client_id: fixture.client, destination_id: fixture.destination, delivery_method: 'S3', passcode: 'live-passcode-1' });
    expect(delivery).toMatchObject({ name: `Reel ${uid}` });
    const detail = await deliveriesApi.get(delivery.id);
    expect(detail).toMatchObject({ status: 'Draft', has_passcode: true, destination_name: `Acme S3 ${uid}` });
    expect(detail).not.toHaveProperty('passcode');

    // the supervisor adds two published versions from the page
    render(tree(pages, `/deliveries/${delivery.id}`));
    await heading(detail.code);
    for (const v of versions.slice(0, 2)) {
      const select = await screen.findByLabelText('Add a published version', {}, { timeout: 20000 });
      await waitFor(() => expect([...(select as HTMLSelectElement).options].some((o) => o.value === v.id)).toBe(true), { timeout: 15000 });
      fireEvent.change(select, { target: { value: v.id } });
      fireEvent.click(screen.getByRole('button', { name: 'Add version' }));
      await waitFor(async () => expect((await deliveriesApi.get(delivery.id)).versions.some((i) => i.version_id === v.id)).toBe(true), { timeout: 15000 });
    }
    await waitFor(() => expect(actionsNow()).toEqual(['Validate', 'Prepare', 'Cancel delivery']), { timeout: 15000 });

    // validate: the checks run and the page opens them
    await act('Validate');
    await screen.findByRole('region', { name: 'Latest check run' }, { timeout: 20000 });
    expect(await status(delivery.id)).toBe('Validating');
    await waitFor(() => expect(actionsNow()).toEqual(['Re-run checks', 'Prepare', 'Cancel delivery']), { timeout: 15000 });

    // prepare: the delivery is Ready, with a real manifest checksum
    await act('Prepare');
    await waitFor(async () => expect(await status(delivery.id)).toBe('Ready'), { timeout: 15000 });
    expect((await deliveriesApi.get(delivery.id)).checksums.manifest_sha256).toMatch(/^[0-9a-f]{64}$/);

    // the preparer cannot sign off: the server's sentence is in the dialog and nothing changes
    await waitFor(() => expect(actionsNow()).toEqual(['Sign off', 'Cancel delivery']), { timeout: 15000 });
    const refused = await act('Sign off');
    expect(await refused.findByText('You prepared this delivery, so someone else must sign it off.', {}, { timeout: 15000 })).toBeTruthy();
    expect(await status(delivery.id)).toBe('Ready');
    cleanup();

    // the producer signs off; Send needs the sign-off first
    await signIn('producer');
    render(tree(pages, `/deliveries/${delivery.id}`));
    await heading(detail.code);
    await waitFor(() => expect(actionsNow()).toEqual(['Sign off', 'Cancel delivery']), { timeout: 15000 });
    await act('Sign off', (dialog) => fireEvent.change(dialog.getByLabelText('Notes'), { target: { value: 'checked against the edit' } }));
    await waitFor(() => expect(actionsNow()).toEqual(['Reopen', 'Send', 'Cancel delivery']), { timeout: 15000 });
    expect(await status(delivery.id)).toBe('Signed Off');

    // send, with the transfer reference; the files are frozen from now on
    await act('Send', (dialog) => fireEvent.change(dialog.getByLabelText('Transfer reference (e.g. Aspera job)'), { target: { value: `ASPERA-${uid}` } }));
    await waitFor(() => expect(actionsNow()).toEqual(['Client approved', 'Client rejected']), { timeout: 15000 });
    const sent = await deliveriesApi.get(delivery.id);
    expect(sent).toMatchObject({ status: 'Submitted', transfer_reference: `ASPERA-${uid}` });
    expect(sent.versions.every((i) => i.files.every((f) => f.frozen_at))).toBe(true);
    expect(screen.queryByLabelText('Add a published version')).toBeNull();

    // the producer may read the passcode (an audited read); the page asks for it only on request
    fireEvent.click(screen.getByRole('tab', { name: 'Details' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Show passcode' }));
    expect((await screen.findByLabelText('Passcode', {}, { timeout: 15000 })).textContent).toBe('live-passcode-1');

    // the client answered: approved, then completed
    await act('Client approved', (dialog) => fireEvent.change(dialog.getByLabelText('Client notes'), { target: { value: 'Approved by email' } }));
    await waitFor(() => expect(actionsNow()).toEqual(['Complete']), { timeout: 15000 });
    await act('Complete');
    await waitFor(async () => expect(await status(delivery.id)).toBe('Completed'), { timeout: 15000 });
    expect((await deliveriesApi.get(delivery.id)).client_notes).toBe('Approved by email');

    // the history lists every move, in the reader's words
    fireEvent.click(screen.getByRole('tab', { name: 'Status history' }));
    const history = await screen.findByRole('list', { name: 'Status history' }, { timeout: 15000 });
    await waitFor(() => expect(within(history).getAllByRole('listitem').length).toBeGreaterThanOrEqual(7), { timeout: 15000 });
    expect(within(history).getAllByText('Completed').length).toBeGreaterThan(0);
    expect(within(history).getAllByText(/@example\.test/).length).toBeGreaterThan(0); // names, not ids
  }, 240000);

  it('a rejected delivery is revised into a new draft with the same versions', async () => {
    const { project, versions } = live.dlv;
    await signIn('supervisor');
    const d = await deliveriesApi.create({ name: `Rejected ${uid}`, project_id: project, client_id: fixture.client });
    await deliveriesApi.addVersion(d.id, versions[2].id);
    await deliveriesApi.prepare(d.id);
    tokenStorage.clearTokens();
    await signIn('producer');
    await deliveriesApi.signOff(d.id);
    await deliveriesApi.submit(d.id);

    render(tree(pages, `/deliveries/${d.id}`));
    await heading(d.code);
    // a reason is required before anything is sent
    fireEvent.click(within(await toolbar()).getByRole('button', { name: 'Client rejected' }));
    const dialog = within(await screen.findByRole('dialog'));
    fireEvent.click(dialog.getByRole('button', { name: 'Client rejected' }));
    expect(await dialog.findByText('Reason is required.')).toBeTruthy();
    expect(await status(d.id)).toBe('Submitted');
    fireEvent.change(dialog.getByLabelText(/^Reason/), { target: { value: 'Colour is off in reel 2' } });
    fireEvent.click(dialog.getByRole('button', { name: 'Client rejected' }));
    await waitFor(async () => expect(await status(d.id)).toBe('Rejected'), { timeout: 15000 });
    expect((await deliveriesApi.get(d.id)).rejection_reason).toBe('Colour is off in reel 2');
    expect(await screen.findByText(/The client rejected this delivery: Colour is off in reel 2/, {}, { timeout: 15000 })).toBeTruthy();

    await waitFor(() => expect(actionsNow()).toEqual(['Revise']), { timeout: 15000 });
    await act('Revise');
    // the page moves to the new draft, which points back at the rejected one
    await waitFor(async () => {
      const list = await deliveriesApi.list({ search: `Rejected ${uid}` });
      const revision = list.results.find((r) => r.status === 'Draft');
      expect(revision).toBeTruthy();
      const detail = await deliveriesApi.get((revision as { id: string }).id);
      expect(detail.revision_of).toBe(d.id);
      expect(detail.versions.map((i) => i.version_id)).toEqual([versions[2].id]);
    }, { timeout: 20000 });

    // a delivery that was sent is a record: it cannot be deleted, whatever its status
    await expect(deliveriesApi.remove(d.id)).rejects.toBeTruthy();
    expect((await deliveriesApi.get(d.id)).status).toBe('Rejected');
  }, 240000);
});

describe('cancelling from the list, and who only reads', () => {
  it('two drafts are cancelled together with one reason; an artist sees the deliveries and no controls', async () => {
    const { project } = live.dlv;
    await signIn('supervisor');
    const a = await deliveriesApi.create({ name: `Bulk A ${uid}`, project_id: project });
    const b = await deliveriesApi.create({ name: `Bulk B ${uid}`, project_id: project });
    render(tree(pages, '/deliveries'));
    fireEvent.change(await screen.findByPlaceholderText(/Search name, code, client/, {}, { timeout: 20000 }), { target: { value: `Bulk` } });
    // wait for the search to replace the list, or ticking a row races with the re-render that drops the selection
    await waitFor(() => expect(screen.getAllByRole('checkbox', { name: /^Select DLV-/ })).toHaveLength(2), { timeout: 20000 });
    for (const d of [a, b]) fireEvent.click(await screen.findByRole('checkbox', { name: new RegExp(`^Select ${d.code}`) }, { timeout: 20000 }));
    fireEvent.click(screen.getByRole('button', { name: 'Cancel deliveries' }));
    const dialog = within(await screen.findByRole('dialog'));
    fireEvent.change(dialog.getByLabelText('Reason'), { target: { value: 'Postponed' } });
    fireEvent.click(dialog.getByRole('button', { name: 'Cancel deliveries' }));
    await waitFor(async () => {
      expect(await status(a.id)).toBe('Cancelled');
      expect(await status(b.id)).toBe('Cancelled');
    }, { timeout: 20000 });
    expect((await deliveriesApi.get(a.id)).cancellation_reason).toBe('Postponed');

    // the list filters on the server, and a cancelled delivery can be deleted
    const cancelled = await deliveriesApi.list({ status: 'Cancelled', search: `Bulk` });
    expect(cancelled.results.map((r) => r.id).sort()).toEqual([a.id, b.id].sort());
    expect((await deliveriesApi.list({ status: 'Draft', search: `Bulk` })).results).toEqual([]);
    cleanup();
    await signIn('producer');
    await deliveriesApi.remove(a.id);
    expect((await deliveriesApi.list({ status: 'Cancelled', search: `Bulk` })).results.map((r) => r.id)).toEqual([b.id]);
    cleanup();

    await signIn('artist');
    render(tree(pages, `/deliveries/${b.id}`));
    await heading(b.code);
    expect(actionsNow()).toEqual([]);
    expect(screen.queryByRole('link', { name: 'Edit details' })).toBeNull();
  }, 240000);
});

describe('items and filters on the real server', () => {
  it('an item that was checked can be removed; the list filters by client and by the read word for a status', async () => {
    const { project, versions } = live.dlv;
    await signIn('supervisor');
    const d = await deliveriesApi.create({ name: `Checked ${uid}`, project_id: project, client_id: fixture.client });
    await deliveriesApi.addVersion(d.id, versions[3].id);
    await deliveriesApi.validate(d.id);
    expect((await deliveriesApi.qc(d.id)).length).toBeGreaterThan(0);
    const after = await deliveriesApi.removeVersion(d.id, (await deliveriesApi.get(d.id)).versions[0].uid);
    expect(after.versions).toEqual([]);
    expect(await deliveriesApi.qc(d.id)).toEqual([]); // the run was cleared with the item

    await deliveriesApi.addVersion(d.id, versions[3].id);
    await deliveriesApi.prepare(d.id);
    const ready = await deliveriesApi.list({ status: 'Ready', client_id: fixture.client, search: `Checked ${uid}` });
    expect(ready.results.map((r) => r.id)).toEqual([d.id]);
    expect((await deliveriesApi.list({ status: 'Prepared', search: `Checked ${uid}` })).count).toBe(1); // the stored word too
    expect((await deliveriesApi.list({ status: 'Draft', search: `Checked ${uid}` })).count).toBe(0);
    expect((await deliveriesApi.ofProject(project)({ status: 'Ready', search: `Checked ${uid}` })).count).toBe(1);
  }, 180000);
});
