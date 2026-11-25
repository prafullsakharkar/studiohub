/**
 * A table row's actions are round icon buttons: the label is the tooltip and, unless `aria-label` says more, the
 * accessible name, so screen readers and tests still find "Edit <row>". A label with no icon is a text pill.
 */
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { Star } from 'lucide-react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { RowActionButton, RowActionLink, rowActionIcon } from '../RowActionButton';

afterEach(cleanup);

describe('rowActionIcon', () => {
  it.each(['Edit', 'Archive', 'Restore', 'Delete', 'Remove', 'Unlink', 'Revoke', 'Publish', 'Unpublish', 'Make hero', 'Make default', 'Approve', 'Reject', 'Deactivate', 'Reactivate', 'Move Plate up', 'Move Plate down', 'Details', 'Cancel job', 'Retry', 'Pause', 'Resume'])('has an icon for %s', (label) => {
    expect(rowActionIcon(label)).toBeDefined();
  });

  it('tells apart labels that share a word', () => {
    expect(rowActionIcon('Unpublish')).not.toBe(rowActionIcon('Publish'));
    expect(rowActionIcon('Make hero')).not.toBe(rowActionIcon('Make default'));
    expect(rowActionIcon('Restore')).not.toBe(rowActionIcon('Archive'));
    expect(rowActionIcon('Unlock')).not.toBe(rowActionIcon('Lock'));
  });

  it('has none for a label it does not know', () => {
    expect(rowActionIcon('Frobnicate')).toBeUndefined();
  });
});

describe('RowActionButton', () => {
  it('is a round icon button named and titled by its label', () => {
    const onClick = vi.fn();
    render(<RowActionButton label="Edit" aria-label="Edit Alpha" onClick={onClick} />);
    const button = screen.getByRole('button', { name: 'Edit Alpha' });
    expect(button).toHaveAttribute('title', 'Edit');
    expect(button).toHaveAttribute('type', 'button');
    expect(button.className).toContain('rounded-full');
    expect(button.className).toContain('w-7');
    expect(button.textContent).toBe('');
    expect(button.querySelector('svg')).not.toBeNull();
    fireEvent.click(button);
    expect(onClick).toHaveBeenCalledOnce();
  });

  it('falls back to the label when it has no aria-label', () => {
    render(<RowActionButton label="Retry" onClick={() => {}} />);
    expect(screen.getByRole('button', { name: 'Retry' })).toBeInTheDocument();
  });

  it('draws a label with no icon as a text pill', () => {
    render(<RowActionButton label="Frobnicate" onClick={() => {}} />);
    const button = screen.getByRole('button', { name: 'Frobnicate' });
    expect(button.textContent).toBe('Frobnicate');
    expect(button.querySelector('svg')).toBeNull();
    expect(button.className).toContain('rounded-full');
  });

  it('takes an icon over the one for its label, and a tone', () => {
    render(<RowActionButton label="Frobnicate" icon={Star} tone="danger" onClick={() => {}} />);
    const button = screen.getByRole('button', { name: 'Frobnicate' });
    expect(button.querySelector('svg')).not.toBeNull();
    expect(button.className).toContain('text-rose-400');
  });

  it('does not fire when disabled', () => {
    const onClick = vi.fn();
    render(<RowActionButton label="Move Plate up" disabled onClick={onClick} />);
    fireEvent.click(screen.getByRole('button', { name: 'Move Plate up' }));
    expect(onClick).not.toHaveBeenCalled();
  });
});

describe('RowActionLink', () => {
  it('is a round icon link to its page', () => {
    render(
      <MemoryRouter>
        <RowActionLink label="Edit" to="/clients/1/edit" aria-label="Edit Acme" />
      </MemoryRouter>,
    );
    const link = screen.getByRole('link', { name: 'Edit Acme' });
    expect(link).toHaveAttribute('href', '/clients/1/edit');
    expect(link).toHaveAttribute('title', 'Edit');
    expect(link.className).toContain('rounded-full');
  });
});
