# Review pipeline: decisions

The owner answered the questions of [ANALYSIS.md §9](ANALYSIS.md#9-decisions-for-the-owner) on 2026-11-12: "go with suggestion, Q-RP-8 no".

| ID | Answer | What it means |
|---|---|---|
| Q-RP-1 | **A**, keep the split | `Version` is what is reviewed; `PublishedFile` (publishing app) is what is published and loaded. Neither is merged into the other. |
| Q-RP-2 | **A**, reverse delivery-pipeline Q5/Q6 | For this programme, the items of [ANALYSIS.md §8](ANALYSIS.md#8-draft-phases-to-be-fixed-after-9-is-answered) are in scope: notes with replies and links, approval roll-up, publish dependencies, the loader, path templates, the media pipeline and notifications. This replaces the earlier "LATER" answer for these items only. |
| Q-RP-3 | **A**, the order of §8 | RP-1 (data cleanup) comes first. |
| Q-RP-4 | **B**, keep both | Review comments stay their own records. RP-2 adds replies and links to several records to project notes. They can be merged later if wanted. |
| Q-RP-5 | **A**, a fixed rule, switched on per project | When a version is approved, its task is approved, if the project's rule says so. No `AutomationRule` engine for now. |
| Q-RP-6 | **A**, ffmpeg in the worker image | Results are written to a storage root. Object storage (S3-compatible) can come later, if the deployment has it. |
| Q-RP-7 | **A**, in-app only | No e-mail, so no new outward channel. |
| Q-RP-8 | **B**, no account-free share links | Clients review with their own accounts, as they already can. The trust model does not change, and no ADR is needed. **RP-7 is dropped.** `Playlist.share_settings` stays a stored marker: the frontend already labels it "Marked shared", and no route serves it. Delivery-pipeline Q30 (share links: LATER) stays as it is. |
| Q-RP-9 | **B**, live review later | RP-8 is not planned now. It would need a Redis channel layer and an ASGI server in production. |
| Q-RP-10 | **B**, a separate repository | DCC and desktop tools (RP-9) are a different runtime with a different release cycle. They are built outside this repository, against the API. |

## RP-2 answers

The owner took every recommendation of [PLAN.md, RP-2 questions](PLAN.md#questions-before-rp-2-starts) on 2026-11-12 ("next").

| ID | Answer | What it means |
|---|---|---|
| Q-RP-11 | **A** | The author edits their own note. The author, the assignee of the note's task, or a holder of `note.update` changes its status. `note.update` is granted to platform-admin, org-admin, production-admin, vfx-supervisor and lead; editing another person's note needs it. |
| Q-RP-12 | **A** | Soft delete, by the author while no one else has replied, or by a holder of `note.delete` (platform-admin, org-admin, production-admin, vfx-supervisor). A thread's replies go with it. |
| Q-RP-13 | **A** | A narrowed member still sees only the threads they wrote, now with every reply on them. The trust model does not change; no ADR. |
| Q-RP-14 | **A** | Links to Sequence, Shot, Asset, Version, Playlist, Review, and Episode on episodic projects. The task is its own field, not a link. |

## Phases after the answers

| Phase | Status |
|---|---|
| RP-1 Data model cleanup | built and merged into `develop` ([rp-1-verification.md](rp-1-verification.md)) |
| RP-2 Notes (replies, links) | planned in [PLAN.md](PLAN.md#rp-2-notes-replies-links-a-task); answered (Q-RP-11 to Q-RP-14 = A), being built on `feature/rp-2-notes` |
| RP-3 Approval roll-up (fixed rule) | after RP-1 |
| RP-4 Publishing depth | independent |
| RP-5 Media pipeline (ffmpeg worker) | independent |
| RP-6 Notifications (in-app) | after RP-2 |
| RP-7 Share links | **dropped** (Q-RP-8 = B) |
| RP-8 Live review | not planned (Q-RP-9 = B) |
| RP-9 DCC integrations | separate repository (Q-RP-10 = B) |

Phase numbers are not reused, so RP-7 stays empty.
