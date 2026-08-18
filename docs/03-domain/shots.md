# Shot Domain — Definition, Identification & Frame Semantics

Generated: 2026-08-18T12:27:14+05:30

Purpose
-------
Defines the Shot domain: canonical definitions, identity, frame/time semantics, lifecycle, statuses and completion rules for StudioHub.

Shot definition
---------------
A Shot is a production work unit representing a contiguous piece of picture content (identified by a shot code). A Shot is associated with Sequence → Project → Production and may own Tasks, Versions and Shot-level metadata.

Key distinctions
----------------
- Shot UUID ≠ Shot Code. UUID is the internal stable identifier; Shot Code is the human-facing studio code (SH010_020) and follows studio naming rules.
- Shot ≠ Task and Shot ≠ Version. Shots contain Tasks; Tasks produce Versions.

Recommended attributes (non-exhaustive)
---------------------------------------
- id (UUID)
- project_id, sequence_id, production_id
- code (studio code)
- name, description
- start_frame, end_frame, handle_in, handle_out
- frame_rate (fps)
- duration_frames (derived)
- timecode_start (optional)
- status (workflow-driven)
- priority, complexity
- supervisors (list), producer_id
- metadata (json)
- created_by, created_at, updated_by, updated_at

Shot code rules and uniqueness
------------------------------
- Shot code uniqueness scope is typically project-level; document studio preference.
- Rename behavior: allow renames but maintain a history mapping old_code→new_code for external references. Provide an immutable UUID for internal referencing.
- Import: provide mapping/import adapters to convert external shot codes.

Frame and time semantics (canonical)
------------------------------------
Define a canonical frame/time reference used across docs and code:
- Frame Start (inclusive)
- Frame End (inclusive)
- Handle In (frames before start_frame available to department)
- Handle Out (frames after end_frame available)
- Cut In / Cut Out: editorial source in/out (optional)
- Duration = end_frame - start_frame + 1
- Timecode: optional metadata for aligning editorial references

All frame fields are integers and must reference the same frame-rate context; store frame_rate at shot level and normalize when comparing across differing frame rates.

Shot lifecycle and statuses
---------------------------
Statuses are workflow-defined. Example states:
- not_started, wip, internal_review, supervisor_review, client_review, approved, final, published, delivered, archived

Distinguish:
- Workflow state: the current active state of the shot workflow
- Business status: derived or aggregated accounting states (e.g., ready_for_delivery)

Shot completion rules
---------------------
A Shot is considered complete only when project-specific rules are met. Typical criteria:
- All required Tasks completed
- Required Versions approved
- Required Publishes created
- Client approval (if required)

Define completion rules per-Production using configurable policy objects.

Shot relationships
------------------
- Shot owns Tasks (one-to-many)
- Shot references Assets (ShotAssetReference)
- Shot references Versions (versions produced by shot tasks)

API and selectors
-----------------
Suggested endpoints:
- GET/POST /api/v1/shots/
- GET /api/v1/shots/{id}/tasks/
- GET /api/v1/shots/{id}/assets/

Selectors:
- ShotSelector.by_code(project_id, code)
- ShotSelector.active_for_review(project_id)
- ShotSelector.by_supervisor(user_id)

Events
------
Emit: ShotCreated, ShotUpdated, ShotStatusChanged, ShotArchived. Include frame-range summary in payload when relevant.

Testing & validation
--------------------
- Validate frame semantics (start < end, handles non-negative)
- Test import/mapping behaviors and rename history
- Test completion policy enforcement in integration tests

End of Shots document.
