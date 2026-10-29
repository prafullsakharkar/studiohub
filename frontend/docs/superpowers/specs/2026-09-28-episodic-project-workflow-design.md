# Episodic Project Workflow — Design Spec (Track 1: frontend)

Date: 2026-09-28. Status: user-approved design, pending spec review.
Program: two-track. This spec covers Track 1 (`studiohub-react`).
Track 2 (`../studiohub` Django) gets its own spec → plan cycle; its
starting input is the contract-delta appendix (§8).

## 1. Intent

Support Episodic projects (`Project → Episode → Sequence → Shot`) next to
unchanged Standard projects (`Project → Sequence → Shot`), reusing the
canonical Episode base that already exists. Extend first; replace only
where the base demonstrably cannot carry the requirement. No theme
changes, no parallel episodic-only component families, no changes to
unrelated production workflows.

Direction decisions (user-approved): extend canonical base (replace if
justified); every production entity carries its full id chain
(`episode_id`/`sequence_id`/`shot_id` mapped per entity); REST + mock both.

## 2. Current state (verified in source)

Exists: `Episode` type (`src/types/episodes.ts:3-23`), fixtures + seed +
schema + sqlite table/FKs (`src/mocks/db/production/episodes.ts`,
`schema.ts:102`, `seed.ts:167`, `schema-registry.ts` episodes entry with
unique `[project_id,code]`, FK `episodes.project_id→projects`,
`sequences.episode_id→episodes`), full episode CRUD + bulk mock routes
(`mockRouter.ts:1716-2019`), `EpisodeService/Repository/hooks`
(`modules/episodes/`), `ProjectEpisodesTab` full CRUD UI, workspace
episodes tab gated by `isEpisodicProject` (`ProjectWorkspace.tsx:287`),
sequences tab episode filter + required selector + badges
(`ProjectSequencesTab.tsx:33-415`), server-side episodic 400s on sequence
POST (`mockRouter.ts:2282`), shot POST (`:2742`) and shot bulk-create
(`:2473`), `episode.*/sequence.*/shot.*` RBAC permissions + role/tab
wiring (`permissionCatalog.ts:122-129,647-693`,
`routePermissionsRegistry.ts:835-845`), generic audit fan-out
(`audit-writer.ts:19-41`, `useXMutations` recordActivity),
`isEpisodicProject()` multi-alias sniffing (`types/projects.ts:71-83`),
`validate-api-contract.mjs` allowlist already exempts `episodes` (:38-42).

