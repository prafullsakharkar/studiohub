# Application: deliveries

Written against `docs/APP_ARCHITECTURE_TEMPLATE.md`. The authoritative detail is in
`docs/deliveries/` (`ANALYSIS.md`, `CONTRACTS.md`, `DECISIONS.md`, `PLAN.md`) and
`docs/delivery-pipeline/`. Status: **phase 6 done** (core model and integrity). Phases 7 (workflow,
approvals, access) and 8 (sensitive data, API, hardening) are not built.

## 2. Application information

```text
Application: deliveries  (apps/deliveries)
Domain:      Packages of published versions handed to a client
Purpose:     Build a delivery from published versions, check it, freeze what was sent, record the client's answer
Dependencies: core, identity (permissions), masterdata (clients), production (projects, versions), publishing (file registry)
Status:      In progress (feature/deliveries-improvement)
```

## 3. Domain responsibility

**Owns:** delivery packages and their codes (`DeliveryCounter`), the items (`DeliveryVersionRef`) and
the copy of each file's data taken at send (`DeliveryItemFile`), QC runs (`DeliveryQCCheck`, append-only),
destinations.

**Does not own:** versions or their publication (Production), the files and their checksums
(Publishing), the transfer itself (StudioHub sends nothing; the sender records a
`transfer_reference`, decision Q4).

## 4. What exists after Phase 6

| Piece | Where |
|---|---|
| Services | `services/package.py` (`DeliveryService`), `items.py` (snapshot), `qc.py`, `manifest.py`, `numbering.py`, `audit.py` |
| Workflow today | Draft, Validating, Prepared, Submitted (`constants/workflow.py`); approve, reject, complete, cancel, retry in `services/delivery.py` are not yet guarded (Phase 7) |
| Items | only published versions of the delivery's project that have Registered files; files copied from the registry; refreshed on `prepare` and `send`, frozen at send |
| QC | `has_items`, `same_project`, `version_published`, `files_present`, `checksum_ok`, `snapshot_current`; rows kept even when the run fails |
| Send | Prepared to Submitted once (`sent_at`); row lock on the package; second or racing call is 409 |
| Numbering | `DLV-<PROJECT>-<0001>`, per-project counter row lock |
| History protection | package, item and item-file deletes are PROTECT; frozen rows refuse update and delete |
| Provider | `providers.py` registers `deliveries.project_figures`; Production reads delivery counts, rows and the dashboard through `apps/core/providers.py` and imports nothing from this app |
| Admin | packages editable (passcode excluded); item files, QC checks and counters view-only |
| Migrations | 0004 protect history, 0005 items, snapshot and QC, 0006 package fields, 0007 unique code (stops and lists case-only duplicates) |

## 5. Rules worth knowing

* The passcode is never returned. It is still stored in plain text until Phase 7.
* A sent delivery cannot be edited, and a package row with sent data cannot be re-sent, even if its status is set back.
* Totals are derived from the items; the stored columns are no longer written.
* Legacy items without registered files cannot pass QC.

## 6. Tests

`apps/deliveries/tests/`: `services/` (add-version, QC, prepare and send, numbering and create),
`api/test_core_api.py`, `test_provider.py`, `concurrency/test_races_pg.py` (PostgreSQL),
`migrations/test_phase6_migrations.py`.
