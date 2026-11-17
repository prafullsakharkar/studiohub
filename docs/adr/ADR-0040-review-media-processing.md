# ADR-0040: Running ffmpeg on uploaded review media, in its own worker, and serving the results through signed links

Status: **accepted** (planned 2026-11-13 as review-pipeline RP-5; approved by the owner the same day: "go ahead", every
recommendation of Q-RP-24 to Q-RP-31). **Amended by RP-12** (2026-11-16, Q-RP-51 to Q-RP-56 = A): image sequences and
burn-ins, see "Amendment: image sequences and burn-ins" below. **Amended by RP-14** (2026-11-17, Q-RP-63 to Q-RP-67 = A):
remaking a copy from its kept upload, see "Amendment: remaking copies" below. **Colour** of review copies (RP-15, 2026-11-17): [ADR-0041](ADR-0041-review-colour-management.md) · Plan and contracts: `docs/review-pipeline/PLAN.md` (RP-5),
`docs/review-pipeline/CONTRACTS.md` (C-RP-19 to C-RP-22) · Evidence: `docs/review-pipeline/rp-5-verification.md`

## Context

A version held links only (`video_url`, `thumbnail_url`), typed by someone. Reviewers could play only what a browser
plays, at whatever size it was. ShotGrid and ftrack take an artist's movie (ProRes, DNxHD, a QuickTime), make an H.264
review copy, a thumbnail and a filmstrip, and play that. Q-RP-6 (2026-11-12) put ffmpeg in a worker image.

Running ffmpeg on a file someone uploaded is the risk. ffmpeg reads dozens of container formats and protocols. A file
can claim to be a movie and be an HLS playlist that names `file:///etc/passwd` or an `http://` address inside the
network. ffmpeg's error output can quote paths and contents. A file served back from our domain could be HTML or SVG
and run in the page.

## Decisions

1. **What is accepted.** Movies (`mov`, `mp4`, `m4v`, `mkv`, `webm`, `mxf`, `avi`) and stills (`jpg`, `jpeg`,
   `png`, `tif`, `tiff`). EXR and DPX sequences are out (one file per upload). *Amended by RP-12: sequences come in
   through their own routes, below.* Two checks before anything is stored:
   - the extension must be on that list;
   - the first 16 bytes must show a container (QuickTime/ISO boxes, Matroska/WebM, MXF, AVI, JPEG, PNG, TIFF) whose
     extensions include the uploaded one.

   Anything else is a 400 on `file`. The limit is `REVIEW_MEDIA_MAX_BYTES` (2 GiB by default), and nginx's location
   for the route takes bodies up to it.
2. **How ffmpeg is run.**
   - Commands are argument lists, never a shell (`apps/production/transcode/ffmpeg.py`).
   - Every input is opened with the demuxer the first bytes chose (`-f <demuxer>`), `-format_whitelist <demuxer>`,
     `-protocol_whitelist file` and a `file:` URL. A playlist or a concat list, or a nested network or file
     reference, is never followed.
   - The work happens in a fresh folder; results are moved into place only when all of them exist.
   - Each job has one time budget (25 minutes, the probe at most 2) under Celery soft and hard limits of 27 and
     30 minutes.
3. **What the user sees of a failure.**
   - A fixed code (`probe_failed`, `unsupported_stream`, `transcode_failed`, `timeout`, `source_missing`) with a
     fixed sentence.
   - ffmpeg's stderr goes to the log (the last 2,000 characters), never into a response.
   - The audit trail records the upload, retry and removal with the row id, kind, status and attempts; it does not
     record the file's name.
4. **Where it runs.**
   - A `worker` stage of the Django image adds Debian's ffmpeg (7.1.5 in trixie). Only the new `celery-media`
     service runs it, consuming the `media` queue alone (concurrency `REVIEW_MEDIA_CONCURRENCY`, default 1,
     prefetch 1, `acks_late`).
   - The web image and the general worker have no ffmpeg.
   - The task is queued by name through the project's Celery app (`core.celery`), with no result. The web process
     loads that app nowhere else: Celery's default app knows neither the broker nor the routes.
5. **How results leave.**
   - Only through `GET review-media/{id}/{proxy|thumbnail|filmstrip}/?token=`. The token is signed (salt
     `production.review_media.stream`) for one user, one row and one output, for `REVIEW_MEDIA_LINK_TTL_SECONDS`
     (default 3600).
   - Every request checks again that the user is active, holds `version.view` and reads the version (the narrowing
     of `GET versions/{id}/`), and that the row is still `ready`. Anything else is a 404.
   - Content type: `video/mp4` or `image/jpeg`, from what we wrote, never the upload's. Every answer carries
     `nosniff`, `Content-Security-Policy: default-src 'none'; sandbox` and `Cache-Control: private, no-store`.
   - Behind nginx the file leaves through `X-Accel-Redirect` (`MEDIA_ACCEL_PREFIX`). Without it, Django answers a
     single `Range` (206/416). `check --deploy` warns (`production.W001`) when the feature is on and the prefix is
     empty.
   - The uploaded source is never served.
6. **One switch.** `REVIEW_MEDIA_ENABLED` is off by default. When it is off, an upload is a 409
   `review_media_disabled`, decided before the request body is read.

## Data

`production_review_media` (migration `production.0008`):
- one row per upload: the source's name (shown, never used as a path), size, SHA-256 and container, the probe, the
  three output paths, the attempts and the timestamps;
- partial unique constraints: at most one row `queued`/`processing` and one `ready` per version;
- older rows stay as `superseded` or `removed`, without files.

