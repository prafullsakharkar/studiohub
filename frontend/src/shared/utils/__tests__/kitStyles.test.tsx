/**
 * Selected items are cyan and the primary action is the gradient (DESIGN_SYSTEM.md §1); indigo is the brand, kept
 * for the application shell (layouts/). The last test fails on a solid indigo fill drawn anywhere else.
 */
import fs from 'node:fs';
import path from 'node:path';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Button } from '@/shared/components/Button';
import { Pagination } from '@/shared/components/Pagination';
import { ScrollableTabs } from '@/shared/components/tabs/ScrollableTabs';
import { PRIMARY_FILL, SELECTED, SELECTED_UNDERLINE } from '../kitStyles';

vi.mock('@/core/auth/useCurrentUser', () => ({ useCurrentUser: () => ({ user: null }) }));
vi.mock('@/core/permissions/usePermissions', () => ({
  usePermissions: () => ({ currentRole: null, hasPermission: () => true, can: () => true }),
}));

afterEach(cleanup);

const classes = (el: Element) => el.className.split(/\s+/);
const hasAll = (el: Element, style: string) => style.split(/\s+/).every((c) => classes(el).includes(c));

describe('selected states', () => {
  it('the current page is drawn as selected', () => {
    render(<Pagination currentPage={2} totalCount={100} pageSize={25} onPageChange={vi.fn()} />);
    const current = screen.getByRole('button', { name: '2' });
    expect(current.getAttribute('aria-current')).toBe('page');
    expect(hasAll(current, SELECTED)).toBe(true);
    expect(hasAll(screen.getByRole('button', { name: '1' }), SELECTED)).toBe(false);
  });

  it.each(['pills', 'subtle'] as const)('the active %s tab is drawn as selected', (variant) => {
    render(<ScrollableTabs variant={variant} showDropdown={false} tabs={[{ id: 'a', label: 'Alpha' }, { id: 'b', label: 'Beta' }]} activeTab="b" onTabChange={vi.fn()} />);
    expect(hasAll(screen.getByRole('tab', { name: /Beta/ }), SELECTED)).toBe(true);
    expect(hasAll(screen.getByRole('tab', { name: /Alpha/ }), SELECTED)).toBe(false);
  });

  it('the active underline tab has the cyan underline', () => {
    render(<ScrollableTabs variant="underline" showDropdown={false} tabs={[{ id: 'a', label: 'Alpha' }, { id: 'b', label: 'Beta' }]} activeTab="a" onTabChange={vi.fn()} />);
    expect(hasAll(screen.getByRole('tab', { name: /Alpha/ }), SELECTED_UNDERLINE)).toBe(true);
  });
});

describe('primary action', () => {
  it('Button primary keeps every class of the gradient fill through cn (tailwind-merge)', () => {
    render(<Button>Save</Button>);
    const save = screen.getByRole('button', { name: 'Save' });
    expect(hasAll(save, PRIMARY_FILL)).toBe(true);
    expect(classes(save)).toContain('accent-gradient-primary');
  });
});

describe('no solid indigo fill outside the application shell', () => {
  const root = path.resolve(process.cwd(), 'src');
  const offenders: string[] = [];
  const walk = (dir: string) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (entry.name !== '__tests__' && full !== path.join(root, 'layouts')) walk(full);
      } else if (entry.name.endsWith('.tsx')) {
        fs.readFileSync(full, 'utf8')
          .split('\n')
          .forEach((line, i) => {
            if (/\bbg-indigo-600(?![\w/])/.test(line)) offenders.push(`${path.relative(root, full)}:${i + 1}`);
          });
      }
    }
  };
  walk(root);

  it('finds none', () => {
    expect(offenders).toEqual([]);
  });
});
