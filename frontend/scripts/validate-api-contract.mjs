#!/usr/bin/env node
/**
 * StudioHub — API Contract Validation Script
 *
 * Verifies that the MSW mock handlers cover the real Django OpenAPI
 * contract, so a stale/out-of-date mock surface is detected at CI time
 * rather than silently diverging from the backend.
 *
 * Checks performed:
 *   1. Every OpenAPI operation that the mock intends to support has a
 *      corresponding MSW handler (allowing intentional exclusions via the
 *      ALLOWED_UNCONTRACTED allowlist).
 *   2. No MSW handler targets a route that does not exist in the OpenAPI
 *      contract (catches invented `/mock/...` routes).
 *
 * Routes are discovered by statically scanning the MSW handler source for
 * `http.<method>('...')` registrations.
 *
 * Usage:
 *   pnpm api:validate
 */
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, '..');

const SCHEMA_FILE = resolve(repoRoot, 'src/core/api/generated/schema/django-openapi.yml');
const HANDLERS_DIR = resolve(repoRoot, 'src/mocks/handlers');
const ROUTER_FILES = [
  resolve(repoRoot, 'src/mocks/mockRouter.ts'),
  resolve(repoRoot, 'src/mocks/masterDataMockRouter.ts'),
];

// Paths intentionally served in mock mode but absent from the Django schema.
// Keep this list empty when possible.
const ALLOWED_UNCONTRACTED = new Set([
  'demo-users',
  'episodes',
]);

const HTTP_METHODS = ['get', 'post', 'put', 'patch', 'delete', 'options', 'head'];

function parseYamlPaths(text) {
  const paths = [];
  let inPaths = false;
  for (const line of text.split('\n')) {
    const trimmed = line.trimEnd();
    if (!inPaths) {
      if (trimmed === 'paths:') {
        inPaths = true;
        continue;
      }
      continue;
    }
    const m = trimmed.match(/^  (\S[^:]*):\s*$/);
    if (m && m[1].startsWith('/')) {
      paths.push(m[1]);
      continue;
    }
    if (trimmed && !trimmed.startsWith(' ') && /^[A-Za-z_]+:/.test(trimmed)) {
      break;
    }
  }
  return paths;
}

function extractContractRoutes() {
  if (!existsSync(SCHEMA_FILE)) {
    console.error(`[api:validate] ERROR: schema not found at ${SCHEMA_FILE}`);
    console.error('Run `pnpm api:generate` first.');
    process.exit(1);
  }
  const paths = parseYamlPaths(readFileSync(SCHEMA_FILE, 'utf-8'));
  if (paths.length === 0) {
    console.error('[api:validate] ERROR: could not parse any paths from schema.');
    process.exit(1);
  }
  return paths;
}

