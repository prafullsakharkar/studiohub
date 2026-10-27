# Publishing decisions

Cross-app decisions (Q1-Q4, Q6-Q12) are in `docs/delivery-pipeline/DECISIONS.md`. Status: **ANSWERED**, **ASSUMED** ("your call"), **OPEN**, **DEFERRED**.

| Q | Question | Answer | Date | Status | Affects |
|---|---|---|---|---|---|
| Q1 | What is "a publish"? | `production.Version` is the published record; Publishing owns the files of a published version and the DCC export jobs (see delivery-pipeline). | 2026-10-27 | ASSUMED | Phases 3-5 |
| Q3 | Storage | Register-only paths under named storage roots, SHA-256 and size stored; no bytes. | 2026-10-27 | ASSUMED | Phase 3 |
| Q5 | Scope | **Now:** file registry with checksum; deprecate / revoke / restore; immutability of registered files; hardened DCC export jobs. **Later:** publish dependencies (upstream/downstream), thumbnails. **Not:** own version numbering. | 2026-10-27 | ASSUMED | Phases 3-5 |
| Q13 | Fate of `PublishItem` | **A.** Kept as the export-job record, linked to the version it produced. | 2026-10-27 | ASSUMED | DOM-PUB-05; Phase 3 |
| Q14 | Simulated validation | **A.** Honest checks; `not_checked` instead of passed. | 2026-10-27 | ASSUMED | DOM-PUB-05; Phase 4 |
| Q15 | `Validated` reads "Published" | **A.** Words kept; `job_status` added in Phase 5; label change with a frontend release. | 2026-10-27 | ASSUMED | API-PUB-08 |
| Q23 | Audit target types | **A.** `publishing` target added in `apps/audit` (choices only). | 2026-10-27 | ASSUMED | Phase 3 |
| Q24 | On-delete rules | **A.** `PublishItem.project` becomes `PROTECT`; new FKs `PROTECT`. | 2026-10-27 | ASSUMED | Phase 3 |
| Q25 | Storage model, checksum source of truth | **A**, as recommended (`delivery-pipeline/DECISIONS.md`) | 2026-10-27 | ASSUMED | DOM-PUB-01, 04 |
| Q26 | Immutability and corrections | **A**, as recommended (`delivery-pipeline/DECISIONS.md`) | 2026-10-27 | ASSUMED | DOM-PUB-02 |
| Q27 | Transition maps, refused-move status | **A**, as recommended (`delivery-pipeline/DECISIONS.md`) | 2026-10-27 | ASSUMED | DOM-PUB-02, 05 |
| Q33 | Stored vs derived (`is_archived`) | **A**, as recommended (`delivery-pipeline/DECISIONS.md`) | 2026-10-27 | ASSUMED | DOM-PUB-05 |
| Q34 | Codes and role matrix | **A**, as recommended (`delivery-pipeline/DECISIONS.md`) | 2026-10-27 | ASSUMED | `PLAN.md` §6 |
| Q36 | Bulk contract (`bulk-register`) | **A**, as recommended (`delivery-pipeline/DECISIONS.md`) | 2026-10-27 | ASSUMED | API-PUB-10 |
| Q38 | Compatibility | **A**, as recommended (`delivery-pipeline/DECISIONS.md`) | 2026-10-27 | ASSUMED | |

Implementation assumptions A-1 to A-6 (no Celery app, job membership in Phase 5, seeding, audit targets, 409 existence, `is_archived`): `docs/delivery-pipeline/DECISIONS.md`.

Full text of Q25-Q38: `docs/delivery-pipeline/DECISIONS.md`. Phase 1 analysis: `ANALYSIS.md`. Design: `CONTRACTS.md`, `PLAN.md`.
