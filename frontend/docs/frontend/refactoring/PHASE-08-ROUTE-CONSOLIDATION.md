# Phase 08 — Route & Navigation Consolidation (audited + fixed 2026-09-23)

Method: extracted all 111 `<Route>` declarations, 292 internal link targets,
31 sidebar entries, 11 palette destinations, workspace tab configs, and all 73
`*Page.tsx` references; matched links against route patterns (params + query
aware); verified orphans/unreachables individually.

## 1. Canonical access points (one per capability)

- Live services: `/platform/health` (`/api-health` redirects, query-preserving).
- QA runner: `/testing` — **kept separate** (TestRunnerEngine vs live telemetry;
  different users/data; cross-linked, not merged).
- Access & RBAC: `/access` + `/organizations/:id/access/:section` (single
  workspace; platform vs org is a *scope*, not a second page). The org workspace
  links out to it (no duplicated RBAC UI). `/permissions` redirects.
- Audit: `/audit` (logs+activity), `/system-logs`, `/jobs` (legacy paths redirect
  with `?tab=` preserved).
- Platform Admin: `/platform/admin/:tab` incl. pipeline/theme/layout/database
  (`/settings`, `/platform/master-data*` redirect).
- Scheduling: `/scheduling` (`/calendar` redirects).

## 2. Findings

- Duplicate routes: **none**. Duplicate tabs: none (same tab names across entity
  workspaces carry different content — Phase 06). Orphan pages: **none** (73/73
  referenced). Redundant nav: none (sidebar 31, palette 11, all canonical).
- Legacy aliases (19 paths): intentional redirects, kept for bookmarks.
- `/shows/:showId`: deep-link-only entry (no inbound links), renders the project
  workspace — KEEP (zero cost, preserves shared show links).
- **Fixed: dead link** `ProjectResourcesTab` "People Directory" pointed to
  non-existent `/organization` → retargeted to `/people` (commit below).
- Tests: redirect suites (`canonicalRedirects`, `rbacCanonical`, `auditWorkspaces`)
  assert the alias→canonical mapping; no test references removed pages.

## 3. Removed-route handling (standard applied throughout)

Redirect (`PreserveQueryRedirect`/`TabRedirect`/`MasterDataRedirect`) →
internal references updated (sidebar/palette/header/person-overview) → tests
updated/added → obsolete nav entries + pages removed → suite/typecheck/lint/build
green. No dead routes remain; old URLs land on canonical equivalents with
tab/query state preserved.

## Verification

- Link audit re-run post-fix: zero static dead targets.
- `vitest` 377/377 · `tsc` 0 · `biome` 0.
