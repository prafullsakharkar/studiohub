import { describe, it, expect } from 'vitest';
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
});
