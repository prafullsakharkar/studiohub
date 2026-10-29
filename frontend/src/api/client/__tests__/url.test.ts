import { describe, expect, it } from 'vitest';
import { loadSample } from '@/test/samples';
import { isSlashlessRoute, normalizeApiPath } from '../url';

const { routes } = loadSample<{ routes: string[] }>('_misc/routes.json') as unknown as { routes: string[] };
const concrete = (route: string) => route.replace(/\{[^}]+\}/g, 'abc123');

describe('normalizeApiPath against the real route table', () => {
  it('has the expected shape: 501 routes, 57 of them slash-less', () => {
    expect(routes.length).toBe(501);
    expect(routes.filter((r) => !r.endsWith('/')).length).toBe(57);
  });

  it('leaves every real route exactly as registered', () => {
    const changed = routes.map(concrete).filter((p) => normalizeApiPath(p) !== p);
    expect(changed).toEqual([]);
  });

  // The table lists canonical URL forms. "slash-ful only" = canonical form has a slash and no
  // slash-less twin is listed. (The backend also accepts the slash-less twin for router routes.)
  const set = new Set(routes);
  const slashfulOnly = routes.filter((r) => r.endsWith('/') && !set.has(r.slice(0, -1)));
  const slashlessOnly = routes.filter((r) => !r.endsWith('/') && !set.has(`${r}/`));
  const bothForms = routes.filter((r) => !r.endsWith('/') && set.has(`${r}/`));

  it('canonicalizes to the trailing-slash form for every route whose canonical form has one', () => {
    const wrong = slashfulOnly.map(concrete).filter((p) => normalizeApiPath(p.slice(0, -1)) !== p);
    expect(wrong).toEqual([]);
    expect(slashfulOnly.length).toBe(427);
  });

  it('never adds a slash to a route that exists only without one (a slash there is a 404)', () => {
    expect(slashlessOnly.map(concrete).filter(isSlashlessRoute).length).toBe(slashlessOnly.length);
    expect(slashlessOnly.length).toBe(40);
  });

  it('accepts both forms where the backend registers both (project-scoped tree, 17 routes)', () => {
    expect(bothForms.length).toBe(17);
    for (const route of bothForms.map(concrete)) {
      expect(normalizeApiPath(route)).toBe(route);
      expect(normalizeApiPath(`${route}/`)).toBe(`${route}/`);
    }
  });
});

describe('normalizeApiPath', () => {
  it('keeps the query string and fragment', () => {
    expect(normalizeApiPath('/api/v1/departments?page=2&search=a/b')).toBe('/api/v1/departments/?page=2&search=a/b');
    expect(normalizeApiPath('/api/v1/departments/?page=2')).toBe('/api/v1/departments/?page=2');
    expect(normalizeApiPath('/api/v1/departments#x')).toBe('/api/v1/departments/#x');
  });

  it('does not touch slash-less families, files, absolute URLs or non-API paths', () => {
    expect(normalizeApiPath('/api/v1/platform/master-data/software')).toBe('/api/v1/platform/master-data/software');
    expect(normalizeApiPath('/api/v1/platform/master-data/software/abc/archive')).toBe('/api/v1/platform/master-data/software/abc/archive');
    expect(normalizeApiPath('/api/v1/platform/overview')).toBe('/api/v1/platform/overview');
    expect(normalizeApiPath('/api/organizations/projects/p1/shots')).toBe('/api/organizations/projects/p1/shots'); // both forms exist
    expect(normalizeApiPath('/api/v1/media/clip.mp4')).toBe('/api/v1/media/clip.mp4');
    expect(normalizeApiPath('https://cdn.example.test/api/v1/x')).toBe('https://cdn.example.test/api/v1/x');
    expect(normalizeApiPath('/health/')).toBe('/health/');
  });

  it('canonicalizes a slash-less write path', () => {
    expect(normalizeApiPath('/api/v1/tasks/abc123')).toBe('/api/v1/tasks/abc123/');
    expect(normalizeApiPath('/api/v1/tasks/abc123/bulk-assign')).toBe('/api/v1/tasks/abc123/bulk-assign/');
  });
});
