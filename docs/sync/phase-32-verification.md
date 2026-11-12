# Phase 32: the rest of the missing-functionality list: verification

Same branch as Phases 29 to 31 (`sync/phase-29-workflow-board`), **uncommitted, not pushed, not merged**. **No backend file was touched**; two backend requests were written (CR-51, CR-52) in `docs/sync/backend-change-requests.md`.

The comparison with `studiohub-react` (versions, publishing, reviews, scheduling) listed what this frontend lacked. Phase 31 built the media player. This phase builds everything else on the list that the backend can serve, and writes a request for what it cannot.

## 1. Built

**Reviews**
- **Annotation drawing** (`AnnotationLayer.tsx`, `annotationModel.ts`, the *Draw on this frame* section of the Media viewer): brush, rectangle, ellipse and arrow, five colours, undo, clear, a note. The video pauses when drawing starts. A drawing belongs to the frame it was started on: stepping away shows where it is ("Go to it") and does not take strokes on another frame; Save goes to the drawing's frame, with the timecode. It is stored in `drawing_coordinates` as `{ version: 1, shapes }` with every coordinate a fraction of the picture, at most 50 shapes and 400 points a stroke. Drawings already saved on the frame being shown are drawn over the picture (dimmed while drawing); the feedback list marks "Annotation · drawing". What comes back from the server is validated shape by shape (finite numbers inside the picture, a plain `#rrggbb` colour or the default), and the bare `{x, y}` pin the older client stored is shown as a ring.
- **Overview tab** (`ReviewOverview.tsx`, now the first and default tab): code, what it is for, status and verdict, lead reviewer, client, counts (versions, participants, open comments, annotations, notes), the verdict tally with the participants, the versions (linked, in order) and the five latest events.

**Versions** (`VersionExtras.tsx`, `VersionMedia.tsx`)
- **Compare** tab: this version against another of the same shot or asset (newest offered first), **side by side, wipe or difference**, on one transport (`shared/components/media/MediaCompare.tsx`): the first video drives the clock, the second is pulled back if it drifts by half a frame, the length is the shorter of the two, both settle on one frame when paused, and a mode change returns to the frame being shown.
- **Playlists** tab: the project's playlists that hold the version, with its place in each. **Publishing** tab: published or not (and what is missing), its export jobs (`version_id` filter), its registered files.
- **Notes**: a version has a `notes` and a `changelog` text, both already shown on Overview; the server has no notes list for a version, so there is no separate tab.

**Publishing**
- A **summary strip** above the jobs list (`PublishStats.tsx`, through a new optional `summary` on the list config): jobs, running, exported, failed, cancelled and the success rate of the finished ones, narrowed to the project of the list; one small count request per status.
- A **History** tab on a job (`JobHistory.tsx`): every export job for the same shot or asset, newest first, this one marked.

**Scheduling** (`planningModel.ts`, `UtilizationPage.tsx`, `AssignmentsPage.tsx`, `EventWorkspace.tsx`)
- **Utilization**: booked hours against each resource's weekly capacity for a week (only Booked and Overbooked time counts; a booking across the week's edge counts for the part inside), sorted into over capacity, well used (70 to 100%) and under-used, with the average.
- **Assignments**: who is booked on what in a week, each booking linked to its task or event, and the resources with nothing booked apart. Only Booked and Overbooked hours count against capacity there too (an inconsistency with Utilization was caught by a test and fixed).
- **Event page** (`/scheduling/events/:id`): when, where, project, meeting link, description, notes, the crew (the bookings on the event), the status moves (`schedule.update`) and Edit; the events list and every calendar item now open it (a reader can open it too; Edit is on the page).
- New routes, navigation entries and permission-registry rules (`schedule.view`).

## 2. Not built, and why

| Item | Why | What is needed |
|---|---|---|
| Version **Attachments** tab (and on reviews, shots) | `Attachment` has no link to any record: it is a per-user file store with signed download links | **CR-52**: an optional entity type and id on attachments, two list filters, and a decision on who may see an attachment of a record |
| Publish **revision chain** ("republished from") | `PublishItem.republished_from` exists but no serializer returns it | **CR-51**: return it, and an optional filter. Until then the History tab shows every job of the same shot or asset |
| Review **share** | The server has no share action on reviews (playlists have one; it is built) | A backend feature, not requested |
| Publishing **payload size** in the summary | The job rows carry no size; summing the file registry would download it | Not requested |

## 3. Verification

Gates: `pnpm typecheck` clean; `pnpm exec biome check src --diagnostic-level=error` clean (it caught three `useJsxKeyInIterable` errors in the first Assignments page, fixed); `pnpm test` 150 files, 1563 tests; `pnpm build` clean; `unreachable.mjs` lists only tests, `*RowKeys.ts` and test helpers.

New tests, on captured responses (version, review, playlist, publishing and scheduling samples, changed by a field or two only where a case needed it): drawing model and layer, drawing in the viewer, review overview, compare, version tabs, job summary and history, planning arithmetic, utilization, assignments, event page. One existing test was changed on purpose: a calendar event used to link to its edit form only for someone who may change events; it now opens its page for everyone.

Mutation checks (each broke one behaviour and failed a test): a parser that accepts any number; Save using the current frame instead of the drawing's; a resolved comment counted as open; no drift correction in compare; playlists not filtered by version; the success rate over all jobs; the history ignoring shot versus asset; blocked time counted as booked; status buttons shown to a reader.

**In a real browser (Chromium, throwaway pages, deleted afterwards; the seeded MP4s).** The pixels of the painted frame were read through a canvas, as in Phase 31.
- **Compare**: side by side, 6 steps all landed both videos on the frame the counter said; the wipe clip followed the slider and kept the frame across the mode change; the difference of two different videos was not black and of a video against itself was exactly zero in all 230,400 pixels; playback drift between the two was 0.0001 s and a pause left both on the same frame.
- **Drawing**: with the real mouse, a rectangle, an arrow and a brush stroke came back as exactly the fractions of the picture the pointer was at (for example the rectangle at 0.2, 0.3 with size 0.25 by 0.3); the save carried frame 1011 and its timecode; a saved annotation showed on its own frame at its stored position and on no other.
- **Scheduling pages** were looked at on stubbed data (Utilization, Assignments, Event page). This showed the Utilization bars ending at different widths, fixed.
- **A flaw in my own measurement**: the first compare run seemed to show some seeded videos one frame off. The moon detector required a red channel above 215, which fails for some hues; with a hue-independent test all six seeded previews are frame-exact. The previews were re-encoded without B-frames (the usual for review proxies); the registered copies under `store/` and the checksums in the database are unchanged.

## 4. Not verified

- **Chromium only**; Firefox and Safari were not run. Touch and pen drawing was not tried.
- Nothing was run inside the signed-in app against a backend (none was running). The publishing summary and History, the version tabs, the review Overview and the new scheduling screens were checked in jsdom, and the scheduling screens and the player, compare and drawing in a browser on stubbed or seeded data.
- A drawing is stored against the review, not the version: if a review has several versions, an annotation on frame 1040 shows on that frame of whichever version is on show (the same is true of comments).
- The summary strip makes seven count requests when the list loads; a single aggregate route would be cheaper.
- Compare with sound, full screen and long clips were not tried.
