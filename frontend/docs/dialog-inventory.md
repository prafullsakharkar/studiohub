# Dialog inventory (Phase 1)

Status: **inventory as of Phase 1; migration result per row in the last column**. The columns describe the code before the migration. Paths relative to `frontend/`. Reference = the Catalog
`RowDialog` described in `dialog-standard.md`.

Search method: grep of `src` (excluding tests) for `<Dialog`, `<Modal`, `useServerForm`, `useForm`,
`ConfirmDialog`, `DirectoryFormConfig`, `noun:`, `New`/`Edit`/`Add` titles. There is no Drawer in the code base
(`<Drawer` has zero matches). Confirm-only dialogs (`ConfirmDialog`, ~35 call sites) are not create/update and are
left out; they are already on the shared `ConfirmDialog`.

Legend. Shell: **D** = `Dialog`, **M** = `Modal` directly, **Page** = routed full page, **Inline** = form embedded in a
page. Effort: S/M/L is the cost of moving onto the shared primitives, not of moving to a dialog.
"Unsaved guard" is **none** everywhere, including the reference (gap G1), so that column is omitted below.

## A. Form dialogs (create and/or update)

| Entity | File (line) | Create/update split? | Shell | Form lib | Validation | Error mapping | Deviations from the standard | Effort |
|---|---|---|---|---|---|---|---|---|
| **Catalog: 7 kinds + software versions** | `modules/catalog/CatalogTable.tsx:46` | one component, `row` prop | D `lg` | RHF via `useServerForm` | zod `buildSchema(FieldDef[])` | `useServerForm` + `FormBanner` | **reference** | n/a |
| Related records, 8 configs: client and vendor contacts, client and vendor contracts (`directory/entities/partners.tsx`), shows, episodes, sequences, editorial tracks (`production/structure/configs.tsx`) | `modules/directory/RelatedRecords.tsx:25-92` | one component, `row` prop | D `lg` | `useServerForm` | `buildSchema` | `useServerForm` | Near-copy of `RowDialog`. Title is `Add <noun>` (reference: `New`), button `Add <noun>` (reference: `Create`), toast `added` (reference: `created`). Uses `reset()` in an effect to prefill instead of `defaultValues`. Adds `auditKeys` invalidation. Permission-filters fields. `immutableOnEdit` | **S** |
| Log time | `modules/production/work/LogTimeDialog.tsx:62` | create only | D `md` (reference `lg`) | `useServerForm` | inline zod schema | `useServerForm` + `FormBanner` | Always mounted with `isOpen` prop; manual `reset()` + `clearServerError()` in `close`. Hand-written `Field`s (no `FieldDef`). Submit label `Log time`. Extra description line above the banner. Also invalidates audit keys | **M** |
| Add note on a record | `modules/production/work/EntityNotes.tsx:59` | create only | D `md` | `useServerForm` | inline zod | `useServerForm` | Title `Add a note on <code>`; hand-written fields; mounted only while open (matches) | **M** |
| New role | `modules/identity/pages/RolesPage.tsx:81` | create only (edit is inline on the detail page) | D `md` | `useServerForm` | inline zod | `useServerForm` | Always mounted with `isOpen`; manual reset; `useMutation` instead of plain call; `valueAsNumber` select | **M** |
| New group | `modules/identity/pages/GroupsPage.tsx:64` | create only | D `md` | `useServerForm` | inline zod | `useServerForm` | Same pattern as New role | **M** |
| New API token / key | `modules/identity/account/TokensPage.tsx:111` | create only | D `lg` | `useServerForm` + local state for the scope checkbox list | zod + a manual "Choose at least one permission" check outside the schema | `useServerForm` + a local `scopeError` | Custom scope picker, so a field outside RHF; footer built by hand. The follow-up "Copy your secret now" dialog (`TokensPage.tsx:34`) is a display dialog with `onClose={() => undefined}` (cannot be dismissed) | **L** |
| Reauthenticate (password + code) | `modules/identity/account/ReauthDialog.tsx:53` | n/a (confirmation with a form) | D `sm` | `useServerForm` | zod | `useServerForm` | Not an entity create/update. Submit variant switches to `danger`. Keep as a form dialog; shell-only change | **S** |
| Add a member to a team | `modules/directory/workspace/TeamMembersTab.tsx:85` | create only | D `md` | none (`useState`) | none (button disabled until a person is picked) | single `addError` string passed to the picker | No `<form>`, so Enter does not submit; no `FormBanner`; manual footer | **M** |
| Assign artist to shot/asset | `modules/production/work/AssignArtistDialog.tsx:38` | update only (set/unassign) | D `md` | none (`useState`) | none | `serverMessage(e)` into the picker's `error` | No `<form>`; Save disabled until changed; saving is local state | **M** |
| Duplicate project | `modules/production/components/ProjectWorkspace.tsx:805-840` (handler `:333`) | create only | **M** directly (reference uses `Dialog`); no `size` (default `md`) | none (`useState` + native `required`) | browser `required` only | `notify.fromError` toast, dialog stays open | Raw inputs with `focus:ring-1` classes (not `inputClass`), labels not tied to inputs (no `htmlFor`), `text-xs font-semibold` label style, has `subtitle`, `border-t` divider in footer, no `isLoading` on submit (double submit possible) | **M** |
| "Command: Create <Entity>" (command palette) | `shared/components/ActionDispatcherModals.tsx:348-407` | create only | **M** `md` | none (`useState`) | none | none | **Does not create anything.** `handleCreateEntity` (`:132`) only raises a "Created …" notification. Same for Assign Project/Team, Archive, Restore, Change Status in the same file (`:50-130`). Reachable from `CommandPalette.tsx:129-219`. Titles are `Command: …` | **Removed** (see `dialog-standard.md`, "Not migrated") |
| Bulk import: shots, assets, tasks | `modules/{shots,assets,tasks}/components/bulk/*BulkManager.tsx` (`Modal` at 592 / 234 / 252), `shared/components/bulk/BulkImportGrid.tsx:281` | create (multi-step grid) | **M** `xl` + `max-w-5xl` | own state machine (`BulkOperationEngine`) | own validation grid | own preview/result steps | A different kind of UI (wizard); not a form dialog. Excluded from migration; shell is already `Modal` | skip |