Missing (this spec's scope): explicit workflow control on project
create/edit (only `type` string select, `ProjectFormPage.tsx:235-250`);
episode picker in shot single-create modal (`ProjectShotsTab.tsx:1079-1235`)
and `ShotBulkManager` (props `ProjectShotsTab`-side, manager
`modules/shots/components/bulk/ShotBulkManager.tsx:30-36,79-257`) — both
400 on episodic projects; zero episode-linked seed sequences/shots
(`proj-102` episodes orphaned); no episode filter on shots list
(`mockRouter.ts:2378`) and episode-blind `check-existence`; no validation
on PATCH (cross-episode/project moves possible); `MockShotAdapter`
bypasses episodic checks; sequence bulk-create has no episodic branch
(`mockRouter.ts:2067`); sqlite FK map lacks `shots.episode_id`,
`shots.sequence_id`, `sequences.project_id` (`schema-registry.ts:28-43`);
migrations v4→v5 backfill shows only, no episodes (`migrations.ts:199`);
`activityService.resolveScoping` + `ActivityResourceType` omit episode;
no episodic unit/E2E tests; verify during implementation that the
`showId`-gated `enabled` flags in `useProjectSequences/Shots`
(`useProjectScopedData.ts:80,93`) do not block episodic loading.

Django ground truth (verified `../studiohub`): no Episode model, no
episode endpoints, `Sequence`/`Shot` carry only org + project FKs (shot
uses denormalized `sequence_code`), `Project` has `type` string only.
Hence Track 1 REST work = client path + mocked-transport proof; live
REST episodic is Track 2's exit criteria.

## 3. Section 1 — Project configuration & reads

- Project create/edit form gains an explicit Standard / Episodic control
  writing canonical `workflow_type` (`ProjectWorkflowType`,
  `types/projects.ts:3`; field exists at `:60`).
- `isEpisodicProject()` is the single decider, unchanged: explicit
  `workflow_type`/`is_episodic`/`project_type` first, legacy `type`-string
  sniffing as fallback. Consequence: REST detection works with zero extra
  code both before Track 2 (`type: 'Episodic Series'`) and after (workflow
  field, already read by the helper).
- Reads: `episode_id` filter on shots list (mirror sequences,
  `mockRouter.ts:2036`); plumb through `useProjectShots`/`useShots`;
  seed 2 sequences + 4 shots linked to `ep-101/102` under `proj-102`.
- Activity: add `'episode'` to `ActivityResourceType` and an episode
  branch in `resolveScoping` (`activityService.ts:275-348`).

## 4. Section 2 — Creation flows

- Sequence modal already enforces episode selection; verify only.
- Shot single-create modal: required episode `<select>` iff
  `isEpisodicProject` (mirror `ProjectSequencesTab:376-415`); submit
  carries `episode_id/code/name`; server 400 `fieldErrors` surface inline.
- Missing-episode flow (single + bulk): prompt with the canonical
  wording ("An episode is required…"), **[Create Episode]** opens the
  episode modal project-prefilled; on success the pending form resumes
  with state intact (component-held pending state, never a route change,
  never a restart).
- Bulk (`ShotBulkManager`): new `episodeId` prop + grid column;
  resolution order row → bulk default → sequence's episode; missing
  episode/sequence prompts offer inline creation preserving GRID rows and
  bulk phase (`GRID→validate→RECOVERY→PREVIEW→EXECUTE`).
- Missing-sequence during shot creation: "Create a sequence?" prompt
  carrying episode context, then continue.
- No episode UI renders for standard projects. Client pre-validates the
  hierarchy before submit; selectors derive ids (no free-typed
  `project_id`/`episode_id`/`sequence_id`).

## 5. Section 3 — Validation & integrity (mock engine)

- Apply existing POST checks to PATCH for sequences (`mockRouter.ts:2348`)
  and shots (`:2823`): episode exists + same project, sequence↔episode
  consistency; cross-project moves rejected as 400 field-errors.
- Episode-scope `check-existence` (shots `:2398`, sequences `:2043`).
- Episodic branch for sequence bulk-create (`:2067`), mirroring shots
  bulk per-item results.
- `MockShotAdapter` enforces the same rules, thinly and explicitly
  flagged as superseded by the approved adapters-as-facades consolidation
  (no duplicate validation framework).
- sqlite FK map: add `shots.episode_id`, `shots.sequence_id`,
  `sequences.project_id`; verify `entityRepo` related-wiring covers them.
- Migrations v5→v6 backfill `episodes` (mirror shows backfill) so stale
  IndexedDB self-heals.
- Rejection matrix enforced at router, pre-checked in UI:
  episode→project, sequence→episode→project,
  shot→sequence→episode→project.

## 6. Section 4 — REST path, handoff, tests

- REST needs no new transport: `Episode/SequenceRepository`
  (`modules/episodes|sequences/repositories/`, `BaseRepository` over
  `ApiClient`) already target `/api/v1/episodes|sequences`. Track 1
  proves the id chain with mocked-transport unit tests asserting
  `project_id`/`episode_id`/`sequence_id` on episode/sequence/shot
  create/update/bulk payloads. Live REST episodic verification is
  Track 2's exit criteria (contract regen + removing `'episodes'` from
  the validate allowlist).
- Unit matrix: standard create sequence/shot/bulk; episodic create
  episode/sequence/shot/bulk; missing-hierarchy prompt → create →
  continue (single + bulk, context preserved); validation matrix
  (wrong episode/sequence/project, cross-project); RBAC extensions
  (`episode.*` allow/deny on existing guard suites); audit assertions
  (`recordActivity`/`writeAudit` rows for episode/sequence/shot/bulk).
- Playwright E2E (mock `:3100`, existing login-helper pattern): create
  episodic project → episode → sequence → shot → bulk shots → reload →
  verify hierarchy + activity; plus standard-workflow regression.
- Gates for every stage: `tsc --noEmit`, `vitest run`, `api:validate`,
  `vite build`, episodic E2E green.

## 7. Out of scope

Theme or styling changes; `Show` model changes; `EditorialTrack` scoping;
assets/tasks episode scoping; unifying factory-adapters with module
repositories (owned by the consolidation spec); Django implementation
(Track 2); changing existing standard-project behavior (regression-gated).

## 8. Appendix — contract delta for Track 2 (starting input, not final)

Endpoints (mirror sequences shape): `CRUD /api/v1/episodes/`,
`check-existence`, `bulk-create|update|archive|restore`,
`{id}/archive|restore`. Model fields: `Episode`
(`project FK, code unique-per-project, name, season_number,
episode_number, status, air/delivery dates`); `Sequence.episode` nullable
FK (required iff project episodic); `Shot.episode` nullable FK +
proper `sequence` FK (replacing denormalized-only linkage);
`Project.workflow_type` enum. Validation rules mirror §5 with identical
400 field shapes. Permission mapping: existing frontend `episode.*` /
`sequence.*` / `shot.*` names. Track 2 finalizes this appendix against
Django conventions.
