/**
 * The dialogs that used to draw their own overlay (the bulk managers, the paste dialog, the command palette) now
 * share Modal's behaviour: they are named dialogs, Escape closes the top one only, and the page is locked meanwhile.
 */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AssetBulkManager } from '@/modules/assets/components/bulk/AssetBulkManager';

vi.mock('@/providers/ThemeProvider', () => ({ useThemeMode: () => ({ mode: 'dark', toggleTheme: vi.fn() }) }));
vi.mock('@/core/auth/useCurrentUser', () => ({
  useCurrentUser: () => ({ user: { id: 'u', email: 'a@example.test', is_superuser: true, is_active: true, role: 'Artist', permissions: [], memberships: [] } }),
}));
vi.mock('@/core/permissions/usePermissions', () => ({
  usePermissions: () => ({ currentRole: null, hasPermission: () => true, can: () => true }),
}));

afterEach(() => {
  cleanup();
  document.body.style.overflow = '';
});

const pressEscape = () => fireEvent.keyDown(document.activeElement ?? document.body, { key: 'Escape' });

function renderAssets(onClose = vi.fn()) {
  render(
    <QueryClientProvider client={new QueryClient()}>
      <AssetBulkManager projectId="p-1" projectCode="ALPHA" isOpen onClose={onClose} />
    </QueryClientProvider>
  );
  return onClose;
}

describe('bulk managers on Modal', () => {
  it('is a named dialog with the project, locks the page, and Escape closes it', () => {
    const onClose = renderAssets();
    const dialog = screen.getByRole('dialog', { name: /Bulk Asset Management/ });
    expect(dialog.getAttribute('aria-modal')).toBe('true');
    expect(within(dialog).getByText('Project: ALPHA')).toBeTruthy();
    expect(document.body.style.overflow).toBe('hidden');
    pressEscape();
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('the paste dialog opened from it closes alone on Escape', async () => {
    const onClose = renderAssets();
    fireEvent.click(screen.getByRole('button', { name: /Paste TSV \/ CSV/ }));
    const paste = await screen.findByRole('dialog', { name: /Paste TSV \/ CSV Data/ });
    expect(within(paste).getByLabelText('Rows to paste')).toBeTruthy();

    pressEscape();
    await waitFor(() => expect(screen.queryByRole('dialog', { name: /Paste TSV \/ CSV Data/ })).toBeNull());
    expect(onClose).not.toHaveBeenCalled();
    expect(screen.getByRole('dialog', { name: /Bulk Asset Management/ })).toBeTruthy();
  });
});

describe('command palette', () => {
  async function renderPalette(onClose = vi.fn()) {
    const { CommandPalette } = await import('../CommandPalette');
    render(
      <MemoryRouter>
        <CommandPalette isOpen onClose={onClose} />
      </MemoryRouter>
    );
    return onClose;
  }

  it('is a modal dialog; Escape closes it once', async () => {
    const onClose = await renderPalette();
    const dialog = screen.getByRole('dialog', { name: 'Command palette' });
    expect(dialog.getAttribute('aria-modal')).toBe('true');
    expect(within(dialog).getByLabelText('Search commands and pages')).toBeTruthy();
    expect(document.body.style.overflow).toBe('hidden');

    within(dialog).getByLabelText('Search commands and pages').focus();
    pressEscape();
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('Escape closes the shortcuts dialog opened from it, not the palette', async () => {
    const onClose = await renderPalette();
    fireEvent.click(within(screen.getByRole('dialog', { name: 'Command palette' })).getByRole('button', { name: /Shortcuts/ }));
    const shortcuts = await screen.findByRole('dialog', { name: /Studio Keyboard Shortcuts/ });
    await waitFor(() => expect(shortcuts.contains(document.activeElement)).toBe(true));

    pressEscape();
    await waitFor(() => expect(screen.queryByRole('dialog', { name: /Studio Keyboard Shortcuts/ })).toBeNull());
    expect(onClose).not.toHaveBeenCalled();
  });

  it('does not pull focus back from a dialog opened from it, even when that happens at once', async () => {
    await renderPalette();
    // The palette focuses its search box 50 ms after it opens; the dialog is opened before that.
    fireEvent.click(within(screen.getByRole('dialog', { name: 'Command palette' })).getByRole('button', { name: /Shortcuts/ }));
    const shortcuts = await screen.findByRole('dialog', { name: /Studio Keyboard Shortcuts/ });
    await new Promise((resolve) => setTimeout(resolve, 150));
    expect(shortcuts.contains(document.activeElement)).toBe(true);
  });
});
