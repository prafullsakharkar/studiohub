import { describe, expect, it } from 'vitest';
import { adminTabTarget } from '../routes/platformRoutes';

describe('the old Platform Administration URLs', () => {
  it.each([
    ['software', '/platform/catalog/software'],
    ['statuses', '/platform/catalog/statuses'],
    ['task-types', '/platform/catalog/task-types'],
    ['asset-types', '/platform/catalog/asset-types'],
    ['shot-types', '/platform/catalog/shot-types'],
    ['review-types', '/platform/catalog/review-types'],
    ['file-types', '/platform/catalog/file-types'],
    ['asset-shot-types', '/platform/catalog/asset-types'],
    ['review-file-types', '/platform/catalog/review-types'],
  ])('the %s tab is the catalog screen of that kind', (tab, target) => {
    expect(adminTabTarget(tab)).toBe(target);
  });

  it.each([
    ['roles', '/access/roles'],
    ['groups', '/access/groups'],
    ['departments', '/departments'],
    ['positions', '/positions'],
    ['api-health', '/platform/health'],
  ])('the %s tab is the screen that replaced it', (tab, target) => {
    expect(adminTabTarget(tab)).toBe(target);
  });

  it('the page itself, its overview and anything unknown land on the catalog', () => {
    for (const tab of [undefined, '', 'overview', 'pipeline', 'theme', 'layout', 'database', 'nope']) expect(adminTabTarget(tab)).toBe('/platform/catalog');
  });
});
