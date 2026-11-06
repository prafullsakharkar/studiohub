# Dialog standard (Phase 0: the Catalog reference)

Status: **Phase 0 spec, now implemented (see "As built" at the end)**. The sections below describe the Catalog as it was before the work. Every rule below is derived from the Catalog
dialogs. Where the Catalog does *not* do something the brief asks for, that is listed under
[Gaps in the reference](#gaps-in-the-reference-need-a-decision) and is **not** written as a rule yet.

Paths are relative to `frontend/`.

## What "the Catalog dialogs" are

| Piece | File | Lines |
|---|---|---|
| Page with 7 tabs (task, asset, shot, review, file types, statuses, software) | `src/modules/catalog/CatalogAdminPage.tsx` | 137-156 |
| Per-tab field list (`FieldDef[]`) and columns | `CatalogAdminPage.tsx` | 11-16, 57-134 |
| **The create/edit dialog**, one component for all seven tabs and for software versions | `src/modules/catalog/CatalogTable.tsx` `RowDialog` | 46-92 |
| Trigger and mounting (`New <noun>` button, row `Edit` link, `{dialog && <RowDialog/>}`) | `CatalogTable.tsx` | 132-136, 171-175, 203 |
| "Versions" dialog (a list dialog, not a form; hosts a nested `CatalogTable`, so a nested `RowDialog`) | `CatalogAdminPage.tsx` `VersionsDialog` | 34-55 |
| Shell | `src/components/ui/Dialog.tsx` over `src/shared/components/Modal.tsx` | 27-45 / 31-126 |
| Escape, Tab trap, scroll lock, focus in/return | `src/shared/components/useDialogLayer.ts` | 31-83 |
| Form hook (RHF + server error mapping) | `src/shared/forms/useServerForm.ts`, `serverErrors.ts` | 20-44 / 84-122 |
| Field renderer, schema, payload | `src/modules/directory/{FieldInputs,formModel,types}.ts(x)` | 20-78 / 122-161 / 205-215 |
| Field wrapper, input class, error banner | `src/modules/identity/components/ui.tsx` (`Field`, `inputClass`, `FormBanner`) | 42-84 |
| Tests | `src/modules/catalog/__tests__/catalog.test.tsx` | 8 tests, 1 covers create |

All seven Catalog tabs and the Versions dialog go through the same `RowDialog`, so the Catalog is **internally
consistent**; there is nothing to reconcile among them. The one different Catalog dialog is `VersionsDialog`, which is a
read/list container (size `2xl`, title `<Software>: versions`) and is not a create/edit form.

## 1. Shell

- Dialogs MUST use `Dialog` (`components/ui/Dialog.tsx`), which wraps `Modal`. No hand-drawn `fixed inset-0` overlays
  (`docs/frontend/CANONICAL_COMPONENTS.md`).
- A form dialog MUST be mounted only while open (`{dialog && <RowDialog … />}`, `CatalogTable.tsx:203`) and passed
  `isOpen` as a constant `true` (`CatalogTable.tsx:77`). Opening therefore always creates fresh form state.
- Size: form dialogs MUST use `size="lg"` (`max-w-2xl`, `Modal.tsx:24`). List/table dialogs use `2xl` (`max-w-6xl`).
- Title: `Edit <noun>` when editing, `New <noun>` when creating (`CatalogTable.tsx:77`). `<noun>` is lower-case
  singular ("task type"). No subtitle.
- Close affordances come from `Modal`, and are all identical for every dialog: an `X` button with
  `aria-label="Close dialog"` (`Modal.tsx:97-106`), Escape (`useDialogLayer.ts:47`), click on the backdrop
  (`Modal.tsx:58`). All three call the same `onClose`.
- The card is `bg-slate-900 border-slate-800 rounded-xl`, `max-h-[90vh]`; the body scrolls (`Modal.tsx:76,111`).
- Only the top dialog handles Escape/Tab; page scroll is locked; focus returns to the trigger on close
  (`useDialogLayer.ts:5-12, 69, 80`). Dialogs MUST NOT re-implement this.

## 2. Layout

- Body is a single `<form noValidate onSubmit=… className="space-y-4">` (`CatalogTable.tsx:78`). There is **no grid**:
  one column, fields stacked in definition order, `space-y-4`.
- Order inside the form: `FormBanner` → fields → footer row (`CatalogTable.tsx:79-88`).
- Field order is the order of the `fields` array. Tabs use `name`, `code`, `description`, then the kind-specific
  fields, then `sort_order` last (`CatalogAdminPage.tsx:11-16`).
- Required marker: label text gets a literal ` *` suffix (`FieldInputs.tsx:56`). Checkboxes carry no marker
  (they cannot be required).
- Helper text: `hint` on the field def, rendered under the input in `text-[11px] text-slate-500`, **hidden while
  the field shows an error** (`ui.tsx:57-58`).
- Inline error: `<p role="alert" class="text-[11px] text-rose-400">` under the input; invalid input gets
  `border-rose-500` (`ui.tsx:42-47, 59-63`).
- Checkbox: inline `<label class="flex items-center gap-2 text-xs text-slate-300"><input type=checkbox/> Label</label>`
  with no `Field` wrapper (`FieldInputs.tsx:28-34`).
- **Footer** is inside the `<form>`, not in `Dialog`'s `footer` prop: `<div class="flex justify-end gap-2 pt-2">`
  with, in this order, `Cancel` (`variant="ghost"`, `type="button"`) then the submit (`variant="primary"`,
  `type="submit"`, `isLoading={isSubmitting}`) (`CatalogTable.tsx:81-88`).
- Button labels: `Cancel`; `Save changes` when editing; `Create <noun>` when creating (`CatalogTable.tsx:86`).
  (`New <noun>` is the label of the *trigger* button on the page, `CatalogTable.tsx:134`.)
- Styling uses the Tailwind slate/indigo/cyan palette directly, as does the rest of the app. There is no theme-token
  layer, so "no hardcoded colours outside the theme" can only mean "use the shared `inputClass`/`Field`/`Button`".

## 3. Form state

- `useServerForm` (RHF `useForm` + server-error mapping) with `zodResolver(buildSchema(fields))`
  (`CatalogTable.tsx:49-60`). `buildSchema` is memoised on `fields`.
- All values are strings except checkboxes (`Values = Record<string, string | boolean>`, `formModel.ts:4`).
  Required-ness is enforced in one `superRefine`; messages are `Enter <label>.` / `Choose a <label>.`
  (`formModel.ts:131`). Messages therefore come from one place.
- Default values: edit = `fromRow(fields, row)`; create = `blank(field)` per field (`CatalogTable.tsx:59`,
  `formModel.ts:105,152`). Prefill happens **at mount via `defaultValues`**, not with an effect.
  There is no `reset()` anywhere in the dialog: remounting is the reset.
- Editing sends **only dirty fields** (`dirtyFields`, `CatalogTable.tsx:65`); creating sends all non-empty fields
  (checkboxes always) (`CatalogTable.tsx:66`).
- Typing clears the server banner (`register(name, { onChange: clearServerError })`, `FieldInputs.tsx:58-71`).

## 4. Field components

The Catalog uses only: `text`, `textarea`, `number`, `date`, `url`, `checkbox`. They are all rendered by the shared
`FieldInputs` from `FieldDef` entries. The same renderer also supports `select`, `email`, `tel`, `datetime`, `json`,
`entity` (single picker via `EntityPicker`) and `multi-entity` (`EntityMultiPicker`), which the Catalog does not use.
Inline (not shared): the checkbox markup and the `select` markup both live inside `FieldInputs`; nothing is duplicated
inside the Catalog dialog itself. There is no file/attachment field in `FieldInputs`.

## 5. Submit flow

`CatalogTable.tsx:62-74`:

1. `submit(async (values) => …)` from `useServerForm` (wraps RHF `handleSubmit`).
2. Build the payload with `wireValue` (`''` → `null` for number/date/entity, `''` for text; number → `Number`).
3. `await api.update(id, payload)` or `api.create(payload)`. The mutation is a plain async function on the typed
   API object, not a `useMutation`.
4. `await queryClient.invalidateQueries({ queryKey: [...catalogKeys.all, ...scope] })`.
5. `notify.success("<Noun> saved." | "<Noun> created.")` (first letter capitalised).
6. `onClose()`.

- Double submit: the submit button is `isLoading={isSubmitting}`, and `Button` sets `disabled` when `isLoading`
  (`Button.tsx:88`), so a second click or the Enter key's implicit click cannot re-submit while pending. Cancel,
  `X`, Escape and backdrop are **not** disabled while pending.
- Audit-key invalidation is *not* done by the Catalog; `RelatedRecords`/`DirectoryFormPage` do add `auditKeys.all`.
  (See gaps.)

## 6. Errors

`useServerForm.submit` catches anything thrown from the handler and calls `applyServerErrors`
(`useServerForm.ts:28-37`, `serverErrors.ts:84-122`):

- 400 field errors on a field that exists in the form → `setError` on that field, focus moves to the first one.
- 400 field errors for a field the form does not have, and non-field errors → listed in the banner (`details`).
- 400 with everything on a field → no banner.
- 5xx, network, timeout → banner with the friendly `userMessage`; request id shown for ≥500 (`ui.tsx:80`).
- Any other status (401/403/404/409 and so on) → banner with `apiError.message` (`serverErrors.ts:112`).
  There is no per-status wording in the dialog. (I did not audit `mapHttpError` for the wording of each status.)
- The banner is `FormBanner`: `role="alert"`, rose card, at the top of the form.
- The dialog stays open on error; the handler's error is swallowed after display.

## 7. Accessibility and tests

- Dialog: `role="dialog" aria-modal="true" aria-labelledby=<title id>` (`Modal.tsx:70-72`).
- Every input has a `<label htmlFor>` via `Field` (`ui.tsx:42`); ids are `f-<field name>` (`FieldInputs.tsx:27`).
  Hence ids collide if two form dialogs are mounted together; nested `RowDialog` over `VersionsDialog` does not
  cause that today.
- Initial focus is the **first focusable element in the dialog**, which is the header `X` button, not the first field
  (`useDialogLayer.ts:71`; the header precedes the body in the DOM). The Catalog does not pass `autoFocus`.
- Focus returns to the element focused before opening (`useDialogLayer.ts:42,80`).
- Enter submits natively (real `<form>`); Enter inside a `textarea` does not.
- Test conventions: queries by role, label and visible name (`getByRole('dialog')`, `getByLabelText(/^Name/)`,
  `getByRole('button', { name: 'Create task type' })`), responses from captured samples with `mockFetch`.
  There are **no `data-testid`s** in the Catalog (the whole `src` has 4, none in dialogs).
  So the rule is "no test ids; accessible names are the contract".

## 8. Create vs update

One component handles both. The mode is derived from a nullable prop: `row: Row | null`; `editing = row !== null`
(`CatalogTable.tsx:46-48`). Parent state is `{ row: Row | null } | null` (`CatalogTable.tsx:104`).

---

## Rules ("Dialogs MUST …")

Derived strictly from the sections above.

1. Use `Dialog`; never draw your own overlay.
2. Mount the dialog only while open, so every open is a fresh form; do not rely on `reset()` for that.
3. Form dialogs are `size="lg"`; titles are `New <noun>` / `Edit <noun>`; no subtitle.
4. One component for create and edit, selected by a nullable `row` (or equivalent) prop.
5. The body is one `<form noValidate>` with `space-y-4`: `FormBanner`, fields, then the footer row.
6. Footer: right-aligned `Cancel` (`ghost`, `type=button`) then primary submit (`type=submit`, `isLoading`), labelled
   `Save changes` (edit) or `Create <noun>` (create).
7. Fields are rendered from `FieldDef` by `FieldInputs`, or with `Field` + `inputClass` for one-offs. No bespoke
   label/input/error markup.
8. Required fields: ` *` suffix on the label, message from `buildSchema`; hints go through `Field.hint`.
9. Use `useServerForm` with a zod resolver. Do not hand-roll error mapping.
10. On edit, send only changed fields; on create, omit empty optional fields.
11. On success: invalidate the entity's query keys, `notify.success("<Noun> saved." / "<Noun> created.")`, close.
12. Disable-on-pending via `isLoading` on the submit button.
13. Keep the dialog open on failure and show errors via `useServerForm` (field errors inline, rest in `FormBanner`).
14. Accessible names are the test contract; do not add `data-testid`.

## Gaps in the reference (need a decision)

The brief asks for these, but the Catalog does **not** do them. I have not turned them into rules, because
"migrate everything to match the Catalog" and "add this behaviour" are different tasks.

| # | Brief asks for | What the Catalog does | Options |
|---|---|---|---|
| G1 | "Unsaved changes" confirm on close | None. X, Escape and backdrop close immediately and discard. `isDirty`/`useBlocker`/`beforeunload` are used nowhere in `src` (only `ProfilePage` uses `isDirty`, to disable Save). | (a) Add the guard to the shared primitive and so to the Catalog, a behaviour change to the reference. (b) Do not add it. (c) Add it only where the form is long. |
| G2 | Close blocked while pending | Not blocked (`ConfirmDialog` does block: `ConfirmDialog.tsx:37-41`). | Align the form dialog with `ConfirmDialog`. |
| G3 | Autofocus first field | Focus lands on the header `X` button. | Add `autoFocus` of the first field in the shared shell. |
| G4 | Two-column grid, sections | None; single column everywhere in the app's dialogs. | Probably leave as is. |
| G5 | Audit invalidation | Catalog invalidates only its own keys; `RelatedRecords`, `DirectoryFormPage`, `LogTimeDialog`, `EntityNotes` also invalidate `auditKeys.all`. Catalog rows have no history view today. | Leave. |
| G6 | File/attachment, async-select | Not in the Catalog. `entity`/`multi-entity` exist in `FieldInputs`. | Out of scope unless a dialog needs them. |

## Scope question (needs a decision before Phase 2)

"Every entity create/update should be in dialog" collides with the repo as it is: **37 entity create/edit forms (`DirectoryFormConfig`)
are full pages** (`/tasks/new`, `/projects/:id/edit`, and so on) rendered by one generic `DirectoryFormPage`, plus
`CreateDepartmentPage` and `TaskTemplateForm`. Turning them into dialogs changes routes, links, `afterSavePath`
navigation and URL prefill (`?project=…`), which the ground rules forbid. See `dialog-inventory.md` for the list and the
options.

---

## As built (Phases 2-3)

Decisions taken: **D1 (a)** dialogs and pages stay what they are, and share the same pieces; **D2** the three missing
behaviours live once in the shared shell and so also apply to the Catalog; **D3** the command-palette modals are
untouched (they do not call the API; report separately); **D4** form dialogs are `lg`, one- or two-field ones `sm`/`md`.
The page forms take the department form's look.

### Dialog rules, additions to the 14 above

15. Build it on `FormDialog` (`shared/forms/FormDialog`); wording from `formDialogCopy` (`New <noun>`, `Create <noun>`,
    `Save changes`, `<Noun> created.` / `<Noun> saved.`). Action dialogs keep their verb title (`Log time on T-1`, `Assign SH010`).
16. Mount it only while open. A component with an `isOpen` prop renders `isOpen ? <Form/> : null`; there is no manual `reset()`.
17. Closing (Cancel, X, Escape, backdrop) is ignored while a save runs, and asks "Discard changes?" when the form is dirty.
    Success closes through the dialog's own `onClose` and never asks. Pass anything outside the form that counts as a change
    (a checklist, a picker) into `isDirty`.
18. Focus starts on the first field (`data-autofocus` on the form, honoured by `useDialogLayer`).
19. `useServerForm.submit` drops a submit that arrives while one is running.
20. Required fields carry ` *`; tests find fields with `/^Name/`, not the exact label.

### Page rules (department form is the reference)

21. A create/edit page is a `FormPage`: back button (`ChevronLeft` + the list's name) to the list, `h1` with an indigo icon
    (plus / pencil, or the entity's own), one description line, one `Card`, `FormBanner`, the fields, then the footer.
22. Fields sit in a two-column grid from `sm` up; text areas, JSON and multi-record fields span both (`FieldInputs grid`).
23. Footer is `FormActions layout="page"`: ruled, right-aligned, outlined `Cancel` (a link back to the list) then the
    primary `Save changes` / `Create <noun>` with a save icon.
24. Success navigates as before (`afterSavePath`); the page never closes itself.
    Leaving by the back button or Cancel asks "Discard changes?" when the form is dirty (not while a save runs), and the browser
    warns on reload or a closed tab. Moving away through the menu is not guarded: the app uses `BrowserRouter`, where
    `useBlocker` is unavailable, and a data router would change the route structure.
25. Every `DirectoryFormConfig` names its list (`listTitle`) for the back button.

### Behaviour differences from before (Catalog and others)

- Catalog: closing a typed-in form asks to discard; Cancel/X/Escape/backdrop do nothing while saving; focus lands on the
  first field, not on the X. The DOM is otherwise identical (diffed create and edit dialogs: only `data-autofocus` differs).
- Related records (contacts, contracts, shows, episodes, sequences, tracks): `Add <noun>` / `added.` became
  `New <noun>` / `Create <noun>` / `created.`; the trigger button on the list still says `Add <noun>`.
- Assign artist: `Save` is now `Save changes`; it is a real form (Enter submits).
- Duplicate project: failures show on the field or in the dialog (was a toast); `Duplicate Project` is `Duplicate project`;
  it starts from the suggested name on every open (the old state outlived the dialog).
- Role, group, token, reauth, note: required labels now end in ` *`.
- Department page: errors use the shared banner (the request reference shows for 5xx only).
- Record pages: Cancel and the back button ask before dropping typed-in changes; the browser warns on reload.
- Record pages: now full width in a card with a header, and two columns (were a single `max-w-2xl` column with a left footer).

### Not migrated, and why

- Bulk import wizards (shots, assets, tasks): a multi-step grid, not a form dialog.
- Command-palette modals (`ActionDispatcherModals.tsx`): **removed** (branch `fix/command-palette-actions`). They called no API behind "Create"/"Assign"/"Archive"/"Restore"/"Change status". The Create commands now open the real create pages (`/clients/new`, `/tasks/new`, …); the commands that need a chosen record (assign, archive, restore, change status, approve a review) and "Create Sequence" (sequences are made inside a project) are gone.
- "Copy your secret now" (`TokensPage`): display-only and deliberately cannot be dismissed.
- Inline forms (project members and notes panels, IP rules, create/link login), LDAP settings, profile, auth screens: not dialogs or entity pages.

### Follow-ups

- `RecordActions`/`DirectoryListPage` row-action prompts ask for a date or text with their own markup; they could use `FormDialog`.
- Inline forms could offer a "dirty" guard on navigation; none does today.
- Menu navigation away from a dirty record page is not guarded (needs a data router, i.e. a route-structure change; decide separately).
