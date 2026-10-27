# Deliveries contracts

Phase 2 target design, 2026-10-27. Status: **PROPOSED**; items marked *(Qnn)* follow the recommended answer of an open Phase 2 question. Cross-app rules: `docs/delivery-pipeline/CONTRACTS.md`. Audit: `ANALYSIS.md`. Order of work: `PLAN.md`.

**What the app is after this work** (Q4, Q16, Q17): a record of what was sent to a client, when, by whom, after whose internal sign-off, and what the client answered. Items are **published** versions of the delivery's project with their **registered files** (Publishing), frozen at send time. The transfer itself happens outside StudioHub (Aspera, SFTP, ...); there are no public download links.

## 1. Domain contracts

### DOM-DLV-01 `DeliveryPackage` (existing, table `deliveries_package`)

| Field | Today | Target |
|---|---|---|
| `code` | unique case-sensitive, client-generated | unique `upper(code)` over all rows (stop-and-list migration, staging D2); blank → `DLV-<project code>-<0001>` from a per-project `DeliveryCounter` locked during allocation; a sent code is kept and checked any case |
| `project` | `SET_NULL`, nullable, any id | `PROTECT` (Q24); **required on create**, visible to the caller (X-03); nullable column kept for old rows |
| `client` | `SET_NULL`, any id | `PROTECT`; resolved through Masterdata selectors (X-06) |
| `status` | 8 values, written from any state, admin too | the map in DOM-DLV-02; admin read-only |
| `client_status` | overwritten by approve/reject | the client's answer only: Pending, In Review, Approved, Rejected; set with the client-answer actions |
| `destination` | none (free text `delivery_destination`) | FK `DeliveryDestination`, `PROTECT`, nullable; `delivery_destination` text kept read-only and deprecated (*Q33*) |
| `passcode` | plain text, returned to all, admin-searchable | *Q17 = A*: encrypted at rest (DOM-DLV-09), write-only, returned only with `delivery.view_secret`; everyone sees `has_passcode` |
| `notes` | internal + reasons mixed | internal notes only |
| `client_notes` | overwritten by every action | the client's feedback only |
| `cancellation_reason`, `rejection_reason` | written into `client_notes` | own columns (new) |
| `signed_off_by`, `signed_off_at` | none | new (internal approval, DOM-DLV-02) |
| `sent_by`, `sent_at`, `transfer_reference` | `submitted_at` = last edit time | new; `sent_at` is the real time of the send; `transfer_reference` is the external job id typed by the sender (Aspera job, ticket), optional |
| `client_answered_by`, `client_answered_at` | none | new (who recorded the client's answer) |
| `revision_of` | none | FK self, `PROTECT`, nullable: a re-delivery after a rejection |
| `total_size_bytes`, `total_frames` | stored counters from typed values | **derived** from item snapshots in selectors; stored columns read-only and deprecated (*Q33*) |
| `manifest_data`, `checksums` | regenerated any time; placeholder checksum | built at prepare from file snapshots, real SHA-256 of the canonical manifest JSON; frozen at send |
| `expires_at` | the UI's due date, enforced nowhere | unchanged meaning for the frontend; documented as "due date"; nothing expires (no links, Q4) |
| `is_archived` | never written | derived from the soft delete (production D-25), read-only |

Constraints: `upper(code)` unique; index `(project, status)`, `(client, status)`. (No check tying `sent_at` to status: an audited override may move a sent delivery back, and `sent_at` must stay as history.)

### DOM-DLV-02 Transition map *(Q16 = A, Q27)*

One map in `apps/deliveries/constants/workflow.py`. Backend status values (read-shape label in brackets):

```
Draft ─┬─> Validating ──> Prepared [Ready] ──sign-off──> Signed Off ──send──> Submitted ──client approves──> Approved ──> Complete [Completed]
       │        ▲  │            │                            │                     └──client rejects──> Rejected
       └────────┴──┴────────────┘ (working states move freely)                     
Draft, Validating, Prepared, Signed Off ──cancel──> Cancelled
```

| From | To | Code | Guard |
|---|---|---|---|
| Draft, Validating, Prepared | each other | `delivery.update` | working states; `prepare` runs QC and refuses if any check fails |
| Prepared | **Signed Off** (new state) | `delivery.approve` (new) | QC passed and current; separation of duties (DOM-DLV-07) |
| Signed Off | Prepared (reopen) | `delivery.approve` | clears sign-off |
| Signed Off | Submitted (send) | `delivery.send` (new) | re-runs QC; freezes snapshots (DOM-DLV-05); row lock; repeat → *Q27* conflict |
| Submitted | Approved (client accepted) | `delivery.send` | records `client_status=Approved`, who and when, optional `client_notes` |
| Submitted | Rejected (client rejected) | `delivery.send` | reason required → `rejection_reason`, `client_status=Rejected` |
| Approved | Complete | `delivery.update` | |
| Draft, Validating, Prepared | Cancelled | `delivery.update` | reason optional → `cancellation_reason` |
| Signed Off | Cancelled | `delivery.approve` | |
| Submitted, Approved, Rejected, Complete, Cancelled | anything else | `delivery.status.override` (new, seeded to no role) + `override_reason` | history row with `override_kind="status"` |

`retry` keeps its URL: from Validating it re-runs QC (stays a working-state move); from any other state it is refused. A rejected delivery is followed up with `POST /deliveries/{id}/revise/`, which creates a new Draft with `revision_of` set and the same items (refreshed to their current snapshots).

**Meaning change to note:** `approve` keeps its frontend meaning (the *client's* approval, from Submitted). The internal approval is the new `sign-off` action and state. The UI's "Submit" button on a Ready delivery will get 409 until someone signs it off; this is the frontend flow that assumed free movement (*Q27*, `PLAN.md` §5).

### DOM-DLV-03 Items: `DeliveryVersionRef` (existing, table `deliveries_version_ref`)

| Field | Today | Target |
|---|---|---|
| pk | BigAutoField | kept (changing it is destructive); new `uid` UUID unique, used by the API; the integer stays accepted in `remove-version` for one release (*Q38*) |
| `delivery` | `CASCADE` | `PROTECT` (Q24): a package with items cannot be hard-deleted |
| `version` | `CASCADE`, any version | `PROTECT`; must be a **published, live version of the delivery's project** (X-03) |
| snapshot fields (`version_number`, `entity_*`, `file_path`, sizes, checksums) | typed by the client | **filled by the server** from the version and its deliverable files; values in the body are accepted and ignored (old clients send them, production D-29 precedent); refreshed on each `prepare`, frozen at send |
| `added_by`, `added_at` | `created_at` only | new |
| `is_validated`, `validation_notes` | set to True by "auto-validate" | replaced by QC rows (DOM-DLV-06); kept read-only, derived from the latest QC run |

Rules:
* unique `(delivery, version)` (exists);
* items can be added or removed only in Draft, Validating, Prepared; never after sign-off;
* a version qualifies when it is published and live, of the same project, and has **at least one Registered file whose `checksum_state` is not `mismatch` or `missing`** (*Q29*).

### DOM-DLV-04 `DeliveryItemFile` (new, table `deliveries_item_file`)

One row per file of an item, copied from `FileSnapshot` (X-04): `item` (FK, `PROTECT`), `published_file_id` (UUID, **no FK**, so Deliveries keeps no hard link into Publishing's tables), `storage_root_code`, `relative_path`, `role`, `file_type_code`, `size_bytes`, `sha256`, `frame_start`, `frame_end`, `frozen_at` (null until send). Unique `(item, published_file_id)`.

### DOM-DLV-05 Snapshot rules *(Q29)*

* Before sign-off the snapshot is a **preview**: `add-version` and `prepare` refill it from the current deliverable files.
* `send` refreshes it one last time inside the send transaction, sets `frozen_at`, and from then on item and file rows are immutable (service guard, model guard, admin read-only).
* The manifest (`manifest_data`) is built from the frozen rows; `checksums.manifest_sha256` is the SHA-256 of the canonical JSON of the manifest (sorted keys, no whitespace).
* Later changes to the version (unpublish) or to its files (deprecate, revoke) never change a sent delivery.

### DOM-DLV-06 QC: `DeliveryQCCheck` (new, append-only, table `deliveries_qc_check`)

`delivery`, `item` (nullable for package checks), `run_id` (UUID per run), `check_name` (`version_published`, `same_project`, `files_present`, `checksum_ok`, `not_revoked`, plus spec checks when specs exist, LATER per Q5), `outcome` (`pass`, `fail`, `not_checked`), `detail`, `checked_by`, `checked_at`. A run is **current** when no item, file or version changed since it ran (compared by `run_id` stored on the package). Sign-off and send require a current run with no `fail`. No update or delete (append-only queryset, as production `StatusHistory`).

### DOM-DLV-07 Separation of duties *(Q28)*

* **Who prepared a delivery:** its creator, everyone who added an item, and everyone who moved it into Prepared, read from `DeliveryStatusChange` rows and item `added_by` (facts that later edits cannot rewrite, as production D-04 does with the change log).
* **Signing off** is refused with 403 `separation_of_duties` for any of them, on every path: the action, bulk sign-off (none planned; a test pins that no bulk endpoint reaches it), API keys and tokens (they act as their owner), and after reassigning the creator (history rows, not current fields).
* **Override:** `delivery.sod.override` + `override_reason`, seeded to no role, recorded as `override_kind="self_approval"`.
* Sending and recording the client's answer have no separation rule (*Q28*: say if the sender must differ from the signer).

### DOM-DLV-08 Revocation of a file (event from Publishing, X-04)

Handler `on_published_file_revoked` (after commit, idempotent):
* deliveries in Draft, Validating, Prepared holding the version: their current QC run is invalidated (next sign-off needs a new run);
* deliveries in **Signed Off**: moved back to **Prepared** with a history row (`actor=None`, `reason="content revoked"`, `override_kind="system"`) so they cannot be sent with revoked content;
* sent deliveries (Submitted, Approved, Rejected, Complete): unchanged; their read shape shows `has_revoked_content: true` (derived from the files' current state through X-04), and an `AuditLog` entry records which delivery held the revoked file.

### DOM-DLV-09 Passcode *(Q17 = A, Q35)*

* Stored encrypted with a Fernet key `DELIVERY_SECRET_KEY` (new, `config/env.py`), using the same MultiFernet helper the MFA secrets use, moved to `apps/core/security/fernet.py` with the key name as a parameter (identity keeps a thin wrapper, no behaviour change). *(Q35 offers reusing the MFA key instead.)*
* Fails closed: without the key a write that sets a passcode is a 503 `secret_storage_unavailable` and reads return `has_passcode` only.
* Never in list responses, search, ordering, filters, the admin list or the admin search; detail returns it only to holders of `delivery.view_secret` (new) who are members of the project; every read of it writes an `AuditLog` entry (`delivery`, "passcode viewed", no value).
* A data migration encrypts existing values in place (reverse decrypts); staging query D1 counts them first.

### DOM-DLV-10 `DeliveryDestination`

Unique `upper(name)` among live rows; at most one live default; studio-wide. `credentials_configured` stays a flag; credentials are never stored (good today, DLV-20).

### DOM-DLV-11 History: `DeliveryStatusChange` (new, append-only)

`delivery`, `from_status`, `to_status`, `actor` (nullable for system moves), `reason`, `override_kind`, `at`. One row per transition, written in the same transaction.

## 2. Services (signatures)

```python
# apps/deliveries/services/package.py
class DeliveryService:
    create(*, actor, request, data) -> DeliveryPackage
    update(*, actor, package, data) -> DeliveryPackage           # working states only; status read-only
    add_version(*, actor, package, version_id) -> DeliveryVersionRef
    remove_version(*, actor, package, item_id) -> None
    run_qc(*, actor, package) -> QCRun                           # `validate` and `retry`
    prepare(*, actor, package) -> DeliveryPackage                # runs QC, builds manifest
    sign_off(*, actor, package, notes="", override_reason=None) -> DeliveryPackage
    reopen(*, actor, package) -> DeliveryPackage
    send(*, actor, package, transfer_reference="") -> DeliveryPackage
    record_client_answer(*, actor, package, accepted: bool, reason="", notes="") -> DeliveryPackage
    complete(*, actor, package) -> DeliveryPackage
    cancel(*, actor, package, reason="") -> DeliveryPackage
    revise(*, actor, package) -> DeliveryPackage
    set_passcode(*, actor, package, value: str | None) -> None
    read_passcode(*, actor, package) -> str                      # audited

# apps/deliveries/services/transitions.py
def move(package, to_status, *, actor, reason="", override_reason=None) -> None   # the only writer of `status`
```

Each public method is one `transaction.atomic()`, locks the package row (`select_for_update`), re-reads the status inside the lock, checks the map and codes, writes `DeliveryStatusChange`, publishes events after commit.

## 3. API contracts

All under `/api/v1/deliveries/`.

| ID | Endpoint | Before | After | Client impact |
|---|---|---|---|---|
| API-DLV-01 | `GET /deliveries/`, `GET /{id}/` | every project; passcode returned | caller's projects only (404 otherwise); `passcode` only with `delivery.view_secret`; new read fields `has_passcode`, `signed_off_*`, `sent_*`, `has_revoked_content`, `revision_of_id` | lists shrink; `passcode` disappears for most users (the UI never shows it) |
| API-DLV-02 | `POST /deliveries/` | any ids; unknown → 500; client code | project required and visible, client must exist and be active, else 400 "Unknown ..."; blank code → server code | none for valid input |
| API-DLV-03 | `PATCH/PUT /{id}/` | 500 | 200, detail shape; editable in working states: `name`, `notes`, `client_notes`, `expires_at`, `destination_id`, `delivery_method`, `passcode` (write-only); `status`, totals, manifest read-only (400 unless echoed) | new ability |
| API-DLV-04 | `POST /{id}/add-version/` | any version, typed snapshot; unknown → 500 | `version_id` must be a qualifying version (DOM-DLV-03), else 400 "Unknown or undeliverable version." with the reason code (`not_published`, `no_registered_files`, `checksum_problem`); snapshot keys in the body ignored | the UI's extra keys stay harmless |
| API-DLV-05 | `POST /{id}/remove-version/` | integer `version_ref_id` | `item_id` (UUID) or the old integer (*Q38*); working states only | |
| API-DLV-06 | `POST /{id}/validate/`, `/retry/` | auto-pass | QC run; response lists checks; retry only from Validating | |
| API-DLV-07 | `POST /{id}/prepare/` | any state, placeholder checksum | working states; runs QC; 409 with the failed checks when QC fails | |
| API-DLV-08 | `POST /{id}/sign-off/` | — | new; `delivery.approve`; body `notes`, `override_reason` | **frontend must add a button** (Ready → Signed Off) |
| API-DLV-09 | `POST /{id}/reopen/` | — | new; Signed Off → Prepared | |
| API-DLV-10 | `POST /{id}/submit/` | any state, simulated | send from Signed Off only; body `transfer_reference`; second call 409 | the UI's Submit at Ready → 409 until signed off |
| API-DLV-11 | `POST /{id}/approve/` | from any state; "client approval" by staff | from Submitted only; `delivery.send`; body `client_notes` **or `notes`** (*Q18 = A*) | |
| API-DLV-12 | `POST /{id}/reject/` | requires `rejection_reason` (UI sends `reason` → 400) | from Submitted only; accepts `rejection_reason` **or `reason`** (*Q18*) | the UI's reject starts working |
| API-DLV-13 | `POST /{id}/cancel/` | reason ignored, any state | `cancellation_reason` or `reason`; per map | |
| API-DLV-14 | `POST /{id}/complete/` | any state | from Approved | |
| API-DLV-15 | `POST /{id}/revise/` | — | new; from Rejected; 201 with the new Draft | |
| API-DLV-16 | `GET /{id}/history/`, `GET /{id}/qc/` | — | new, read-only | |
| API-DLV-17 | `POST /deliveries/bulk-cancel/` | — | new, Q36 contract; the only bulk action (sign-off and send stay single, DOM-DLV-07) | |
| API-DLV-18 | `/deliveries/destinations/` | case-sensitive names, many defaults | any-case unique among live rows, one default | |
| API-DLV-19 | read shape `status` | Prepared → "Ready", Complete → "Completed" | same; `Signed Off` reads "Signed Off" (new value the frontend does not know yet; its union accepts any string) | UI badge colour falls back to default |

## 4. Authorization

| Action | Code | Extra |
|---|---|---|
| read | `delivery.view` | project membership |
| create | `delivery.create` | member of the project |
| edit, add/remove items, QC, prepare, complete, cancel (working states) | `delivery.update` | member |
| sign off, reopen, cancel a signed-off delivery | **`delivery.approve`** | member; separation of duties |
| send, record the client's answer, revise | **`delivery.send`** | member |
| read the passcode | **`delivery.view_secret`** | member; audited |
| delete (soft, Draft or Cancelled only) | `delivery.delete` | member |
| cross a final state | **`delivery.status.override`** (no role) | reason |
| self sign-off | **`delivery.sod.override`** (no role) | reason |

Role matrix proposal: `PLAN.md` §6.

## 5. Security contracts

| ID | Contract |
|---|---|
| SEC-DLV-01 | Every read and write is narrowed to the caller's projects; others' ids answer 404 like unknown ids. |
| SEC-DLV-02 | The passcode is encrypted at rest, never logged, never in lists, search, filters, ordering or the admin list; reads need `delivery.view_secret` and are audited. |
| SEC-DLV-03 | Nobody signs off a delivery they prepared (DOM-DLV-07), on any path, without the override. |
| SEC-DLV-04 | Sent deliveries, their items and files are immutable; the manifest checksum is real. |
| SEC-DLV-05 | Internal reasons never land in `client_notes`; `notes` is internal. (No client-facing view exists today; the split keeps one possible.) |
| SEC-DLV-06 | No public download link exists (Q4). If one is ever added, it needs its own ADR: unguessable token stored hashed and shown once, expiry, revocation, per-token rate limit, download audit trail (*Q30*). |
| SEC-DLV-07 | Logs carry ids, codes and statuses only (log-capture test). |

## 6. Audit events

`DeliveryStatusChange` per transition; `AuditLog` target `delivery` (Q23) for create, sign-off, send, client answer, passcode set and passcode viewed, revocation impact; change log keeps tracking `DeliveryPackage` (`apps/audit/signals/change_tracking.py:231`) with `passcode` masked. QC rows are their own trail.

## 7. Failure behaviour

| Case | Answer |
|---|---|
| Unknown, foreign or invisible project / client / version in a body | 400 "Unknown ..." |
| Version not deliverable | 400 with a reason code |
| Transition not allowed, repeat send, lost race | *Q27*: 409 `invalid_transition` |
| QC fails on prepare / sign-off / send | 409 `qc_failed` with the failing checks |
| Self sign-off | 403 `separation_of_duties` |
| Passcode key missing | 503 `secret_storage_unavailable` on write; reads omit the value |

## 8. Phase 6 as built (differences from the target above)

Sections 1 to 7 are the target for Phases 6 to 8. What Phase 6 built, where it differs:

| Target | Built in Phase 6 |
|---|---|
| `create(actor, request, data)` | `create(actor, data)`; project and client are checked for existence only (Phase 8 adds scoping). Code is server-made `DLV-<PROJECT>-<0001>` when blank (`services/numbering.py`, `DeliveryCounter`) |
| `run_qc` | `DeliveryService.validate` (Draft to Validating; runs QC) and `services/qc.run` |
| `prepare`: working states, QC, manifest | the same, from any editable state; a failed QC is a 409 `qc_failed` listing the checks, and the run's rows are kept |
| `send` from Signed Off | from **Prepared** only, while `sent_at` is empty; second call 409 `invalid_transition`; response is the detail shape |
| `sign_off`, `reopen`, `revise`, `cancel`, `set_passcode`, `read_passcode`, `DeliveryStatusChange`, `transitions.move` | Phase 7 |
| API-DLV-01 (`passcode` with `delivery.view_secret`) | the passcode is never returned; `has_passcode` is (Phase 7 adds the secret read) |
| API-DLV-03 | built. Not editable: `status`, `code`, `client_status`, `is_archived`, totals, `manifest_data`, `checksums` (400 `Cannot be set directly.` unless echoed unchanged). `destination_id` is Phase 8 |
| API-DLV-04 | `version_id` only; a version must be published, of the delivery's project, with at least one Registered file and no checksum mismatch or missing; else 400 with `reason` (`unknown_version`, `not_published`, `no_registered_files`, `checksum_problem`). Typed snapshot keys are ignored |
| API-DLV-05 | `item_id` (item `uid`) or the old integer `version_ref_id` |
| API-DLV-06 | `validate` runs QC and returns the run; `retry` is unchanged (Phase 7) |
| API-DLV-07 | `prepare` as in the row above |
| API-DLV-10 | `submit` takes `transfer_reference`; it runs through `BackgroundJobService` as before |
| `DeliveryQCCheck.check` | the field is `check_name` (`check` collides with `Model.check()`) |

Item response shape: `id` (integer), `uid` (UUID), `version_id`, snapshot fields, `is_validated`, `validation_notes`, and `files` (`storage_root_code`, `relative_path`, `role`, `file_type_code`, `size_bytes`, `sha256`, `frame_start`, `frame_end`, `frozen_at`). Detail also has `sent_at`, `transfer_reference`, `has_passcode`.

**Frontend impact of Phase 6**

* Submit on a delivery that was never prepared, and Prepare on a delivery whose versions have no registered files, are now 409 / 400 (they used to "succeed" with placeholders).
* `add-version` needs a published version with registered files; the typed snapshot values are ignored.
* The passcode is not in any response; read `has_passcode`.
* `total_size_bytes` and `total_frames` are derived from the items.
* `PATCH`/`PUT` now answer 200 instead of 500.

