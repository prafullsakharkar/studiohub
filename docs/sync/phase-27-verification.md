# Phase 27: the delivery milestone picker: verification

Branch `sync/phase-27-milestone-picker` (from `develop` at `9a492809`; `main` holds the same tree), **not pushed, not merged**. **No backend file was touched.**

The owner chose it ("Go with your suggestion, Phase 27") from the deferred list. A delivery milestone (kind `delivery`) names one of its project's deliveries. Since Phase 10 the form asked for that delivery's id as pasted text.

## 1. What the server decides (captured, `samples/scheduling/_milestone_delivery_flow.json`, `tools/test_capture_milestone_delivery.py`)

| Case | Answer |
|---|---|
| Create, delivery kind, a delivery of the project | `201`, `delivery_package_id` stored |
| ... a delivery of **another** project | `400 {"delivery_package_id": ["Unknown delivery."]}` |
| ... an empty string (what a text field sends for a blank) | `400 "Must be a valid UUID."` |
| ... `null` | `400 "A delivery milestone needs a delivery."` |
| General kind with a delivery | `400 "Only a delivery milestone names a delivery."` |
| Edit: a different delivery, sent alone | `200` |
| **Edit: kind `general` alone on a delivery milestone** | **`400 "Only a delivery milestone names a delivery."`** (the server merges the saved delivery) |
| Edit: kind `general` with `delivery_package_id: null` | `200`, the delivery is released |
| Edit: kind `delivery` alone after that | `400 "A delivery milestone needs a delivery."` |
| The picker's list, `projects/{id}/deliveries/` | paged (`count`, `next`), searches name and code (`?search=Zzzz` is 0, `?search=0001` is 1); needs `delivery.view` and full project access |

## 2. A bug this found in the existing form

The old form hid the delivery field when the kind was not "delivery" and, like every hidden field, did not send it. So editing a delivery milestone **to the general kind was always refused** (row 6 above): the user had no way to give the delivery up. It is live-reproduced (the mutation in §4).

## 3. What changed (frontend only: 4 files, +56 / -2, plus tests and the capture)

- `scheduling/pickers.tsx`: `ProjectDeliveryPicker`, an `EntityPicker` over `deliveriesApi.ofProject(projectId)` (the studio list ignores a project filter, CR-17), labels `CODE · name`, disabled until a project is known.
- `scheduling/records.tsx`: the field is now an `entity` field, **required** while the kind is delivery, and `MilestoneDeliveryField` wraps the picker: it clears the choice when the project changes (a delivery of another project would be "Unknown delivery."), and shows "Choosing a delivery needs permission to view deliveries." instead of a picker to someone without `delivery.view` (the route would answer 403).
- `directory/types.ts`, `directory/DirectoryFormPage.tsx`: a new field option `clearWhenHidden`. On edit, when the field is hidden and the saved record still holds a value, the form sends a blank (null for an entity) so the server accepts the change of kind. Only the milestone's field sets it; nothing is sent when the record never had a value.

## 4. Evidence

| Check | Result |
|---|---|
| Unit tests (`milestoneDelivery.test.tsx`, built from the capture) | **9**: the server's rules pinned; the picker lists the project's deliveries and the chosen id is sent with the kind; a delivery milestone without a delivery is not sent; no picker and no request without `delivery.view`; the saved delivery is shown on edit and a different one is sent alone; delivery to general sends `{kind, delivery_package_id: null}`; renaming sends only the name; a general milestone that never had a delivery sends no blank; changing the project clears the choice |
| Mutations | **10 run, 9 caught at once, 1 survivor** (sending the blank even when nothing was saved: the tests never edited a general milestone) fixed by a new test, then caught. The others: the clearing branch off, the flag off, the field always visible, no reset on project change, no permission gate, not required, the studio list instead of the project's, the wrong project key, the label |
| Live (real backend, fresh seed), `milestoneDelivery.live` | **2 of 2**: the producer opens the real form, the picker lists both of the project's deliveries, the chosen one is stored; on edit it is shown and, with the kind moved to general, released (`kind: general`, `delivery_package_id: null`). **Live mutation caught:** with `clearWhenHidden` removed the second test fails against the real server (the 400 of §2) |
| Gates | `tsc` 0; **108 files / 1,100 tests** (+1 file, +9; base 107 / 1,091); build OK; Biome **0 errors, 801 warnings** (unchanged; one `any` I added was typed); nothing new unreachable |
| Role smoke | **7 of 7** (§6) |

## 5. Limits, stated plainly

- **Full project access is needed** for the picker's list (the route is `ProjectScopedAPIView`): a milestone manager narrowed to a show or department sees the list's error message with Retry, as every picker does, instead of the list. The old pasted-id field would have worked for them. No such user exists in the role matrix today; I did not add a fallback.
- **No deliveries yet:** the picker shows its empty placeholder; the milestone is created as a general one (or after a delivery exists).
- **A deleted or archived delivery** that a milestone still names is shown through `fetchOne` (the delivery detail), or as "Unknown record" when the user may not read it.
- **The milestone list** still shows the delivery by kind only (no delivery column): the row carries just the id, so showing a name would be one request per row. Not done.

## 6. Smoke

**7 of 7 pass** (36.3 minutes). One route reload, the self-MFA user's `/dashboard`, blank with `net::ERR_NETWORK_CHANGED` and recovered at the first reload; no sign-in reload was needed. The smoke visits static routes, so it does not open the milestone form: the form's behaviour is proven by the unit and live tests in §4, the smoke shows that nothing else broke.

## 7. Questions for the owner

1. **Merge** `sync/phase-27-milestone-picker` into `develop` and push? CI will run the same gates.
2. **Next.** Still open: applying the theme and locale (needs your Q-22 decision, and `/auth/me` returning `timezone` and `language`, a backend change), a checksum verification (no backend route exists, so a change request first), cancelling a leave (backend), drag-to-move on the scheduling grid (a design decision), the backend Dependabot failure (`django-celery-beat` against Django 6.1), and whether re-adding a project member should stop reactivating them (CR).
