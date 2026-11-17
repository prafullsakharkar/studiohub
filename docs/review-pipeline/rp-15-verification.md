# RP-15 verification: colour management for review copies

Built 2026-11-17 on `feature/rp-15-colour-management`, off `develop` at `73570a2e` (v4.11.0), with every recommendation of Q-RP-68 to Q-RP-72 ([DECISIONS.md](DECISIONS.md#rp-15-answers)). Committed `ae0c6dde`; merged into `develop` (`19b07186`) and `main` (`67e1cab6`), released in v4.12.0. Contracts C-RP-39 and C-RP-40 ([CONTRACTS.md](CONTRACTS.md#rp-15-colour-management-for-review-copies)); decision record [ADR-0041](../adr/ADR-0041-review-colour-management.md).

## What was built

- **WP 15.1, the config.**
  - Setting `REVIEW_MEDIA_OCIO_CONFIG` (`config/env.py`, `components/storage.py`, imported by name in `base.py`, both `.env.example` files). Default: the built-in `ocio://studio-config-v5.0.0_aces-v2.1_ocio-v2.6`.
  - Dependency `opencolorio>=2.6.0,<3` (`pyproject.toml`, `uv.lock`).
  - `production/transcode/colour.py` loads the config once, resolves names, aliases and roles, lists the sRGB display's views and the looks, and bakes a 65³ cineSpace LUT with an ACEScct shaper. The LUT is cached in `review_media/luts/<key>.csp` and written atomically.
  - `manage.py check` warns `production.W002` when review media is on and the config cannot be loaded.
- **WP 15.2, project settings.**
  - `Project.review_view` and `review_look` (migration `production` `0012_rp15_colour`, which also adds `ReviewMedia.color_space`).
  - `validators/colour.py` checks a new or changed `color_space`, `review_view` or `review_look` on project writes (`ProjectColourMixin` on the create and update serializers) and stores it in the config's spelling.
  - `GET review-media/colour/` (`project.view`) lists the options.
- **WP 15.3, processing.**
  - The input is the upload's `color_space`, else the project's for EXR frames, else none.
  - With an input, `lut3d=colour.csp:interp=tetrahedral` comes first in the proxy, still, thumbnail and filmstrip commands, without `apply_trc`; burn-ins come after.
  - The probe records `colour: "ocio"`, `ocio {config, input, display, view, look}` and `colour_skipped`.
  - An unreadable config, an unknown name or a failed bake falls back to RP-12's rule and logs `review_media_colour_failed` or `review_media_colour_skipped`.
  - Movie uploads and sequence opens accept `color_space`; a remake keeps it.
- **WP 15.4, copies with other settings.** C-RP-38's selector also counts copies whose `probe.ocio` differs from what they would be made with now. The read gains `colour_out_of_date`, and the project remake remakes those movies.
- **WP 15.5, frontend.**
  - Typed API and row keys from the captures (`review.ts`, `structure.ts`, `reviewRowKeys.ts`, `structureRowKeys.ts`), and the regenerated OpenAPI schema and types.
  - `ReviewColourSelect`: Color space (grouped by family), Review view (blank shows the config's default view) and Review look on the project form. It marks a stored value the config does not know, and is disabled with a hint while the config cannot be read. New projects start at `ACEScg`.
  - The directory form gains `textValue` on entity fields, so a blank choice is sent as `""`, not `null`.
  - The review movie panel says how a copy was made ("ACEScg → sRGB - Display, ACES 2.0 - SDR 100 nits (Rec.709)", plus "with <look>") or why its colour was not managed. Uploaders get a colour space choice for movie and sequence uploads, shown only when the config is readable; others never read the options. Remake's title mentions colour.
  - The review-copies notice says "made with other colour or burn-in settings" when colour differs, and "made with other settings" for sequences.
- **WP 15.6, capture, live, docs.**
  - New capture tool `docs/sync/tools/test_capture_review_colour.py`, which writes `_review_colour_flow.json` on the host's real ffmpeg.
  - Recaptured `_review_media_flow.json`, `_review_sequence_flow.json`, `_review_remake_flow.json` and `_rollup_flow.json` (new keys).
  - New live file `src/test/live/reviewColour.live.test.tsx`. Docs: ADR-0041 (ADR-0040 points to it), CONTRACTS, DECISIONS, PLAN status and corrections, `docs/production/CONTRACTS.md`, and the pre-deploy checklist.

## For the owner: details settled while building

1. **The field is `color_space`, not `colour_space` as the plan wrote it.** It is spelled like the project's field, so an upload's 400 lands on the same key the frontend already maps. The reason code keeps `unknown_colour_space`.
2. **`probe.colour` keeps its values and gains `ocio`.** The transform is a new field, `probe.ocio`, rather than `colour` becoming an object, so a field the frontend has read since RP-12 keeps its type.
3. **The plan was wrong about the host's ffmpeg.** `/usr/bin/ffmpeg` is Debian's 7.1.5 and reads the LUT. Only the shell's `ffmpeg` alias points to an old 2.8 build. No wrapper was built; capture and live use `/usr/bin/ffmpeg`. The real-ffmpeg test detects a usable ffmpeg by applying a baked LUT, because asking `-h filter=lut3d` is not enough: 2.8 lists the filter but cannot read cineSpace.
4. **A config outage counts nothing** (added while writing the contract). Without it, an unreadable config would count every managed copy as differing in colour, and "Remake them" would replace each with an unmanaged copy. A test covers it.
5. **Copies made before RP-15.** EXR sequence copies count as differing (made by the fixed curve) and cannot be remade. Movies named no colour space and are not counted. After deploying, every project with EXR sequences shows "N image sequences were made with other settings". This is in the checklist.
6. **A config edited in place is not noticed.** Copies record the config's name, and LUTs are cached by setting and names; the checklist says to delete `review_media/luts/` after such an edit.
7. **A new project leaves blank view and look to the server**, as the form does with every optional blank on create.
8. **The real-ffmpeg test allows 4 code values for mid grey**, not the plan's 2. It reads the pixel back from the encoded copy, so the 8-bit 4:2:0 H.264 encode and its limited-range round trip add their own rounding to the LUT's error. It still tells the rule apart from RP-12's, which put mid grey about 30 code values higher.
9. **The live form test needed `ProtectedRoute`** (a test-only finding). Rendered directly inside `AuthProvider`, the project form filled from the record before `/auth/me` arrived. The budget field (gated by `project.view_budget`) then appeared empty and dirty, and the save sent `budget_usd: null` (400). In the app, `ProtectedRoute` waits for the user before any route renders, and the jsdom tests pass a user at once; neither shows it. The form keeping a gated field clean when permissions arrive late would harden it, but that is outside RP-15 and was not changed.

## Gates

| Gate | Result |
|---|---|
| `uv run ruff check .` | All checks passed |
| `manage.py check` (`DJANGO_ENV=testing`) | only identity.W001 and W002 (no MFA key or pepper in the testing env, as before) |
| `makemigrations --check --dry-run` | No changes detected |
| `ruff format --check` on new files and on changed files formatted at HEAD | clean (`api/viewsets/version.py` was not formatted at HEAD and was left alone) |
| basedpyright on changed non-test files | 0 errors |
| RP-15 tests (`test_rp15_colour.py`) | 34 passed, including the real-ffmpeg mid-grey check on `/usr/bin/ffmpeg` |
| Targeted: `apps/production apps/notifications apps/core/tests apps/settings` | 2,886 passed. One failure was `test_bootstrap`'s migration allowance (production 11), raised to 12 with a note as each phase does; that file then passed 26 of 26 |
| Frontend `pnpm typecheck`, `pnpm test`, `pnpm build` | clean; 169 files, 1,886 tests passed; built |
| `pnpm exec biome check src --diagnostic-level=error` | 707 files, no errors |
| `node ../docs/sync/tools/unreachable.mjs .` | only the generated bridges, the permission catalogue and test helpers, as before |
| Captures | colour, media, sequence, remake and rollup tools all passed |

## Mutation checks

**Backend** (12 of 12 caught, after replacing one mutant that changed nothing):
- `apply_trc` kept with the LUT;
- burn-ins drawn before the LUT;
- the thumbnail made without the LUT;
- a movie transformed without a named colour space (the first version only dropped the kind check, which is a no-op because a movie's container is not a frame format; it was rewritten so movies take the project's colour space, and was caught);
- the version's `color_space` used;
- an unknown name accepted on a project write;
- an unknown name accepted on an upload;
- the LUT rebaked every job;
- `probe.ocio` left out;
- matching copies counted;
- an outage counting copies;
- an unchanged stored value checked again.

**Frontend** (10 of 10 caught):
- the look left out of the note;
- why colour was skipped not said;
- a movie upload without its colour space;
- a sequence open without it;
- the options read by someone who cannot upload;
- the notice ignoring colour;
- a blank colour sent as `null`;
- a stray stored value not marked;
- an unreadable config still editable;
- the upload choice shown without a readable config.

## Live run

Run with `SYNC_LIVE_MEDIA=1 docs/sync/tools/run_role_smoke.sh --vitest …`, against the throwaway backend with `/usr/bin/ffmpeg` and the built-in config:
- **`reviewMedia.live`:** 3 of 3. Its RP-12 sequence now expects "ACEScg → sRGB - Display, ACES 2.0 - SDR 100 nits (Rec.709)", because a new project's colour space is ACEScg.
- **`reviewColour.live`:** 2 of 2.
  1. EXR frames come out through the ACES 2.0 view, and the version page says so. The upload choice lists the real config's colour spaces.
  2. The project form picks "Un-tone-mapped". The notice counts the old sequence copy (no Remake for a sequence). Frames sent again use the new view, and the counts return to zero.
- The first runs of `reviewColour.live` failed on the `budget_usd` finding above; the third run passed.

## Not done in RP-15

- P3 and HDR copies, 10-bit copies (Q-RP-70 B); per-shot grades (CDL); keeping sequence frames for remaking (Q-RP-72 B).
- ffmpeg's own `ocio` filter, which will replace the bake once Debian stable's ffmpeg has it (ADR-0041).
- Noticing a config edited in place (see item 6).

## Files

Backend:
- **new:** `production/transcode/colour.py`, `validators/colour.py`, `api/serializers/project/colour.py`, `migrations/0012_rp15_colour.py`, `tests/test_rp15_colour.py`;
- **changed:** `models/{project,review_media}.py`, `api/serializers/{review_media,project/base,project/create,project/update}.py`, `api/viewsets/{review_media,version}.py`, `selectors/review_media.py`, `services/review_media.py`, `transcode/ffmpeg.py`, `checks.py`, `config/env.py`, `config/settings/{base,components/storage}.py`, `pyproject.toml`, `uv.lock`, both `.env.example`, `tests/test_rp{5,12,14}_*.py`, `apps/core/tests/test_bootstrap.py`.

Frontend:
- **new:** `review/ReviewColourSelect.tsx`, `api/production/__tests__/reviewColourContracts.test.ts`, `review/__tests__/reviewColour.test.tsx`, `test/live/reviewColour.live.test.tsx`;
- **changed:** `api/production/{review,structure,reviewRowKeys,structureRowKeys}.ts`, the generated OpenAPI schema and types, `directory/{formModel,types}.ts`, `production/structure/configs.tsx`, `review/{ReviewMoviePanel,ReviewCopiesNotice}.tsx`, the RP-12, RP-14 and structure tests, `test/live/reviewMedia.live.test.tsx`.

Docs and samples:
- **new:** `docs/adr/ADR-0041-review-colour-management.md`, `docs/sync/tools/test_capture_review_colour.py`, `docs/sync/samples/production/_review_colour_flow.json`, this report;
- **changed:** `docs/review-pipeline/{CONTRACTS,DECISIONS,PLAN}.md`, `docs/adr/ADR-0040-review-media-processing.md`, `docs/production/CONTRACTS.md`, `docs/07-deployment/pre-deploy-checklist.md`, and the four recaptured samples.

Left out of any commit, as before: `docs/sync/tools/run_role_smoke.sh`, `docs/sync/phase-34-verification.md`, `frontend/src/test/live/newScreens.live.test.tsx`, `spikes/`, `scripts/ATOM API.yaml`.