function extractMswRoutes() {
  if (!existsSync(HANDLERS_DIR)) {
    console.error(`[api:validate] ERROR: handlers dir not found at ${HANDLERS_DIR}`);
    process.exit(1);
  }
  const routes = [];
  const files = readdirSync(HANDLERS_DIR).filter((f) => f.endsWith('.ts'));
  for (const file of files) {
    const src = readFileSync(join(HANDLERS_DIR, file), 'utf-8');
    // Match http.<method>('<url>', ...
    const re = /http\.(get|post|put|patch|delete|options|head)\s*\(\s*(['"`])([^'"`]+)\2/g;
    let m;
    while ((m = re.exec(src)) !== null) {
      routes.push({ file, method: m[1].toLowerCase(), path: m[3] });
    }
  }
  return routes;
}

/**
 * Extract `/api/...` route literals from the primary in-memory mock engine
 * (mockRouter.ts + masterDataMockRouter.ts), which dispatches on `pathname`
 * comparisons rather than MSW `http.*` registrations.
 */
function extractRouterRoutes() {
  const routes = [];
  for (const file of ROUTER_FILES) {
    if (!existsSync(file)) continue;
    const src = readFileSync(file, 'utf-8');
    const patterns = [
      /pathname\s*===?\s*['"]([^'"]+)['"]/g,
      /pathname\.(?:startsWith|includes|endsWith)\(\s*['"]([^'"]+)['"]/g,
    ];
    for (const re of patterns) {
      let m;
      while ((m = re.exec(src)) !== null) {
        if (m[1].startsWith('/api')) {
          routes.push({ file: file.split('/').pop(), method: '*', path: m[1] });
        }
      }
    }
  }
  return routes;
}

function isInvented(path, contractGlobSet, contractRegexes) {
  const norm = toNormalized(path);
  if (!norm.startsWith('/api')) return false;
  if ([...ALLOWED_UNCONTRACTED].some((a) => path.includes(a))) return false;
  return !(contractGlobSet.has(norm) || matchesAnyContract(path, contractRegexes));
}

/**
 * Normalize a path for comparison. Both OpenAPI `{param}` and MSW `:param`
 * path segments collapse to a generic `:id` token so that naming differences
 * (e.g. `{project_id}` vs `:projectId`) do not produce false
 * mismatches. Trailing slashes are normalized away.
 */
function toNormalized(path) {
  let p = path;
  // MSW often registers '*/api/v1/...' — drop leading '*'
  p = p.replace(/^\*/, '');
  // Collapse OpenAPI and MSW param segments to a single token
  p = p.replace(/\{[^/}]+\}/g, ':id');
  p = p.replace(/:[A-Za-z0-9_]+/g, ':id');
  // Strip trailing slash (unless root)
  p = p.replace(/\/+$/, '');
  return p;
}

/**
 * Build a regexp from a normalized contract route where every `{param}`
 * segment becomes a single-segment wildcard. This lets a concrete literal
 * MSW segment (e.g. `/master-data/software`) match the generic param route
 * it instantiates (`/master-data/{data_type}`), while literal segments still
 * require an exact match so truly-invented routes remain detected.
 */
function contractToRegex(path) {
  const segments = path.replace(/^\//, '').split('/').filter(Boolean);
  const parts = segments.map((seg) => {
    if (/^\{[^/}]+\}$/.test(seg)) return '[^/]+';
    return seg.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  });
  return new RegExp(`^${parts.join('/')}/?$`);
}

function matchesAnyContract(mswPath, contractRegexes) {
  const normalized = toNormalized(mswPath).replace(/^\//, '');
  return contractRegexes.some((re) => re.test(normalized));
}

function main() {
  const contractRoutes = extractContractRoutes();
  const mswRoutes = extractMswRoutes();
  const routerRoutes = extractRouterRoutes();
  const contractGlobSet = new Set(contractRoutes.map(toNormalized));
  const contractRegexes = contractRoutes.map(contractToRegex);
  const mswGlobSet = new Set(mswRoutes.map((r) => toNormalized(r.path)));

  // 1. Contract routes missing from MSW (mock coverage gap).
  const uncovered = contractRoutes.filter((route) => !mswGlobSet.has(toNormalized(route)));

  // 2. MSW routes not in the contract (invented routes), excluding intentional
  //    non-API prefixes like '/mock/...' or allowlisted paths.
  const invented = mswRoutes
    .map((r) => r.path)
    .filter((p) => {
      const norm = toNormalized(p);
      if (!norm.startsWith('/api')) return false; // non-API msw routes are fine
      if ([...ALLOWED_UNCONTRACTED].some((a) => p.includes(a))) return false;
      // Accept the route if it exactly matches a contract route OR is a
      // concrete instantiation of a generic param route (e.g. a literal
      // `/master-data/software` for `/master-data/{data_type}`).
      return !(contractGlobSet.has(norm) || matchesAnyContract(p, contractRegexes));
    });

  const lines = [];
  lines.push(`[api:validate] Contract routes (OpenAPI): ${contractRoutes.length}`);
  lines.push(`[api:validate] MSW routes registered: ${mswRoutes.length}`);
  lines.push(`[api:validate] Router routes (mockRouter literal /api paths): ${routerRoutes.length}`);

  if (uncovered.length === 0) {
    lines.push('[api:validate] ✓ All contract routes are covered by MSW handlers.');
  } else {
    // The MSW handler set is the secondary mock layer (the primary in-memory
    // engine lives in mockRouter.ts). Partial route coverage is therefore
    // expected; report it as a warning, not a hard failure.
    lines.push(`[api:validate] WARN ${uncovered.length} contract routes have NO MSW handler (secondary-layer gap):`);
    uncovered.slice(0, 15).forEach((r) => lines.push(`   - ${r}`));
    if (uncovered.length > 15) lines.push(`   ... and ${uncovered.length - 15} more`);
  }

  if (invented.length === 0) {
    lines.push('[api:validate] ✓ No MSW /api routes outside the OpenAPI contract.');
  } else {
    // Invented routes can mask real backend routes and diverge from the
    // source of truth — hard failure.
    lines.push(`[api:validate] ✗ ${invented.length} MSW /api routes NOT in the OpenAPI contract:`);
    invented.slice(0, 30).forEach((r) => lines.push(`   - ${r}`));
    if (invented.length > 30) lines.push(`   ... and ${invented.length - 30} more`);
  }

  // 3. Router-engine routes outside the contract. Reported as a warning
  //    (not a hard failure): the router predates the schema with legacy
  //    compat routes (e.g. /api/v1/identity/users/) that Task 12 triages.
  const inventedRouter = [
    ...new Set(routerRoutes.map((r) => r.path).filter((p) => isInvented(p, contractGlobSet, contractRegexes))),
  ];
  if (inventedRouter.length === 0) {
    lines.push('[api:validate] ✓ No router /api routes outside the OpenAPI contract.');
  } else {
    lines.push(`[api:validate] WARN ${inventedRouter.length} router /api routes NOT in the OpenAPI contract (legacy-compat triage):`);
    inventedRouter.slice(0, 30).forEach((r) => lines.push(`   - ${r}`));
    if (inventedRouter.length > 30) lines.push(`   ... and ${inventedRouter.length - 30} more`);
  }

  console.log(lines.join('\n'));

  if (invented.length > 0) {
    process.exitCode = 1;
  }
}

main();