## B. Inline forms (not dialogs)

| Entity | File (line) | Shell | Form lib | Notes | Effort |
|---|---|---|---|---|---|
| Add project member | `modules/production/structure/panels.tsx:60-` (`MembersPanel`) | Inline form above a table; edits happen in-table | `useServerForm`, zod | Different pattern on purpose (add + inline edit) | skip unless dialog is wanted |
| Add project note | `panels.tsx:258-` (`NotesPanel`) | Inline form | `useServerForm` | Duplicates the `EntityNotes` dialog's fields | M |
| Add IP rule | `modules/identity/pages/SecurityLogPage.tsx:100-` | Inline form | `useServerForm` | | M |
| Create login / link login | `modules/identity/components/AccountSection.tsx:75-` | Inline cards | `useServerForm` (create) / plain form (link) | | M |
| Directory (LDAP) settings | `modules/identity/pages/DirectorySettingsPage.tsx:144-` | Page card | `useServerForm`, no resolver | A settings page, not an entity dialog | skip |
| Profile | `modules/identity/account/ProfilePage.tsx` | Page | `useServerForm`, uses `isDirty` to enable Save | Only form in the app that reads `isDirty` | skip |
| Auth screens (login, forgot/reset/change password, MFA challenge/enrolment) | `modules/auth/**` | Pages | `useServerForm` | Not entity create/update | skip |

## C. Full-page create/edit forms (routed)

| Entity group | File | Shell | Form lib | Validation | Notes |
|---|---|---|---|---|---|
| **37 entities** from `DirectoryFormConfig`: clients, vendors, offices, people, positions, teams; projects; shots, assets, tasks, time logs; versions, reviews, playlists, workflows, automation rules, media items; deliveries, destinations; published files, export jobs, storage roots, destinations; scheduling resources, bookings, leave requests, holidays, work calendars, milestones, events; settings, setting definitions, feature flags, themes, localizations, tags, categories | one generic page: `modules/directory/DirectoryFormPage.tsx:20-` (configs under `modules/directory/entities/`, `modules/*/records.tsx`, `modules/production/**`, `modules/publishing/**`, `modules/deliveries/**`), mounted by 26 route files | **Page** (`max-w-2xl`, `<h1>` `New <noun>` / `Edit <noun>`) | `useServerForm` + `buildSchema`, same `FieldInputs` | same | **Same field model as the Catalog dialog.** Differences: the footer is left-aligned with the submit first and `Cancel` as a `Link`; success navigates (`afterSavePath`) instead of closing; URL prefill (`?project=…`); `refreshSessionOnCreate`; audit invalidation; `clearWhenHidden`. Loads the row with its own `useQuery` on edit |
| Department | `modules/departments/pages/CreateDepartmentPage.tsx` | Page (`Card`) | `useServerForm`, zod | own | Copies the `FormBanner` markup inline, two-column grid, hand-written labels, uses hooks `useCreateDepartment`/`useUpdateDepartment`. Not a `DirectoryFormConfig` |
| Task template | `modules/production/work/templates.tsx:105-` | Page | `useServerForm` + `useFieldArray` | zod | Nested item list; title `New template` / `Edit template` |

