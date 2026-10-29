# Frontend Mock Removal Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove all frontend mock API/data and make frontend use real Django REST API only.

**Architecture:** Rest-only repository layer (REST adapters + ApiClient ky) with no mode switching; UI components consume real hooks with loading/empty/error states; entity registries become type-metadata only.

**Tech Stack:** React 19, Vite 6, TypeScript, TanStack Query, ky ApiClient, Django REST API (/api/v1/*), Vitest, Playwright.

**Spec:** User request 2026-10-01 — remove frontend mock API/data completely, keep same behavior/screens/fields/mapping/flows, verify Frontend → Real API Client → Django REST API → Database.

## Global Constraints

- Keep same frontend behavior, screens, fields, API response mapping, user flows.
- Do not change frontend API contract unnecessarily.
- Do not recreate mock data.
- Do not modify backend unless endpoint genuinely missing.
- Do not redesign UI or modify unrelated functionality.

## Review Focus

- Empty workspace/project on fresh login shows empty state not stale proj-001 — reasonable person expects no fixture data.
- Entity search with no backend results returns empty list, not mock fallback.
- Audit pages on 403/500 show error state, not mock table.
- Project switcher with zero projects shows empty selector, not NK99 fixture.
- Login page shows no demo workspaces; auth goes to /api/v1/auth/* only.

---

### Task 1: Fix ApiClient syntax + rest-only config/factory/registry

**Files:**
- Modify: `src/api/client/ApiClient.ts:15`
- Modify: `src/api/repositories/config.ts`
- Modify: `src/api/repositories/factory.ts`
- Modify: `src/api/repositories/index.ts`
- Modify: `src/main.tsx`

**Interfaces:**
- Consumes: `VITE_API_URL` env, `ky` ApiClient.
- Produces: `getApiBaseUrl(): string`, `getApiConfig(): {baseUrl:string}`, REST-only `RepositoryFactory`, `repositoryRegistry` without mode.

- [ ] **Step 1: Fix ApiClient field syntax**

```ts
// before (broken):
let isRefreshing = false;
// after:
private isRefreshing = false;
```

Run: `npx tsc --noEmit --skipLibCheck src/api/client/ApiClient.ts` (expect no syntax error for this file).

- [ ] **Step 2: Rewrite config.ts rest-only**

```ts
// remove ApiMode, getApiMode, isMockMode, isRestMode, setApiMode, resetApiMode, shouldEnableMSW, RUNTIME_MODE_OVERRIDE_KEY
// keep getApiBaseUrl() and getApiConfig() returning { baseUrl: string }
export function getApiBaseUrl(): string { /* VITE_API_URL trim */ }
export function getApiConfig(): { baseUrl: string } { return { baseUrl: getApiBaseUrl() }; }
```

- [ ] **Step 3: Simplify factory.ts — drop mode param**

```ts
static createProjectRepository(): IProjectRepository { return new RESTProjectAdapter(); }
// same for task, asset, shot, organization, auth, delivery, publishing; createAll() no args
```

- [ ] **Step 4: Simplify index.ts registry — remove syncMode/switchMode/mode**

```ts
class RepositoryServiceRegistry { private bundle = RepositoryFactory.createAll(); get project() { return this.bundle.project; } /* etc */ }
```

- [ ] **Step 5: Update main.tsx bootstrap log to not reference mode**

```ts
const config = getApiConfig();
logger.info('Bootstrap', `StudioHub initialized (Base URL: "${config.baseUrl || '/'}")`);
```

- [ ] **Step 6: Verify**

Run: `npx tsc --noEmit 2>&1 | head -n 50`
Expected: no errors in api/repositories/*, ApiClient.

### Task 2: Workspace + production stores to real backend

**Files:**
- Modify: `src/core/workspace/useWorkspaceStore.ts:12,83-97`
- Modify: `src/core/production/useProductionStore.ts`
- Modify: `src/core/production/ProductionContext.tsx`

**Interfaces:**
- Consumes: real `projectRepository`, `organizationId`, `projectId` from backend.
- Produces: empty initial workspace, null project/show until user selects real project.

- [ ] **Step 1: useWorkspaceStore — empty default**

```ts
const defaultPrimary: EntityReference = { id: '', type: 'project', title: 'Workspace' };
const initialDefaultTab: WorkspaceTab = { id: 'tab-default-01', title: 'Workspace', primary: defaultPrimary, /* ... */ };
```

Remove `isMockMode` import.

- [ ] **Step 2: useProductionStore — null/empty defaults, drop mockShows/mockProjects**

```ts
activeProjectId: null,
activeShowId: null,
recentProjectIds: [],
favoriteProjectIds: [],
// setActiveProject: just set ids, no mockShows lookup
// resetActiveProjectForOrg: if activeProjectId set, keep it; else null (no mock fallback). Clear show.
```

- [ ] **Step 3: ProductionContext — synthesize show from real ids only**

```ts
// remove mockDatabase/mockProjects/mockShows references
// show = activeShowId ? { id: activeShowId, project_id: projectId, organization_id: organizationId, ...minimal } : (projectId ? { id: `show-${projectId}-main`, project_id: projectId, ... } : null)
// fallback useProductionContext outside provider: derive from activeProjectId/activeShowId only, no mock lookup
```

- [ ] **Step 4: Verify**

Run: `npx tsc --noEmit 2>&1 | grep -E "workspace|production" | head -n 20`
Expected: no errors.

### Task 3: Entity registries — type metadata only, no mock DB

**Files:**
- Modify: `src/core/workspace/entityRegistry.ts`
- Modify: `src/shared/relationships/entityRegistry.ts`
- Modify: `src/core/activity/activityService.ts` (remove mock import if any)

**Interfaces:**
- Consumes: `EntityType`, `EntityReference`.
- Produces: `resolveEntity()` returns null without backend, `searchUniversalEntities()` returns [], `resolveEntityRaw()` returns null, `searchAllEntities()` returns [], `getRelatedEntities()` returns [].

- [ ] **Step 1: Strip mock imports, replace resolvers with real-API stubs**

```ts
// delete: import { mockOrganizations, ... } from '@/mocks/db/...'
// resolveEntity(type,id): return null (real detail loaded via hooks)
// searchUniversalEntities(): return []
// resolveEntityRaw(): return null
// searchAllEntities(): return []
// getRelatedEntities(): return []
// keep ENTITY_CONFIGS, formatEntityType, entityRegistry singleton shape
// keep local mockSequences/mockNotes/mockDeliveries? DELETE — replace with [] typed arrays or remove exports; update callers to handle empty
```

- [ ] **Step 2: Verify callers**

Run: `grep -rn "resolveEntity\|searchUniversal\|getRelatedEntities\|mockSequences\|mockNotes" src --include="*.tsx" --include="*.ts" | grep -v test | head -n 30`
Expected: callers handle null/[] (empty states).

### Task 4: Production + org tabs — real hooks only

**Files:**
- Modify: `src/modules/production/components/project-tabs/ProjectActivityTab.tsx`
- Modify: `src/modules/production/components/project-tabs/ProjectOverviewTab.tsx`
- Modify: `src/modules/production/components/project-tabs/ProjectResourcesTab.tsx`
- Modify: `src/modules/production/components/project-tabs/ProjectScheduleTab.tsx`
- Modify: `src/modules/production/components/project-tabs/ProjectDeliveriesTab.tsx`
- Modify: `src/modules/organization/components/client-tabs/ClientOverviewTab.tsx`
- Modify: `src/modules/organization/components/vendor-tabs/VendorOverviewTab.tsx`
- Modify: `src/core/masterData/useMasterData.ts:847-874`
- Modify: `src/layouts/ProjectSwitcher.tsx`
- Modify: `src/layouts/Header.tsx`, `src/layouts/Breadcrumbs.tsx`, `src/layouts/AppLayout.tsx` (remove mock imports)

- [ ] **Step 1: Replace mock db imports with real repository/hook data**

```tsx
// delete: } from '@/mocks/db/production' / '@/mocks/db/organization'
// use existing hooks: useProjectDetail, useOrganizationDetail, useQuery projectRepository etc.
// loading → <DashboardSkeleton/>, error → <DashboardErrorState/>, empty → <DashboardEmptyState/>
// keep same fields/screens, map DRF response directly
```

- [ ] **Step 2: useMasterData seed — remove dynamic mock import**

```ts
// delete dynamic import('@/mocks/db/platformOrgSeed'); seed function becomes no-op or POSTs canonical roles to /api/v1/roles/ via REST; if backend has no seed endpoint, log and return
```

- [ ] **Step 3: ProjectSwitcher — real projects only**

```tsx
// remove isMockMode branch; const { data: projects } = useProjects(organizationId); empty → show empty selector
```

- [ ] **Step 4: Verify**

Run: `npx tsc --noEmit 2>&1 | head -n 30`

### Task 5: Audit pages, auth, org data, TestingPage — drop mock branches

**Files:**
- Modify: `src/modules/audit/pages/BackgroundJobsPage.tsx`, `ApiRequestsPage.tsx`, `AuditLogsPage.tsx`, `ChangeLogsPage.tsx`, `ErrorLogsPage.tsx`, `LoginHistoryPage.tsx`, `TracksPage.tsx`
- Modify: `src/modules/auth/hooks/useDemoUsers.ts`, `src/modules/auth/pages/LoginPage.tsx`
- Modify: `src/modules/organization/hooks/useOrganizationData.ts:157`
- Modify: `src/pages/TestingPage.tsx`
- Modify: `src/core/testing/TestRunnerEngine.ts`, `src/core/testing/parity/parityHarness.ts` (remove mock refs)
- Modify: `src/modules/settings/components/DatabaseSchemaSection.tsx`, `src/modules/platform/health/apiHealthData.ts`, `src/shared/components/CommandPalette.tsx`

- [ ] **Step 1: Audit pages — remove isMockMode UI**

```tsx
// delete import { isMockMode }...
// {isMockMode() && (...mock banner...)} → delete block
// isMockMode() ? (mockRow) : (realRow) → keep realRow only
// data comes from existing audit hooks (useAuditLogs etc.) → loading/empty/error states already present
```

- [ ] **Step 2: Auth demo — disable**

```ts
// useDemoUsers: enabled: false, return [] (backend /api/v1/auth/demo/ does not exist)
// LoginPage: const showDemoWorkspaces = false; hide demo section (keep markup commented out or conditional false, no UI change otherwise)
```

- [ ] **Step 3: useOrganizationData — remove mock early-return, always call organizationRepository.getById/list via REST**

- [ ] **Step 4: TestingPage — remove mockScenarioManager section**

```tsx
// delete MockScenarioType/mockScenarioManager imports + state + handler + UI card "Inject deterministic server error..." → replace with note "Error scenarios run against live DRF validation"
// keep rest of testing harness (real API test runner)
```

- [ ] **Step 5: Verify**

Run: `npx tsc --noEmit 2>&1 | head -n 30`

### Task 6: Config/deps/server/test setup cleanup

**Files:**
- Modify: `package.json`
- Modify: `server.ts:56-68`
- Modify: `vitest.setup.ts`
- Modify: `vitest.config.ts`
- Modify: `.env`, `.env.example`
- Delete (if resurrected): `public/mockServiceWorker.js`, `public/studiohub-mock-db-schema.*`

**Interfaces:**
- Consumes: none.
- Produces: no MSW, no mock scripts, proxy only to Django.

- [ ] **Step 1: package.json**

```json
// delete scripts: mock:seed, mock:reset, mock:clear, mock:inspect
// delete dependency: "msw": "^2.15.0"
```

Run: `pnpm install` (or npm) to update lockfile.

- [ ] **Step 2: server.ts — delete /api/mock-db-schema/* routes (3 handlers)**

- [ ] **Step 3: vitest.setup.ts — delete mock token seeding block, keep ResizeObserver/clipboard shims**

- [ ] **Step 4: vitest.config.ts — remove 'src/mocks/**' from coverage exclude**

- [ ] **Step 5: .env/.env.example — remove VITE_API_MODE, VITE_USE_MSW; keep VITE_API_URL, DJANGO_HEALTH_PATH**

- [ ] **Step 6: Verify**

Run: `grep -rn "msw\|mock" package.json server.ts vitest.setup.ts .env.example | head -n 20`
Expected: no hits (except comments).

### Task 7: Broken tests referencing deleted mocks

**Files:**
- Delete or rewrite: `src/features/dashboard/__tests__/ProjectDashboard.test.tsx` (imports deleted buildProjectDashboardMock)
- Delete or rewrite: `src/features/organizations/__tests__/**/Organization*.test.tsx` importing `@/test/mocks/factories/*`, `@/test/mocks/server`, `dispatchMockRequest`
- Modify: `src/core/activity/__tests__/episodeActivity.test.ts` (comment referencing src/mocks)
- Modify: `src/modules/production/components/project-tabs/__tests__/Shot*.test.tsx`, `src/modules/shots/...` (mockReset is vitest fn — keep; only fix mockState imports if they reference deleted mocks)

- [ ] **Step 1: List broken tests**

Run: `npx tsc --noEmit 2>&1 | grep "test" | head -n 30; npx vitest run --reporter=basic 2>&1 | tail -n 50`

- [ ] **Step 2: For each test importing non-existent path, either delete file (if mock-only parity) or replace factory with inline fixtures + vi.mock('@/api/client/ApiClient')**

```ts
// example replacement:
vi.mock('@/api/client/ApiClient', () => ({ apiClient: { get: vi.fn(), post: vi.fn() } }));
const fakeOrg = { id: 'org-1', name: 'Apex', code: 'APEX', status: 'active' };
```

Keep same assertions for loading/empty/error/pagination/filtering/CRUD where applicable, but sourced from mocked transport (unit isolation) not mock DB.

- [ ] **Step 3: Verify**

Run: `npx vitest run 2>&1 | tail -n 20`
Expected: all remaining tests pass; no "Failed to resolve import .../mocks/..." errors.

### Task 8: Final verification — build, typecheck, tests, API audit

- [ ] **Step 1: Typecheck**

Run: `npx tsc --noEmit`
Expected: PASS (0 errors).

- [ ] **Step 2: Build**

Run: `npm run build` (vite build + server bundle)
Expected: PASS, no "@/mocks" resolve errors.

- [ ] **Step 3: Unit tests**

Run: `npx vitest run`
Expected: PASS.

- [ ] **Step 4: API audit — all requests go to Django**

Run: `grep -rn "from '@/mocks\|from \"@/mocks\|dispatchMockRequest\|mockScenario\|isMockMode\|getApiMode\|shouldEnableMSW\|setupWorker\|setupServer\|msw" src --include="*.ts" --include="*.tsx" | grep -v "__tests__" | grep -v ".test."`
Expected: empty. Plus `grep -rn "apiClient\.\(get\|post\|put\|patch\|delete\)\|projectRepository\|organizationRepository\|/api/v1/" src --include="*.ts" --include="*.tsx" | head` shows real endpoints.

- [ ] **Step 5: Report 1-5**

Report: mock files removed, usages replaced, deps/config removed, real endpoints used, tests/build result.
