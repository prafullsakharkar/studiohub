# Phase 34: live coverage of the screens added in phases 29 to 33

`frontend/src/test/live/newScreens.live.test.tsx`: 12 tests against a REAL backend (the throwaway factory-seeded one,
`docs/sync/tools/run_role_smoke.sh --vitest ...`). The manager signs in once and builds a project, a shot, two versions
with preview addresses, a review holding both, a workflow, two export jobs, and resources with bookings. Each test then
renders the real page and checks it against what the server sent.

| Screen | What is checked against the server |
|---|---|
| Versions as cards | Table to Card to Table; one card per version with its code and the thumbnail address the server returned |
| Version Media tab | The video's `src` is the `video_url` the server stored; the first frame is the version's own (1001) |
| Version Compare tab | A is this version, B the other of the same shot; both videos carry their stored addresses; the wipe is the first mode; Swap A and B keeps both pickers right |
| Review overview | The details name the review; the version list holds both versions the server attached |
| Review viewer | Loads the first version; A/B Wipe puts it against the second and loads that version's detail; drawing is off; Side-by-Side gives two figures; toggling off returns the player |
| Review Versions tab | "Compare in A/B Wipe" is offered on the second version only, and opens the viewer, compared |
| Workflow board | Draws the four stored nodes; Edit board, add a node, Save board writes five nodes through the API, keeps the three transitions and the node positions; a page opened afterwards draws five; a lead (`workflow.view`, not `update`) sees the board and no Edit control |
| Publishing summary | The Jobs tile equals the server's count of all jobs, so the page knows every status the server has |
| Job History | Lists the export jobs of the same shot, newest first, marks this one, links the other |
| Scheduling Utilization | A `Booked` 8 of 40 hours reads 20 %; the same hours as an `Available` slot read 0 % |
| Scheduling Assignments | The booking is listed under its resource |

## Mutation check (live)

Five breaks of the product code, one live run each, every one caught; files restored byte for byte (hash checked):
the Versions tab no longer opening the viewer, the board save ignoring the edited nodes, free time counted as use, a
job status dropped from the summary, and the history not newest first. (A sixth run looked "survived" only because it
started before the previous backend had finished flushing and failed in setup; run alone it was caught.)

## Found while writing it

- A booking made through the API **without a status is `Available`** (free time), not `Booked`; Utilization is right to
  count it as 0. The UI form sends `Booked`. Nothing to fix; the test now covers both.
- Picking the same version on both sides of the compare gives "V1 against V1". Allowed, as in the old app.

## Running all the live files together

Nine live files in one run made 57 sign-ins and hit the backend's login throttle (30 a minute per client): 12 sign-ins
answered 429 and three files failed or skipped in setup. That is a limit of the harness, not of the product. Split in
two runs on fresh backends everything passes:

| Run | Files | Result |
|---|---|---|
| 1 | deliveries, newScreens, work, review, playlists, production | all six passed (the files after them hit the throttle) |
| 2 | scheduling, scheduleViews, publishing | 11 of 11 passed, 16 sign-ins, none throttled |

All nine files pass: deliveries 4, newScreens 12, work 7, review 3, playlists 1, production 6, scheduling 4,
scheduleViews 4, publishing 3 (44 tests). The two limits (throttle, and `deliveries` before `publishing`) are written
at the top of `run_role_smoke.sh`.

## Not covered live

The delivery, publishing, review and media cards (versions are), the player's real playback, the compare's real drawing
and sync, and the task board beyond `work.live`. Those need a real browser (see phases 31 and 33 for the Chromium checks).
