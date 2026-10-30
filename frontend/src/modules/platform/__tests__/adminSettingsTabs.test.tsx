import { describe, it, expect } from 'vitest';
import { filterAdminTabsForViewer, resolveAdminTab, VALID_ADMIN_TABS } from '@/modules/platform/pages/PlatformAdminPage';

describe('platform admin tabs are master data only', () => {
  it('no longer has the mock pipeline, theme, layout and database tabs: system settings are real screens under /settings/system', () => {
    for (const tab of ['pipeline', 'theme', 'layout', 'database']) {
      expect(VALID_ADMIN_TABS).not.toContain(tab);
      expect(resolveAdminTab(tab)).toBe('overview');
    }
  });
  it('resolves a master-data tab and falls back to overview for unknown slugs', () => {
    expect(resolveAdminTab('software')).toBe('software');
    expect(resolveAdminTab('nope')).toBe('overview');
    expect(resolveAdminTab(undefined)).toBe('overview');
  });
});

describe('viewer tab filtering', () => {
  const all = ['overview', 'software', 'roles'];
  it('shows every tab with platform permissions', () => {
    expect(filterAdminTabsForViewer(all, true)).toEqual(all);
  });
  it('shows none without them (the page then sends the viewer to /settings/system)', () => {
    expect(filterAdminTabsForViewer(all, false)).toEqual([]);
  });
});
