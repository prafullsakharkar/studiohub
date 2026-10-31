# Phase 20: the legacy data layer removed: verification

Branch `sync/phase-20-bulk-typed-api` (from `develop` at `1c097858`, which holds Phases 14 to 19 and CR-32 to CR-35), **not pushed, not merged**. No backend file was touched.

## 1. What was there

`src/api/repositories` (1,276 lines): an interface per entity, six REST adapters over a base class that stringified a request body only to parse it again, a factory and a proxy registry. Three bulk managers (shots, assets, tasks) and the project, auth and (dead) entity hooks went through it via five service classes. Only two of the five adapters' services were reachable: the auth service and the project service; the shot, asset and task services were reached only by the three `useBulk*` hooks, and the other nine hooks (`useShots`, `useShot`, `useShotMutations`, the same for assets and tasks) had no importer outside their own barrels.

## 2. What it is now

| Before | After |
|---|---|
| `RESTAuthAdapter` + `AuthService` over `IAuthRepository` | `authApi` (`src/api/identity/auth.ts`): login, MFA challenge, logout, me, profile, change, forgot and reset password. Same routes and bodies; `AuthService` keeps the token handling. A contract test pins each call |
| `RESTShotAdapter` / `RESTAssetAdapter` / `RESTTaskAdapter` + three services | `bulkRoutes()` (`src/api/production/bulkRoutes.ts`): the five bulk routes of each entity, posting the managers' own requests and reading their answers back. The managers are unchanged |
| `RESTProjectAdapter` + `ProjectService` | `ProjectService` calling `apiClient` directly (same routes, empty query values dropped as before) |
| `repositories/config.ts` | `src/api/client/config.ts` |
| `useShots`, `useShot`, `useShotMutations`, `useAssets`, `useAsset`, `useAssetMutations`, `useTasks`, `useTask`, `useTaskMutations` and their three services | removed (no importer) |
| `api/client/upload.ts` and its test | removed (its last user was the attachments uploader removed in Phase 18) |
| the delivery and publishing adapters and interfaces | removed (Phases 8 and 9 had already moved both areas to typed modules; nothing imported them) |

Net: 51 files, +267 / −2,285 lines.

## 3. Evidence

| Gate | develop | Now |
|---|---|---|
| `tsc --noEmit` | 0 | **0** |
| Unit tests | 102 files / 1,029 | **102 files / 1,030** (+5 `authApi`, +4 bulk routes, −1 episodic test of the removed adapter, −7 upload tests with the removed helper) |
| `pnpm build` | OK | **OK** |
| Biome (`src`) | 1 error / 1197 warnings | **1 error (the same) / 1083 warnings** |
| Live vitest, fresh seed each | | `auth.live` **18 pass**, `restricted.live` **4 pass**, `bulkRoutes.live` **3 pass** (shots: check, create with a duplicate beside a good row, archive, restore; assets: create, check, archive, restore; tasks: create, check) |
| Playwright role smoke (6 roles + phone width) | 7 of 7 | **7 of 7 pass** (46.1 minutes; the machine was slow, the backend limit is now 90 minutes) |
| Mutation checks | | **13 of 13 caught**: nine on `authApi` (the login, MFA, logout, forgot, reset and profile routes; the logout body; the change-password route; login sending extra fields) and four on the bulk routes (archive posting to restore; check-existence dropping its payload; tasks posting to shots; update posting to create). Four auth routes had no assertion at first, so the contract test was added before the mutations were re-run |

## 4. Findings, and what was not done

- **The project detail page is another legacy workspace.** `ProjectWorkspace` (939 lines) is still typed with the older `Project` shape. Pointing it at the typed `Project` of the API gives 21 compile errors, among them `banner_url` and `logo_url` (the API has neither) and a status "Completed" that no project can have (the statuses are In Progress, Pending Review, Approved, Archived, On Hold). Its list and detail data therefore still come through `ProjectService` with the legacy type. Rebuilding that page is the natural next phase; I did not guess.
- The bulk managers are unchanged: their request and answer shapes (`BulkCreateRequest`, `BulkOperationResponse`) are the legacy types and are exactly what the routes take and return (verified live). Moving them to the typed `BulkResult` would change their screens' logic for no defect.
- `types/production.ts` still holds the legacy entity types the managers and `ProjectWorkspace` use.

## 5. Questions for the owner

1. **Merge** `sync/phase-20-bulk-typed-api` into `develop` and push?
2. **Next:** rebuild the project workspace page (audit first, as for shots and assets), or one of the deferred items (scheduling week/day/timeline views, applying a chosen theme or locale, a delivery milestone picker, a leave-cancel endpoint, a checksum verification screen)?
