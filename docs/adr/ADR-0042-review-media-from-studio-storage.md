# ADR-0042: The media worker reads review copies from studio storage, read-only, only at registered paths

Status: **accepted** (planned 2026-11-18 as review-pipeline RP-17; approved by the owner the same day: "Build with all A",
every recommendation of Q-RP-77 to Q-RP-81) · Amends: [ADR-0040](ADR-0040-review-media-processing.md) (where a copy's
source comes from) · Plan and contracts: `docs/review-pipeline/PLAN.md` (RP-17), `docs/review-pipeline/CONTRACTS.md`
(C-RP-44 to C-RP-46) · Evidence: `docs/review-pipeline/rp-17-verification.md`

## Context

Until RP-16 every review copy was made from an upload: the browser sent a movie, a still or a sequence of frames, and
the media worker read them from `MEDIA_ROOT`. Comp and lighting already publish their renders to studio storage and
register them (`publishing.PublishedFile`: a storage root, a relative path or frame pattern, a checksum). Uploading the
same frames again from a workstation costs minutes and disk, and the copy can show other frames than the ones published.

Publishing already maps storage roots to directories for its checksum verification (`PUBLISHING_STORAGE_MOUNTS`, with
`resolve_mount`, which refuses a path that leaves the root, symbolic links included). Until now only the general worker
read through it, and only to hash files.

## Decisions

1. **Only registered files, only listed roots.** A copy is made from a `PublishedFile` id, never a path from a request.
   The file must be `main` or `proxy`, not Revoked, not `mismatch` or `missing`, and its root must be in
   `PUBLISHING_STORAGE_MOUNTS` (Q-RP-77, Q-RP-78). The web process checks this and stores the root's code and the
   registered path on the row; it reads nothing from storage.
2. **The media worker mounts the roots read-only.** `celery-media` gets each listed root's directory as a read-only
   volume, at the same path the general worker uses. The web container needs no mount. Nothing in the job opens a file
   under a root for writing.
3. **Each job resolves the path again and reads through links.** At run time the worker resolves each file (each frame
   for a sequence) with `resolve_mount`, requires a regular file whose first bytes are the expected format, and makes a
   symbolic link in the row's own folder under `MEDIA_ROOT`. ffmpeg gets only those links, with the same arguments as an
   upload. The links are removed when the job ends. Removing never follows a link (`_unlink_storage` unlinks only links;
   `_delete_folder` refuses anything outside `REVIEW_MEDIA_DIR`).
4. **No hashing at copy time** (Q-RP-79). A `declared` checksum is accepted; the review copy shows what is on disk when
   the job runs. Verification stays publishing's job and flags a file that changed later.
5. **Revoking forgets the source** (Q-RP-81). Revoking a file clears the root and path on every copy read from it, in
   the same transaction. Those copies stay, but cannot be remade, and a job still to run fails with `storage_unreadable`.
6. **Logs and responses carry no path.** A refused read logs the row, a fixed reason and the frame number. The row's
   shape carries the file's id, not its path; the file's page shows the path to whoever reads published files.

## Consequences

- An editor of a version can have the worker read any file registered to that version on a listed root. Registering a
  file needs `publishing.create`, so the set of readable files is what the pipeline published.
- **Residual race.** Between the worker's check and ffmpeg's read, someone with write access to the root could swap a
  frame for a link elsewhere. Exploiting it needs write access to studio storage, which already allows far more. The
  read-only mount limits what such a swap can reach to what the container can see.
- A root's directory must be the same in every container that lists it; a mismatch fails jobs with `storage_unreadable`
  rather than reading the wrong place.
- Copies from storage no longer depend on the media volume's size for their source; their output still lives there.

## Alternatives not taken

- **Copy the frames into `MEDIA_ROOT` first**: doubles the disk and the time, which is what the feature removes.
- **Let ffmpeg open the storage paths directly**: puts real paths in ffmpeg's arguments and its error output, and skips
  the per-file check of the format.
- **Hash every file before reading**: minutes on a long EXR sequence, for a copy that is for review only.
