import { useState } from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { Modal } from '@/shared/components/Modal';

describe('Modal focus management', () => {
  it('moves focus into the dialog on open and returns it on close', async () => {
    const { rerender } = render(
      <div>
        <button>Trigger</button>
      </div>,
    );
    const trigger = screen.getByRole('button', { name: 'Trigger' });
    trigger.focus();
    expect(document.activeElement).toBe(trigger);

    rerender(
      <div>
        <button>Trigger</button>
        <Modal isOpen={true} onClose={() => {}} title="Edit Item">
          <button>Save</button>
        </Modal>
      </div>,
    );
    const dialog = screen.getByRole('dialog');
    await waitFor(() => expect(dialog.contains(document.activeElement)).toBe(true));

    rerender(
      <div>
        <button>Trigger</button>
        <Modal isOpen={false} onClose={() => {}}>
          <button>Save</button>
        </Modal>
      </div>,
    );
    expect(document.activeElement?.textContent).toBe('Trigger');
  });

  it('traps Tab inside the dialog', () => {
    render(
      <Modal isOpen={true} onClose={() => {}} title="Edit Item">
        <button>First</button>
        <button>Last</button>
      </Modal>,
    );
    const dialog = screen.getByRole('dialog');
    const first = screen.getByRole('button', { name: 'Close dialog' });
    const last = screen.getByRole('button', { name: 'Last' });

    last.focus();
    fireEvent.keyDown(dialog, { key: 'Tab', shiftKey: false });
    expect(document.activeElement).toBe(first);

    first.focus();
    fireEvent.keyDown(dialog, { key: 'Tab', shiftKey: true });
    expect(document.activeElement).toBe(last);
  });

  it('unmounting while open removes its Escape handler and lets the page scroll again', () => {
    const onClose = vi.fn();
    const added = vi.spyOn(document, 'addEventListener');
    const removed = vi.spyOn(document, 'removeEventListener');
    const { unmount } = render(
      <Modal isOpen onClose={onClose} title="Bulk import">
        <button>Save</button>
      </Modal>,
    );
    expect(document.body.style.overflow).toBe('hidden');
    const handler = added.mock.calls.find(([type]) => type === 'keydown')?.[1];
    unmount();
    expect(document.body.style.overflow).toBe('');
    expect(removed.mock.calls.some(([type, fn]) => type === 'keydown' && fn === handler)).toBe(true);
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).not.toHaveBeenCalled();
    added.mockRestore();
    removed.mockRestore();
  });

  it('a dialog opened from a dialog closes alone on Escape, and the page stays locked until the last one closes', async () => {
    function Nested() {
      const [outer, setOuter] = useState(true);
      const [inner, setInner] = useState(true);
      return (
        <Modal isOpen={outer} onClose={() => setOuter(false)} title="Bulk import">
          <button>Outer action</button>
          <Modal isOpen={inner} onClose={() => setInner(false)} title="Paste rows">
            <button>Inner action</button>
          </Modal>
        </Modal>
      );
    }
    render(<Nested />);
    expect(screen.getAllByRole('dialog')).toHaveLength(2);

    fireEvent.keyDown(document, { key: 'Escape' });
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Paste rows' })).toBeNull());
    expect(screen.getByRole('dialog', { name: 'Bulk import' })).toBeInTheDocument();
    expect(document.body.style.overflow).toBe('hidden');

    fireEvent.keyDown(document, { key: 'Escape' });
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(document.body.style.overflow).toBe('');
  });

  it('a re-render with a new inline onClose keeps focus inside the dialog', async () => {
    function Host() {
      const [open, setOpen] = useState(false);
      const [n, setN] = useState(0);
      return (
        <>
          <button onClick={() => setOpen(true)}>Trigger</button>
          <Modal isOpen={open} onClose={() => setOpen(false)} title="Edit Item">
            <button onClick={() => setN(n + 1)}>Count {n}</button>
          </Modal>
        </>
      );
    }
    render(<Host />);
    const trigger = screen.getByRole('button', { name: 'Trigger' });
    trigger.focus();
    fireEvent.click(trigger);
    const dialog = screen.getByRole('dialog');
    await waitFor(() => expect(dialog.contains(document.activeElement)).toBe(true));
    const count = screen.getByRole('button', { name: 'Count 0' });
    count.focus();
    fireEvent.click(count); // a new onClose arrives with this render
    expect(screen.getByRole('button', { name: 'Count 1' })).toBeInTheDocument();
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Count 1' }));
  });
});
