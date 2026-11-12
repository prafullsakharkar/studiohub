# Phase 31: the media player (first step of the missing-functionality list): verification

Same branch as Phases 29 and 30 (`sync/phase-29-workflow-board`), **uncommitted, not pushed, not merged**. **No backend file was touched.**

A comparison of `studiohub-react` with this frontend (versions, publishing, reviews, scheduling) listed the media player as the largest gap: the old review had a frame-accurate player with stepping and annotation drawing, the old version had a Media tab and Compare, and this frontend had none (the annotations panel said "Drawing on the frame needs the media player, which is not part of this screen"). The owner asked for the player first.

## 1. What was built

**`shared/components/media/MediaPlayer.tsx`** (one player, `frameTime.ts` for the arithmetic):
- A video with a scrub bar, play and pause, back and forward one frame and ten frames, jump to the first and last frame, loop, speed (0.25, 0.5, 1, 2), mute and full screen.
- Frames carry the number a production gives them (`startFrame`, often 1001): the display shows the frame, the timecode counted from the first frame (`HH:MM:SS:FF`) and the range. A seek aims at the middle of a frame, so the video never shows the frame before.
- Keys while the player has focus: Space, Left and Right (Shift for ten), Home, End, L, M, F. Keys typed into the speed menu or the scrub bar are left alone.
- Markers on the timeline (a comment, an annotation, a resolved one in grey); a marker or the handle's `seekToFrame` goes to its frame; `onFrameChange` reports the frame.
- The length comes from the video itself: a version whose frame range is longer than its preview plays the preview's frames.
- A still image, or a version with only a thumbnail, shows the picture with no transport; nothing linked says so; a video that fails to load says so. Only an http(s) address is used (`safeWebUrl`), so `javascript:`, `data:` and `file:` addresses show the "no preview" message.

**Where it is used:**
- **Review → Media viewer** (`ReviewViewer.tsx`, now the first and default tab): the review's versions (a switch when there are several), each loaded for its video, frame rate and first frame; the comments and annotations that name a frame are marked on the timeline and listed beside the player ("Feedback on frames", click to go there); a box to comment on the frame being shown, sent with its frame number and timecode (`review.update`, not on a closed review).
- **Version → Media tab** (`VersionMedia.tsx`): the version's own preview, its facts, and the media linked to its shot or asset to put in the same player (a media item has no frame rate or first frame of its own, so it plays at the version's rate from frame 1).
- The annotations panel no longer says the player is missing; it points to the viewer and says drawing is not available yet.

## 2. Verification

Gates: `pnpm typecheck` clean; `pnpm exec biome check src --diagnostic-level=error` clean (the new files are warning-free apart from `any` in the test samples, as in the other tests); `pnpm test` 144 files, 1503 tests (frame arithmetic 6, player 14, viewer and version tab 10, all on captured reviews, versions and media); `pnpm build` clean; `unreachable.mjs` lists only tests, `*RowKeys.ts` and test helpers (`test/mediaElement.ts` is the new one: a fake video clock, because jsdom has no media pipeline).

Mutation checks: no clamp at the ends, no address check, a comment sent without its frame number, and seeking to the start of a frame instead of its middle each fail a test.

**In a real browser (Chromium, a throwaway page, deleted afterwards; the real seeded MP4 served by the dev server, 24 fps, frames 1001 to 1072).** jsdom cannot show whether a seek lands on the right frame, so the page read the picture itself: the seeded video moves a moon a known distance per frame, so the moon's position in the painted pixels (read through a canvas) gives the frame the picture really shows, to compare with the number the player displays.
- Stepping: 14 steps (first, ±1, ±10, last, back) all landed on the frame the pixels showed.
- A timeline marker, a feedback entry, ArrowRight, Shift+ArrowRight and ArrowLeft all landed on the right frame; Loop and speed reached the element.
- Playback exposed a real problem: after playing and pausing, the counter was sometimes one frame behind the picture. The browser can paint one more frame after a pause and its clock can trail the picture. While playing, the player now reads each presented frame's own timestamp (`requestVideoFrameCallback`; the clock where that is missing), and on pause it **settles on a frame boundary** by seeking to the clock's frame, so the counter and the picture are the same frame. After the change, 14 pauses at times from 120 ms to 2.3 s all matched, and a step after a pause still matched.

## 3. Not verified, and limits

- **Chromium only.** Firefox and Safari were not run. Firefox has `requestVideoFrameCallback` in recent versions; where it is missing the player follows the clock while playing (covered by a test, not seen), and the pause settles on a frame either way.
- **Not run inside the signed-in app against a backend** (no backend was running). The two screens were checked in jsdom on captured responses, and the viewer on a throwaway page with `fetch` stubbed.
- A video **with sound**, the full-screen button, very long clips, and frame rates that are not whole numbers (23.976) were not tried in a browser; the frame arithmetic is tested for 23.976, 25, 30 and 60.
- **Annotation drawing, Compare (split, wipe, difference) and the version Playlists, Publishing, Attachments and Notes tabs** from the gap list are not built. Drawing and Compare can sit on this player; a drawn annotation would be stored as `drawing_coordinates` (the field exists on the server).
- Pointing a media item or a review at a video is still by address (the studio records links, it does not hold files); the seeded previews are served by the frontend dev server.
