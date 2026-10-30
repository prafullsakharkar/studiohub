# Phase 11 — Settings & platform admin: verification

Branch `sync/phase-11-settings` (from `develop` after the Phase 10 merge, `615c6afe`), **not pushed, not merged**. No backend file changed. Four backend requests are proposed and **unapplied**: **CR-26** (the settings lists ignore their filters), **CR-27** (a select definition with plain-string choices causes a 500), **CR-28** (tags have no permission model) and **CR-29** (missing validation in settings). Every one has a frontend workaround that is in use.

## 1. Exit criteria

Plan: *system settings (+ lock/unlock), feature flags (+ enable/disable/schedule) and a `useFeatureFlag` hook, themes (+ activate), localizations (+ activate), setting categories/definitions; tags; remove the mock DB schema/export section. Risk: CR-02 (`settings.view`).*

| Criterion | Result | Evidence |
|---|---|---|
| System settings, lock and unlock | ✅ live | `settings.live` › an administrator locks a value from the list, the API then refuses to edit (400) or remove (403) it, unlocks it, edits it; a value breaking its definition is a 400 with the definition's own sentence; a second value for a setting is refused |
| Feature flags, enable/disable/schedule | ✅ live + unit | an administrator enables a flag from the list; Schedule posts the window stored on the flag; the action offered follows the status |
| `useFeatureFlag` | ✅ live + unit | an artist (no settings role) reads the flags and the hook turns **on** once the flag is enabled, **off** for a flag nobody defined; scheduled window, percentage bucket and expiry are evaluated here (the server does none of it) |
| Themes, localizations (+ activate) | ✅ live + unit | activating leaves the others active, and the screens say so |
| Categories, definitions | ✅ unit + live | a category code is one of 14 fixed words; a select definition's choices must be `{value, label}` objects (a listed value is accepted, another is a 400); the definition's code is never offered on edit |
| Tags | ✅ live | an artist makes and deletes a tag (the finding behind CR-28) |
| Remove the mock DB schema/export section | ✅ | removed with the pipeline form, the theme and layout editors (§4) |
| CR-02 / `settings.view` | ✅ | the production-admin reads every section and is offered no control; the platform administrator changes; a supervisor, a lead, an artist and a user with no role get 403 on every list except the flags (`settings.live`, `settingsContracts.test`) |

Live files, each on a fresh seed: `settings` 4, `production` 6 and `work` 7 are the files whose pages changed or sit beside the changed project routes; `auth` and `restricted` use none of the changed code and were not re-run.

## 2. Quality gates

| Gate | Phase 10 | Now |
|---|---|---|
| `tsc --noEmit` | 0 | **0** |
| Unit tests | 94 files / 881 | **97 files / 931** |
| Live tests | 13 files / 76 | **14 files / 80** (the settings file is new) |
| `pnpm build` | OK | **OK** |
| Biome (`src`) | 2 errors / 2128 warnings | **2 errors (the same two) / 2085 warnings**; the files changed here have 0 errors |
| Net size (frontend, against `develop`) | | 23 files, +1,887 / −2,212 |

Mutation checks (break the code, expect a failure): flag evaluation (expired, end of window, status versus the second boolean, percentage upper bound), the actions offered per flag status, the choices check and its empty-value case, the category-code list, invented and removed row fields, locked values editable and removable, lock and unlock swapped, the browser-side lock filter, every flag action running the enable call, the flag create and update checks, the definition code being editable, the week start sent as a number, the section note for readers and the hook waiting for the user.

## 3. What was built

- **Typed API** (`src/api/settings/`): categories, definitions, values, feature flags, themes, localizations and tags, with every row pinned to the captured flow (`settingsRowKeys.ts`), the closed lists the forms offer, and `settingsFlow.ts`: flag evaluation (`evaluateFlag`, `rolloutBucket`), the actions per flag status, `flagProblem` / `choicesProblem` (what the server does not check), value hints, hex colours. 28 contract tests against `samples/settings/_flow.json` (≈200 calls, five roles).
- **Screens** (`src/modules/settings/`, routes under `/settings/system/*`, guarded by `settings.view`; writes by `settings.manage`): System settings, Feature flags, Themes, Localizations, Categories, Definitions, Tags, each a list with row actions and a form, under one section navigation that tells a reader that changes need an administrator.
- **`useFeatureFlag(code)`:** `{ enabled, flag, isLoading }` for the signed-in user; any signed-in user may read the flags.
- **Client-side refusals shaped as the server's:** a failed check throws a 400 `ApiError` keyed by field, so the form shows it under the field like any server refusal.

