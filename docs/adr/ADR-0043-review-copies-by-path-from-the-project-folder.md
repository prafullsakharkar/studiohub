# ADR-0043: Review copies of versions still in review are read by path, bounded by the project's review folder

Status: **accepted** (planned 2026-11-18 as review-pipeline RP-18; approved by the owner the same day: "Build with all A",
every recommendation of Q-RP-82 to Q-RP-86) · Amends: [ADR-0042](ADR-0042-review-media-from-studio-storage.md) (decision 1:
"never a path from a request") · Plan and contracts: `docs/review-pipeline/PLAN.md` (RP-18),
`docs/review-pipeline/CONTRACTS.md` (C-RP-47 to C-RP-49) · Evidence: `docs/review-pipeline/rp-18-verification.md`

## Context

RP-17 reads a review copy from a registered published file. Registering one needs a published version, and publishing
needs approval, so those copies arrive only after the review they are for. Before approval the renders already lie on
studio storage, under each show's render tree, and uploading them again from a workstation is what RP-17 set out to
remove.

## Decisions

1. **A path from a request, bounded by a folder the project declares.** A project names one storage root (listed in
   `PUBLISHING_STORAGE_MOUNTS`) and one relative folder on it (Q-RP-83). A request names a render relative to that
   folder; the web process joins the two, checks the result with the shared path rules and stores the root and the
   joined path on the row. It reads nothing from storage. This amends ADR-0042's first decision, which allowed only
   registered files.
2. **Only those who may change the project set or see the folder** (`project.update`, Q-RP-86). Who may make a copy
   is unchanged: the upload's rights (C-RP-26). Refusals and logs never name a directory.
3. **The worker resolves under the folder as it is when the job runs.** It checks again that the stored path is under
   the project's current folder on the same root, resolves the folder under the root and each file under the folder
   (`resolve_mount`, symbolic links included), and reads through links as in ADR-0042. A link to another show's
   render on the same root is refused. A failure is `render_unreadable`.
4. **The caller gives the frame range** (Q-RP-84). Nothing lists a directory: the server never tells a caller what is
   in the folder.
5. **A remake reads the same path again while it is still under the current folder**; changing or clearing the folder
   stops older copies being remade, but keeps them shown. Nothing is automatic (Q-RP-85): tools call the route.

## Consequences

- Anyone who may manage a version's review copy can have the worker read any movie, still or frame sequence under the
  project's folder, not only what the pipeline registered. The folder is the boundary: a studio should point it at a
  render tree, not at a show's root.
- The residual race of ADR-0042 (a file swapped for a link between check and read) stays, with the same mitigation:
  the read-only mount.
- Moving a show's renders means updating the folder; copies made before stay but cannot be remade.

## Alternatives not taken

- **Register unpublished versions' files** in publishing: changes publishing's meaning (a registered file is a
  published one) and its checks, for a copy that is for review only.
- **Any path on a listed root**: lets one show's artists read another's renders.
- **Server-side discovery of the latest render** (listing the folder): tells callers what the folder holds, and guesses
  at naming conventions studios do not share.
