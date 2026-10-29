import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '@/api/errors/ApiError';
import { loadSample } from '@/test/samples';
import { ConfirmDialog } from '../ConfirmDialog';

const conflicts = loadSample<Record<string, { status: number; body: unknown }>>('_misc/conflicts_and_pagination.json');
afterEach(cleanup);

const renderDialog = (onConfirm: () => Promise<unknown>, onClose = vi.fn()) => {
  render(<ConfirmDialog isOpen title="Delete department" message="Delete Compositing?" confirmLabel="Delete" destructive onConfirm={onConfirm} onClose={onClose} />);
  return onClose;
};

describe('ConfirmDialog', () => {
  it('runs the action and closes on success', async () => {
    const onConfirm = vi.fn(async () => undefined);
    const onClose = renderDialog(onConfirm);
    fireEvent.click(screen.getByRole('button', { name: 'Delete' }));
    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it('stays open and shows what still references the record on a 409 has_dependants (real sample)', async () => {
    const sample = conflicts.department_delete_referenced;
    const onClose = renderDialog(async () => {
      throw ApiError.fromDrfResponse(sample.status, sample.body as never);
    });
    fireEvent.click(screen.getByRole('button', { name: 'Delete' }));

    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toContain('still in use and cannot be deleted');
    expect(alert.textContent).toContain('masterdata.Position.department (2)');
    expect(onClose).not.toHaveBeenCalled();
  });

  it('shows the request id for a server failure', async () => {
    renderDialog(async () => {
      throw ApiError.fromDrfResponse(500, { detail: 'boom', error: { code: 'server_error', request_id: 'req-123' } });
    });
    fireEvent.click(screen.getByRole('button', { name: 'Delete' }));
    expect((await screen.findByRole('alert')).textContent).toContain('Ref: req-123');
  });

  it('cancel closes without running the action', () => {
    const onConfirm = vi.fn();
    const onClose = renderDialog(onConfirm as never);
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(onClose).toHaveBeenCalled();
    expect(onConfirm).not.toHaveBeenCalled();
  });
});
