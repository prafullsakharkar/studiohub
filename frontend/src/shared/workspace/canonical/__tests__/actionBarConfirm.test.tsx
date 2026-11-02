import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { WorkspaceActionBar } from '../WorkspaceActionBar';
import type { WorkspaceAction } from '../types';

afterEach(cleanup);

const actions = (run: () => void): WorkspaceAction[] => [
  { id: 'first', label: 'First', onClick: () => undefined },
  { id: 'second', label: 'Second', onClick: () => undefined },
  { id: 'third', label: 'Third', onClick: () => undefined },
  { id: 'archive', label: 'Archive it', danger: true, confirm: { title: 'Archive?', message: 'It is hidden.', confirmText: 'Yes, archive', variant: 'warning' }, onClick: run },
  { id: 'plain', label: 'Plain one', onClick: () => undefined },
];

describe('the action bar and its overflow menu', () => {
  it('asks for the confirmation of an action in the overflow menu before running it', async () => {
    const run = vi.fn();
    render(<WorkspaceActionBar actions={actions(run)} />);
    fireEvent.click(screen.getByTitle('More Actions'));
    fireEvent.click(await screen.findByRole('menuitem', { name: /Archive it/ }));
    expect(run).not.toHaveBeenCalled();
    expect(await screen.findByText('It is hidden.')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Yes, archive' }));
    await waitFor(() => expect(run).toHaveBeenCalledTimes(1));
  });

  it('runs nothing when the confirmation is cancelled', async () => {
    const run = vi.fn();
    render(<WorkspaceActionBar actions={actions(run)} />);
    fireEvent.click(screen.getByTitle('More Actions'));
    fireEvent.click(await screen.findByRole('menuitem', { name: /Archive it/ }));
    fireEvent.click(await screen.findByRole('button', { name: 'Cancel' }));
    expect(run).not.toHaveBeenCalled();
  });

  it('runs an overflow action that has no confirmation at once', async () => {
    const run = vi.fn();
    const list = actions(() => undefined);
    list[4] = { id: 'plain', label: 'Plain one', onClick: run };
    render(<WorkspaceActionBar actions={list} />);
    fireEvent.click(screen.getByTitle('More Actions'));
    fireEvent.click(await screen.findByRole('menuitem', { name: /Plain one/ }));
    expect(run).toHaveBeenCalledTimes(1);
  });
});
