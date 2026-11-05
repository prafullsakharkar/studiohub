/**
 * Button follows the kit's control heights (28 in grids and toolbars, 32 by default, 36 in forms and dialogs) and
 * renders no id unless the caller gives one (it used to make up a random id, a new one on every render).
 */
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Button } from '../Button';
import { Card } from '../Card';

vi.mock('@/core/auth/useCurrentUser', () => ({ useCurrentUser: () => ({ user: null }) }));
vi.mock('@/core/permissions/usePermissions', () => ({
  usePermissions: () => ({ currentRole: null, hasPermission: () => true, can: () => true }),
}));

afterEach(cleanup);

describe('Button', () => {
  it.each([
    ['xs', 'h-7', 'text-[11px]'],
    ['sm', 'h-7', 'text-xs'],
    ['md', 'h-8', 'text-[13px]'],
    ['lg', 'h-9', 'text-sm'],
  ] as const)('size %s is %s with %s', (size, height, text) => {
    render(<Button size={size}>Go</Button>);
    const classes = screen.getByRole('button', { name: 'Go' }).className.split(/\s+/);
    expect(classes).toContain(height);
    expect(classes).toContain(text);
    expect(classes.some((c) => /^py-/.test(c))).toBe(false);
  });

  it('defaults to the 32px control', () => {
    render(<Button>Go</Button>);
    expect(screen.getByRole('button', { name: 'Go' }).className.split(/\s+/)).toContain('h-8');
  });

  it('has no id unless one is given, and keeps a given one', () => {
    const { rerender } = render(<Button>Go</Button>);
    expect(screen.getByRole('button', { name: 'Go' }).hasAttribute('id')).toBe(false);
    rerender(<Button id="save">Go</Button>);
    expect(screen.getByRole('button', { name: 'Go' }).id).toBe('save');
  });
});

describe('Card', () => {
  it('has no id unless one is given', () => {
    const { container, rerender } = render(<Card>Body</Card>);
    expect((container.firstChild as HTMLElement).hasAttribute('id')).toBe(false);
    rerender(<Card id="summary">Body</Card>);
    expect((container.firstChild as HTMLElement).id).toBe('summary');
  });
});
