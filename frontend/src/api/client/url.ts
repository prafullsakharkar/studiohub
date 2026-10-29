/**
 * Trailing-slash rule for backend paths.
 *
 * Verified against the running backend (docs/sync, Phase 1): router-based routes accept a path
 * with or without the trailing slash (`GET /api/v1/departments` 200, `POST` 201, no redirect),
 * but 40 routes exist ONLY without one: `platform/master-data/*` and `platform/overview`.
 * `GET /api/v1/platform/master-data/software/` is a 404. The project-scoped tree
 * `/api/organizations/projects/{id}/*` is registered in both forms.
 *
 * So the one hard rule is "never add a slash to the slash-less families". For everything else we
 * canonicalize to the trailing-slash form (what OpenAPI and DRF's reverse() produce), so a path
 * is written one way in the codebase. Route table: docs/sync/samples/_misc/routes.json.
 */
const STRICTLY_SLASHLESS = ['/api/v1/platform/master-data', '/api/v1/platform/overview'];
const BOTH_FORMS = ['/api/organizations/projects/'];

const inFamily = (path: string, families: string[]) =>
  families.some((family) => path === family || path.startsWith(family.endsWith('/') ? family : `${family}/`));

/** Routes that must not get a trailing slash. */
export function isSlashlessRoute(path: string): boolean {
  return inFamily(path, STRICTLY_SLASHLESS);
}

/** Add the trailing slash a backend route needs; leave slash-less routes, files and absolute URLs alone. */
export function normalizeApiPath(url: string): string {
  if (!url.startsWith('/api/')) return url; // absolute URLs, non-API paths, other origins
  const hashAt = url.indexOf('#');
  const withoutHash = hashAt === -1 ? url : url.slice(0, hashAt);
  const queryAt = withoutHash.indexOf('?');
  const path = queryAt === -1 ? withoutHash : withoutHash.slice(0, queryAt);
  if (path.endsWith('/') || isSlashlessRoute(path) || inFamily(path, BOTH_FORMS)) return url;
  const lastSegment = path.slice(path.lastIndexOf('/') + 1);
  if (lastSegment.includes('.')) return url; // a file, not a route
  return `${path}/${url.slice(path.length)}`;
}
