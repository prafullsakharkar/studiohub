# Phase 09 — File Reduction (dead-code audit, executed 2026-09-23)

Method: full import graph over 868 TS/TSX files (static `import`/`export…from`,
dynamic `import()`, barrel re-exports) with BFS reachability from 73 entries
(`main`, `App`, all route fragments, all test files). 852 reachable, 16
unreachable — each of the 16 individually verified against: tests, registries,
route tables, `App`/`main` bootstrap, scripts, `docs`, generation provenance,
and same-directory composition before any deletion. tsc + suite + Biome + build
all green after.

## Files before / removed / remaining

- Files before (tracked TS/TSX): **877** (868 in `src` + 9 scripts/root).
- Files removed: **12** (all in `src`).
- Files merged / renamed: 0 in this phase (merges belong to Phases 04–08).
- Files remaining: **865** tracked TS/TSX.
- Verification: `vitest` 377/377 · `tsc` 0 · `biome` 0 · `vite build` ok.

Removed (each zero-ref incl. tests, dynamic imports, registries, config):

| File | Why safe |
|---|---|
| `shared/utils/decimal.ts` | No references anywhere (`cn`/`mediaUtils` live via deep imports) |
| `shared/utils/index.ts` | Barrel, 0 importers |
| `shared/layouts/index.ts` | Barrel, 0 importers (`PageLayout` used deep) |
| `shared/components/tabs/index.ts` | Barrel, 0 importers (deep imports live) |
| `core/api/index.ts` | Barrel, 0 importers (error-handler/notify used deep) |
| `core/api/generated/index.ts` | Barrel only; generated sources KEPT (generation-checked, rule honored) |
| `layouts/ShowSwitcher.tsx` | Full component, never mounted, no test/registry refs |
| `modules/production/hooks/useProject.ts` | Superseded singular hook; barrel + pages use `useProjects` |
| `shared/relationships/RelationshipList.tsx` + `RelationshipPanel.tsx` | Complete unused components (relationship UI served by siblings) |
| `shared/stores/useModalStore.ts` | All modals use local state; nothing reads the store |
| `shared/stores/useThemeStore.ts` | `ThemeProvider` owns theme state via `useState` |

## On the 300-file target (honest accounting)

Correctness over count, per the brief: reachability proves **852/868 files are
live** — the codebase is densely connected, and Phases T0–04 already removed the
known-dead code (dead repositories, interfaces, matrices, wrappers). Verified
removable now: **12**. The 300 target is not achievable by dead-code deletion
without deleting live features; it would require scope decisions (retiring whole
domains, collapsing the 3 mock paths, unifying the dual test trees, adopting the
CRUD kit repo-wide so ~15 ad-hoc tables/managers dissolve) — each a behavior or
product decision, itemized as T2/T3 follow-ups, not taken here.

## Estimated duplication removed (this phase)

- ~1,100 lines of unreferenced code (stores, unused components, barrels).
- One unmounted layout component (`ShowSwitcher`) that implied show-switching UX
  that does not exist — removes a false affordance for future readers.

## Remaining candidates (explicitly NOT deleted, with reason)

- `openapiTypeChecks.ts`: tsc-evaluated contract guard (active verification infra).
- All `generated/*` sources: regeneration-owned (`scripts/generate-api-contract.mjs`).
- `DashboardPage` wrapper, `useBulk*` wrappers, `IBaseRepository` alias: live
  compatibility shims with importers.
- Redirect helpers (`PreserveQueryRedirect`/`TabRedirect`/`MasterDataRedirect`):
  evaluated for unification — kept separate (route-param vs query-param mechanics
  differ; merging saves 0 files).
- Dual test trees, triple mock paths, ad-hoc tables: live; see T2/T3 follow-ups.
