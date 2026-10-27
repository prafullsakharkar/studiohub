# Application: deliveries

Written against `docs/APP_ARCHITECTURE_TEMPLATE.md`. The authoritative detail is in
`docs/deliveries/` (`ANALYSIS.md`, `CONTRACTS.md`, `DECISIONS.md`, `PLAN.md`) and
`docs/delivery-pipeline/`. Status: **phases 6 to 8 done** (core model and integrity; workflow, approvals and the encrypted
passcode; scoping, destinations, bulk cancel, roles, admin and OpenAPI). Phase 12 re-checks it with
the other two apps.

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

## 4. What exists after Phase 8

| Piece | Where |
|---|---|
| Services | `services/package.py` (`DeliveryService`), `items.py` (snapshot), `qc.py`, `manifest.py`, `numbering.py`, `audit.py` |
| Workflow | the map in `constants/workflow.py`: Draft, Validating, Prepared, Signed Off, Submitted, Approved or Rejected, Complete, Cancelled. `services/transitions.move` is the only writer of `status` and writes `DeliveryStatusChange` |
| Approvals | `sign_off` (not by whoever prepared it: `services/duties.py`; audited override `delivery.sod.override`), `reopen`, `record_client_answer`, `complete`, `cancel`, `revise`; the status override is service-only |
| Revocation | `events/` subscribes to Publishing's `PublishedFileRevoked`: unsent deliveries lose their QC run, Signed Off ones return to Prepared, sent ones are noted and show `has_revoked_content` |
| Passcode | stored as Fernet ciphertext (`passcode.py`, `DELIVERY_SECRET_KEY`); read at `GET /{id}/passcode/` with `delivery.view_secret`, audited; 503 without a key |
| Items | only published versions of the delivery's project that have Registered files; files copied from the registry; refreshed on `prepare` and `send`, frozen at send |
| QC | `has_items`, `same_project`, `version_published`, `files_present`, `checksum_ok`, `snapshot_current`; rows kept even when the run fails |
| Send | Signed Off to Submitted once (`sent_at`); QC again, no refresh; row lock on the package; second or racing call is 409 |
| Numbering | `DLV-<PROJECT>-<0001>`, per-project counter row lock |
| History protection | package, item and item-file deletes are PROTECT; frozen rows refuse update and delete |
| Provider | `providers.py` registers `deliveries.project_figures`; Production reads delivery counts, rows and the dashboard through `apps/core/providers.py` and imports nothing from this app |
| Scoping | deliveries are narrowed to the caller's projects (`DeliverySelector`); other ids are 404; platform admins see all, including old deliveries without a project |
| Destinations | name unique in any case among live destinations, one live default (`services/destination.py`, plus DB constraints); a delivery chooses one by `destination_id`, the old free text works while none is chosen |
| Bodies | `reason` / `notes` accepted beside `rejection_reason` / `cancellation_reason` / `client_notes`; both at once must agree |
| Bulk | `POST bulk-cancel/` (1 to 100 ids, 200 or 207, identical `not_found`, no override); no bulk sign-off or send |
| Admin | packages, items, item files, QC checks, history and counters are view-only; destinations editable with the name rule |
| Migrations | 0004 protect history, 0005 items, snapshot and QC, 0006 package fields, 0007 unique code (stops and lists case-only duplicates), 0008 workflow and history, 0009 encrypts passcodes (refuses without a key) |

## 5. Rules worth knowing

* The passcode is never in a list or detail; only the audited endpoint returns it.
* A sent delivery cannot be edited, and a package row with sent data cannot be re-sent, even if its status is set back.
* Roles: platform-admin, org-admin and production-admin hold every delivery code; vfx-supervisor view, create, update and approve; lead-artist and artist view. The two override codes are held by no role. `init_platform` adds grants but does not remove them (Q40).
* Totals are derived from the items; the stored columns are no longer written.
* Legacy items without registered files cannot pass QC.

## 6. Tests

`apps/deliveries/tests/`: `services/` (add-version, QC, prepare and send, numbering and create),
`api/test_core_api.py`, `test_provider.py`, `concurrency/test_races_pg.py` (PostgreSQL),
`migrations/` (phases 6 and 7), `security/` (passcode, logs), and in `services/` the transition map,
separation of duties, workflow actions and revocation.