Files live under `MEDIA_ROOT/review_media/<project>/<version>/<row>/`.

## Consequences

- Deployments that switch it on need the `worker` image target, the `celery-media` service with the media volume,
  `MEDIA_ACCEL_PREFIX`, the nginx location, and space for Django's upload temp files (`FILE_UPLOAD_TEMP_DIR`)
  (`docs/07-deployment/pre-deploy-checklist.md`).
- A link expires: the frontend refetches the version a minute before `links_expire_at`, and a player then reloads the
  movie.
- Artists hold `version.view` but not `version.update`, so they watch review movies and do not upload them. *Amended by review-pipeline RP-10 (C-RP-26, Q-RP-41 = A): a version's artist who holds `version.create` (the seeded `artist` role does) uploads, retries and removes the review movie of their own version.*
  Uploading is open to org-admin, production-admin, vfx-supervisor, lead-artist (and platform-admin).
- ffmpeg is a large attack surface even with the whitelists. The worker runs as the image's `app` user and mounts no
  volume but the media one. Debian security updates reach it with each image rebuild, and Trivy scans the `worker` image in
  CI.

## Amendment: image sequences and burn-ins (review-pipeline RP-12)

Plan and contracts: `docs/review-pipeline/PLAN.md` (RP-12), `docs/review-pipeline/CONTRACTS.md` (C-RP-31 to C-RP-33).
Evidence: `docs/review-pipeline/rp-12-verification.md`.

1. **How a sequence arrives.** `POST versions/{id}/review-media/sequence/` opens it (a name, an extension, a range),
   `POST review-media/{id}/frames/` takes up to 50 frames a request, and `POST review-media/{id}/complete/` queues it
   once every frame is in. No archive is unpacked, and Django's 100-file limit is not raised. An upload with no part
   for 24 hours is removed by the sweep; its folder is deleted by `production.discard_review_media` on the `media`
   queue, because the sweep's worker has no media volume.
2. **What a frame is.** EXR, DPX, TIFF, PNG or JPEG, one name and one extension, no gap, at most
   `REVIEW_MEDIA_MAX_FRAMES` (2,000) and `REVIEW_MEDIA_SEQUENCE_MAX_BYTES` (20 GiB). Each frame's first bytes must be
   its format (EXR `76 2f 31 01`, DPX `SDPX`/`XPDS`, and the still signatures above). A part with one bad frame is
   refused whole. A frame's own name is read only for its number; it is stored as `source/frame.<8 digits>.<ext>`,
   written with `O_EXCL`.
3. **How ffmpeg reads it.** `-protocol_whitelist file -format_whitelist image2 -codec_whitelist <decoder>`, then
   `-f image2 -pattern_type sequence -start_number <first> -framerate <version fps>`, the decoder forced with `-c:v`,
   and a `file:` pattern relative to the job's folder (`../source/frame.%08d.<ext>`), so nothing in `MEDIA_ROOT` can
   reach the pattern. ffmpeg stops silently at a missing frame, so the server checks the range on completion and the
   worker fails a job whose probe counts fewer frames (`unsupported_stream`).
4. **Colour.** EXR is turned from linear light to sRGB with the decoder's `apply_trc`; every other source is shown as
   stored. The probe records which (`colour`). The copy is not for colour approval.
5. **Burn-ins.** A per-project switch (`review_burn_ins`). Text from the database (project, record and version codes)
   reaches ffmpeg only through files in the job's folder, drawn with `drawtext` and `expansion=none`; the only
   expanded text is the frame counter, whose whole template the code writes. The font is copied into the job's
   folder from `REVIEW_MEDIA_BURN_IN_FONT` (the `worker` image installs `fonts-dejavu-core`), so no path enters the
   filter graph. A font that cannot be read gives a copy without burn-ins (logged), not a failed job.
6. **Frames do not stay.** A sequence's frames are deleted once its copy is ready; a failed job keeps them for a retry.

## Amendment: remaking copies (review-pipeline RP-14)

Plan and contracts: `docs/review-pipeline/PLAN.md` (RP-14), `docs/review-pipeline/CONTRACTS.md` (C-RP-37, C-RP-38).
Evidence: `docs/review-pipeline/rp-14-verification.md`.

1. **A remake is a new row.** `POST review-media/{id}/remake/` takes the version's ready movie or still and queues a new
   row whose upload is a hard link to the kept one (a copy where a link cannot be made), made in the request on the
   same media volume as an upload. The remade row stays `ready` and shown until the new one is ready, then is
   superseded and its folder deleted as before; the link keeps the upload alive. Nothing new reaches ffmpeg: the job
   is the same job, on our own file.
2. **A sequence cannot be remade.** Its frames are gone once its copy is ready (point 6 above stands).
3. **The burn-in date is fixed when a copy is first made** (`burn_in_date`, set as processing starts) and carried by
   its remakes, so remaking does not date old work today.
4. **A project's copies.** `GET projects/{id}/review-copies/` counts the ready copies whose burn-ins differ from the
   switch; `POST .../remake/` remakes the movies among them (`project.update`). Nothing is remade automatically.
5. **No slates** (Q-RP-63): a slate inside the copy would shift every frame number that comments and drawings store.

## Not decided here

- Colour management (OCIO) and per-project LUTs, audio-only files, HDR, slates. *(Sequences and burn-ins: RP-12; remaking: RP-14, above.)*
- Moving review media to object storage (it uses the media volume like attachments).
- Live review sessions (RP-8).
