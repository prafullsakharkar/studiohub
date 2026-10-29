# Removed Features — Dependency Audit (2026-09-22)

Scope: complete removal of Global Search, Knowledge Hub, AI Workspace,
Automation Hub, Integration Hub, Analytics from the StudioHub frontend.
Source of truth: the repository as inspected (no filename assumptions).

## 1. Module (REMOVE entirely)

| Path | Files | External importers |
|---|---|---|
| `src/modules/intelligence/` | 35 (pages 6, components 18+graph modal, hooks 4, services 4, index) | `src/routes/AppRoutes.tsx` only |

No other module, hook, service, or component outside `src/modules/intelligence`
imports from it (verified by repo-wide grep). Safe to delete wholesale after
detaching routes + sidebar + palette + permissions + mocks.

Note: `src/modules/workflows` (WorkflowStudio, AutomationRuleBuilderModal) and
`src/types/workflow.ts` are a SEPARATE, retained system — do not touch.

## 2. Routes & navigation (REMOVE entries, KEEP shells)

| Location | Action |
|---|---|
| `src/routes/AppRoutes.tsx:11,375-391` | REMOVE 10 routes (`/search`, `/knowledge`, `/knowledge/:id`, `/ai`, `/copilot`, `/intelligence`, `/analytics`, `/integrations`, `/automations`) + intelligence import; KEEP file |
| `src/layouts/Sidebar.tsx:297-360` | REMOVE `INTELLIGENCE` section (6 items); KEEP file and all other sections |
| `src/core/permissions/routePermissionsRegistry.ts:346-382` | REMOVE 6 route entries (`/search`, `/knowledge`, `/ai`, `/analytics`, `/integrations`, `/automations`); KEEP file |
| `src/layouts/Header.tsx` | KEEP palette trigger (shared); adjust trigger placeholder copy |

Removed URLs must fall through to the app's existing not-found behavior
(verified: no other route depends on these paths).

## 3. Command Palette (REFACTOR — keep shell + kept commands)

`src/shared/components/CommandPalette.tsx` (1,304 lines) is mixed:
- REMOVE: global-search system (searchResults memo ~685, result mapping ~736-766,
  Global Search tab UI ~923-1060) + 6 hub commands (Global Full-Text Search ~518,
  Knowledge Hub ~532, AI Assistant ~546, Analytics ~560, Integration Hub ~574,
  Automation Hub ~588).
- KEEP: palette shell, CRUD commands (~183-336), Open navigation commands
  (~338-462), admin/dev commands (~479-507), keyboard handling, all other UI.

## 4. Workspace (KEEP — no exclusive registrations found)

No Knowledge/AI/Automation/Analytics/Integration workspace registrations exist
in the shared workspace system (`Workspace`, `ContextBar`, `WorkspaceTabs`,
panels, `EntityDrawer`, persistence all retained with zero changes).

## 5. API + mocks (REMOVE exclusive, KEEP shared)

| Location | Action |
|---|---|
| `src/mocks/db/intelligence/` (ai, automations, integrations, knowledge, search, analytics — 2,843 lines) | REMOVE dir |
| `src/mocks/mockRouter.ts` intelligence branches (~4042–4590), analytics branches (~6585–6591), automations branches (~6890–6936) + dead imports (~60–80) | REMOVE branches/imports; KEEP router |
| `src/mocks/handlers/analyticsHandlers.ts` | REMOVE 2 analytics endpoints; KEEP `/api/v1/organization/` endpoint |
| `src/mocks/db/analytics/metrics.ts` + `src/types/analytics.ts` | REMOVE — zero consumers outside mocks (dashboard does not use them) |
| `src/mocks/db/seed.ts:11,163-164` | REMOVE `productionKpis`/`departmentProgress` seed wiring |
| `src/types/intelligence.ts`, `src/types/automations.ts`, `src/types/integrations.ts` | REMOVE — consumers are only intelligence mocks/pages/components |
| `src/types/workflow.ts` | KEEP — used by retained `src/modules/workflows` |
| `src/core/api/generated/openapi.ts` | KEEP — generated backend contract, not frontend code |
| `dcc_integrations` in project payload (`mockRouter.ts:813`) | KEEP — unrelated DCC-plugin data, not Integration Hub |

## 6. Permissions (REMOVE entries, KEEP engine)

| Location | Action |
|---|---|
| `src/core/permissions/permissionCatalog.ts` | REMOVE 9 entries: `page.search`, `page.knowledge`, `page.ai`, `page.analytics`, `page.integrations`, `page.automations`, `analytics.view`, `integrations.view`, `automations.view`; KEEP file + engine |
| `src/core/permissions/systemRoles.ts` | REMOVE 5× `analytics.view`+`page.analytics` pairs (lines ~196, 305, 470, 535, 1773); KEEP file |
| `src/core/access/domainPermissions.ts` | REMOVE 3 entries (`dp-aut-view`, `dp-int-view`, `dp-anl-view`); KEEP file (drives retained access UI) |
| `src/layouts/Sidebar.tsx` | REMOVE `permissions: ['automations.view'/'integrations.view'/'analytics.view']` with nav items |

Verified no remaining-module references to the removed codes (only the files above).

## 7. Tests (REMOVE exclusive, KEEP entity coverage)

| Location | Action |
|---|---|
| `e2e/search-filter.spec.ts` | REMOVE global-palette test; KEEP project/entity filter tests in the same file (whole e2e suite later removed) |
| No unit tests exclusively cover intelligence (verified) | — |
| Regression: existing suites (auth/org/platform/production/audit) must stay green | — |

## 8. Explicit KEEP list (do not touch)

`src/modules/workflows`, `src/types/workflow.ts`, CommandPalette shell + kept
commands, Header palette trigger, entity-local search/filter inputs,
`src/shared/workspace/*`, notifications/activity/audit infrastructure,
`src/core/permissions` engine files (entries only), docs (classified as
documentation in the final scan), `dcc_integrations` payload data.

## 9. Dependencies

No `package.json` dependency is exclusive to the removed features
(verified: no AI/ML, chart, or search-index libraries in direct use by
intelligence code paths beyond shared React/query/lucide). Remove none;
run validation after removal.