## 4. Removed (no silent deletions)

Separate commit `18eefed2` (5 files, −1,858 lines), all unreachable from `main.tsx` and imported by no test: `modules/settings/pages/SettingsPage` (a pipeline form that "saved" after a 400 ms timer), `components/ThemeEditorSection`, `components/LayoutSettingsSection`, `components/DatabaseSchemaSection` (a schema and export viewer built from invented data), `types/system` (PipelineSettings and friends). Also edited in place: `PlatformAdminPage` lost its four mock tabs (Pipeline & Color, Theme, Page Layout, DB Schema); it is master data only now, and a viewer without platform rights is sent to `/settings/system`.

Left alone: the legacy `/settings/roles`, `/settings/permissions` registry entries and redirects (Phase 4).

## 5. Findings (details in `backend-change-requests.md`, "Phase 11 findings")

1. **CR-26 (proposed)** — all six settings lists ignore their filters because each viewset reads `FilterSet.queryset` (the input) instead of `.qs`; archived rows are never hidden; there is no search. The lists are small, so the screens narrow them in the browser.
2. **CR-27 (proposed)** — a `select` definition accepts plain-string `choices`, then creating its value is a **500**. The definition form sends and requires `{value, label}` objects.
3. **CR-28 (proposed, security)** — tags have no permission model: a user with no role creates tags, an artist created a **system** tag, renamed an administrator's system tag and **deleted** it (204); `is_system` is writable; colours are unchecked; a create answers without an id. The Tags screen is offered to settings administrators only, which hides it and protects nothing.
4. **CR-29 (proposed)** — a flag's percentage is unbounded (150), `schedule` accepts no dates, an end before the start and naive date-times (and answers 200), a localization's week start is unbounded, theme colours are length-checked only, and the active theme can be deleted. The forms check all of it.
5. **Q-21** — a feature flag has two independent booleans: `status` (what enable, disable and schedule move) and `is_enabled` (what a create or a patch writes and nothing else touches): after `enable`, `is_enabled` is still false; a flag created with `is_enabled: true` is still `status: disabled`. The hook reads `status`.
6. **Activation is not exclusive:** several themes and localizations can be active at once, and `deactivate` on an inactive one is 200; the screens say so.
7. **Actions answer `{status}`, not the row** (lock, enable, archive, activate, …).
8. **My own slips this phase:** the first capture used category codes outside the fixed list and plain-string select choices, so the early runs recorded 400s and a 500 I then had to separate from my own mistakes; the first probes of the filters compared lists after the rows they filter on had been deleted (uninformative; redone before the deletes); my first live run signed in as the plain superuser, who must pass MFA; and the first flag update check looked at a patch that carries no `feature_type`, so a percentage of 150 passed on edit (a test found it; the check now merges the patch with the stored flag).

## 6. Deferred / not done

- **Applying a theme or a localization to the app.** The screens store and activate them; nothing reads "the active theme", because several can be active at once (Q-22).
- **A typed value input per data type** (a switch for a boolean, a picker for a select): the value is a text field with a hint.
- **System settings grouped by category** with their definitions inline: lists are flat.
- **A rollout page for flags** (users in a bucket, history): the hook buckets by user id; nothing shows who is in.
- **Tag use:** nothing in the app lists or assigns tags yet.
- The Phase 6 to 10 deferrals stand.

## 7. Questions for the owner

1. **CR-26** (`.queryset` → `.qs` in six viewsets, a test each), **CR-27** (validate select `choices` on the definition), **CR-29** (percentage 0–100, schedule needs two dates with a zone and `end > start`, week start 0 or 1, hex colours, refuse deleting the active theme): approve as one backend commit? They are small and the screens work without them.
2. **CR-28** is the one that matters: any signed-in user can change or delete any tag, including system tags. Approve a permission map (`settings.manage` for writes, `is_system` and system tags protected) before anything starts using tags?
3. **Q-21** — which boolean means "on": `status` or `is_enabled`? The recommendation is `status`, dropping `is_enabled` (or deriving it from `status`).
4. **Q-22** — should exactly one theme and one localization be active (activating one deactivates the others)? Today they are not exclusive, so the app cannot say which one applies.
