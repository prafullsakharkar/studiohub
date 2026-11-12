# Phase 33: the review compare screen, as the old app has it

Reference: `../studiohub-react`, `src/shared/components/media/MediaCompare.tsx` (the compare screen),
`src/modules/versions/components/VersionCompareModal.tsx` (A against a sibling version),
`src/modules/reviews/components/workspace/tabs/ReviewMediaTab.tsx` (the A/B Wipe and Side-by-Side toggles and the
"Compare:" picker in the review player) and `ReviewVersionsTab.tsx` (the "Compare in A/B Wipe" button).

## What was missing

| Old app | Before this phase |
|---|---|
| Five modes: Wipe / Split (the default), Side-by-Side, Difference, Onion Skin, A/B Flip | Three: Side by side (default), Wipe, Difference |
| A draggable splitter with a round handle, presets 25 / 50 / 75 | A range slider under the picture |
| A and B pickers in the toolbar, with a swap button, blue (A) and amber (B) corner badges | Two names, no pickers |
| Difference with a gain of 1 / 2 / 4 / 8 | No gain |
| Onion Skin with an opacity slider | Not there |
| A/B Flip, with Show A / Show B and the `T` key | Not there |
| Loop, 0.5 / 1 / 2 speed, fullscreen, jump to start, frame HUD with an FPS lock badge, space and arrow keys | Play, step 1 and 10, first and last frame |
| In a review: A/B Wipe and Side-by-Side toggles and a version picker over the player | No compare in the review at all |
| In a review: "Compare in A/B Wipe" on a version of the Versions tab, which opens the player on it | Not there |

## What was built

- `shared/components/media/MediaCompare.tsx` rebuilt to the old layout. Kept from before, because it is better than the
  old one: frame-accurate seeking (middle of the frame, settle on a frame boundary on pause), the second video pulled
  back onto the first, the shorter clip sets the length, web addresses only (`safeWebUrl`), and a real pixel difference
  drawn on a canvas (the old one used `mix-blend-mode`, which cannot be read back or tested).
  - Wipe: A on the left, B on the right, a draggable splitter (pointer capture, kept 2 to 98 %, arrow keys, Shift for 10),
    presets, `role="slider"` with `aria-valuenow`.
  - Pickers: `choices` and `onPick(side, id)`; a swap keeps the frame, and a pick on the swapped screen is reported for the
    side the caller owns.
  - Loop restarts both videos from the head and goes on playing; without it the compare stops on the last frame.
  - `onFrameChange` reports the frame shown, `initialMode` opens it in a mode.
  - Selected states use `SELECTED`, the play button `PRIMARY_FILL` (DESIGN_SYSTEM.md §1); A and B keep blue and amber, as
    in the old app, because they name a side.
- `VersionExtras.tsx` (`VersionCompareTab`): A is this version, B the newest other of the same record; either side is
  switchable to any version of the record (the old `VersionCompareModal`).
- `ReviewViewer.tsx`: A/B Wipe and Side-by-Side toggles when the review has more than one version; the compare replaces the
  player. A comment still names the frame shown. Drawing and "go to frame" are off while comparing, and the page says so.
- `ReviewPanels.tsx` / `ReviewWorkspace.tsx`: "Compare in A/B Wipe" on every version but the first; it opens the viewer
  tab on that version against the first.

No backend change; no new API call (the compare reads the two versions' `video_url` and `thumbnail_url` it already
fetched for the player).

## Checks

- `pnpm typecheck`: clean. `pnpm exec biome check src`: 0 errors. `pnpm test`: 150 files, 1582 tests, exit 0
  (including the kit-style guard, which caught an indigo fill I had copied from the old app).
  `pnpm build`: built.
- Tests: `mediaCompare.test.tsx` rewritten for the new screen (19), 6 added to `mediaViewer.test.tsx`, 1 to
  `review.test.tsx`, the version compare test updated.
- Mutation check, 13 mutations, each caught by a test, files restored byte for byte (checked by hash): wipe layer order,
  swapped-pick side, loop restart, swap resetting the frame, difference gain, `T` outside the flip, drawing while
  comparing, the initial mode, "go to frame" while comparing, picking A, the compare button on the first version, the
  Versions tab not opening the viewer, the version tab's A pick.
- In Chromium, on the seeded previews (a throwaway page, deleted afterwards): a real mouse drag moved the splitter to 25 %
  and stayed at 98 % past the edge, the handle is a 32 px circle; Difference painted real pixels (64 % lit between V001 and
  V002) and the gain applied; Onion set the opacity of A to 0.3; `T` flipped; Side-by-Side drew two figures; both videos
  played with 0 ms drift, also at 2x; with loop on the frame went 1070, 1001, 1004 ... and kept playing, with loop off it
  stopped on 1072.

## Live runs (not part of this phase's code)

Five live files failed on the first run against a real backend for reasons older than this phase: new shot, sequence and
task codes must start with the project code, a shot needs a sequence, and one run order contaminated another. The
fixtures in `work`, `review`, `playlists` and `production` were brought up to those rules; all eight files then passed,
across five runs. No product code changed for that.

## Not done

- No live (real backend) run of the compare screens, the workflow board, the cards, the player or the review overview.
- Firefox and Safari were not tried.
- The old review player compared on one shared transport with the drawing layer on; here the compare is its own screen
  and drawing is off while it is open. Putting both on one picture needs the compare to expose its frame area, which is a
  larger change.
- Review share still needs a backend feature.