## What this means

1. **Dialogs proper are few (13 entity forms: the Catalog and 8 related-record configs share two components, plus about 8 hand-written ones); full pages are the bulk (39 entities, but only 3
   components).** The generic `DirectoryFormPage` already shares the Catalog's field model, schema and error handling, so the
   page forms are "the same form, different shell".
2. **Within the dialogs, the Catalog dialog has exactly one near-clone (`RelatedRecords`)** and a set of hand-written
   copies (role, group, token, log time, note, reauth) that diverge in size (`md` vs `lg`), reset strategy, label
   style and footer.
3. **No form anywhere has an unsaved-changes guard**, including the reference.

## Decisions needed before Phase 2

**D1. Scope: should page forms become dialogs?** Your sentence says "every entity create/update should be in dialog".
The ground rules say not to change route structure. Both cannot hold for the 37+ page-form entities. Options:

- **(a) Recommended: standardise the existing dialogs only (section A), and make the page form share the same
  primitives** (field renderer, footer, error banner, submit hook) so page and dialog behave alike. No route change.
- (b) Also open create/edit as dialogs from the list pages, keeping the old routes as direct-link fallbacks. Large, and
  still touches navigation (`afterSavePath`, URL prefill, session refresh).
- (c) Convert all to dialogs and drop the routes. Violates the route rule.

**D2. Gaps G1-G3 in `dialog-standard.md`.** Add an unsaved-changes guard (and block close while pending, and focus the
first field) to the shared shell, which also changes the Catalog's behaviour? Or keep the Catalog exactly as is and
only add these to non-reference dialogs? I would add all three in the shared primitive, once, but it is a behaviour change
to the reference you asked me not to redesign.

**D3. Command palette "Create …" modals (`ActionDispatcherModals.tsx`).** They show success without calling the API
(Create, Assign Project/Team, Archive, Restore, Change Status). That looks like leftover mock behaviour and is a
**bug, not a style deviation**. Options: leave alone and report (default under "do not change business logic"); route
"Create <entity>" to the real create route/dialog; remove the commands. I will not touch it without your call.

**D4. Dialog sizes.** Catalog form dialogs are `lg`; the hand-written ones are `md`. I'd normalise to `lg` except
single-field dialogs (reauth, assign, add-to-team) which would stay `sm`/`md`. The reference has no single-field case, so this
is an extension of the standard.

## Proposed migration order (if you accept D1a)

1. Extract from `RowDialog`: `FormDialog` (shell + `<form>` + banner + footer), `useFormDialog`
   (submit/close/invalidate/toast), and keep `FieldInputs`/`serverErrors` as they are. Migrate the Catalog first with the
   existing 8 catalog tests unchanged.
2. **S**: `RelatedRecords` (becomes a thin config over the same component), `ReauthDialog`.
3. **M**: Log time, Note, Role, Group, Team member, Assign artist, Duplicate project.
4. **L**: API token (custom scope field → a shared checkbox-list field).
5. Page forms (`DirectoryFormPage`, `CreateDepartmentPage`, `TaskTemplateForm`): reuse the same footer/banner/submit pieces
   only; the shell stays a page.
6. Skip: bulk managers, command-palette modals (pending D3), auth, profile, LDAP settings.

## Migration status

| Entity | Status |
|---|---|
| Catalog (reference) | on `FormDialog` |
| Related records (8 configs) | on `FormDialog` |
| Log time, Add note | on `FormDialog` |
| New role, New group, New API token / key | on `FormDialog` |
| Reauthenticate | on `FormDialog` |
| Add team member, Assign artist | on `FormDialog` (no RHF; local state) |
| Duplicate project | on `FormDialog`, own file `CloneProjectDialog.tsx` |
| 37 record pages (`DirectoryFormPage`) | on `FormPage` |
| Department form, task template form | on `FormPage` |
| Bulk managers, command-palette modals, secret dialog, inline forms | skipped (see `dialog-standard.md`) |
