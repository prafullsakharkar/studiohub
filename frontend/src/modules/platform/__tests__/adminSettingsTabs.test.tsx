import { describe, it, expect } from 'vitest';
import { resolveAdminTab, VALID_ADMIN_TABS } from '@/modules/platform/pages/PlatformAdminPage';

describe('platform admin tabs absorb settings', () => {
  it('resolves pipeline tab', () => {
    expect(VALID_ADMIN_TABS).toContain('pipeline');
    expect(resolveAdminTab('pipeline')).toBe('pipeline');
  });
  it('resolves theme, layout, database tabs', () => {
    for (const tab of ['theme', 'layout', 'database']) {
      expect(VALID_ADMIN_TABS).toContain(tab);
      expect(resolveAdminTab(tab)).toBe(tab);
    }
  });
  it('falls back to overview for unknown slugs', () => {
    expect(resolveAdminTab('nope')).toBe('overview');
  });
});

describe('settings-scoped viewer tab filtering', () => {
  it('shows only pipeline/theme/layout without platform perms', async () => {
    const { filterAdminTabsForViewer } = await import('@/modules/platform/pages/PlatformAdminPage');
    const all = ['overview', 'software', 'roles', 'pipeline', 'theme', 'layout', 'database'];
    expect(filterAdminTabsForViewer(all, false)).toEqual(['pipeline', 'theme', 'layout']);
  });
  it('shows all tabs with platform perms', async () => {
    const { filterAdminTabsForViewer } = await import('@/modules/platform/pages/PlatformAdminPage');
    const all = ['overview', 'software', 'pipeline', 'database'];
    expect(filterAdminTabsForViewer(all, true)).toEqual(all);
  });
});
