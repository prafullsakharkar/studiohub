# Production Domain — Entities (Canonical)

Generated: 2026-08-18T12:22:35+05:30

Purpose
-------
This document lists canonical domain entities for the Production context, their intended responsibilities, recommended attributes, invariants, and implementation notes. It is intended as a reference for architects, backend engineers, TDs, and producers.

Guiding rules
-------------
- Entities represent state and identity. They are not containers for orchestration or heavy I/O.
- Keep entities small and focused; complex orchestration belongs in Application Services.
- Persist canonical attributes in the Production bounded context's tables. Other modules must use public interfaces.
- Use UUID primary keys for cross-system identity by default.

Common audit fields
-------------------
All domain entities SHOULD include these fields (unless justified):
- id (UUID, PK)
- organization_id (UUID)
- created_by (user id)
- created_at (UTC timestamp)
- updated_by (user id)
- updated_at (UTC timestamp)
- archived_at (nullable timestamp)
- deleted_at (nullable timestamp — if soft-delete)

Primary entities
----------------
Each entity below includes: purpose, recommended attributes (non-exhaustive), invariants, and implementation notes.

Production (aggregate root)
- Purpose: The production is the top-level container for projects, cross-project assets, workflows, permissions and policies.
- Attributes: id, organization_id, code, name, client, status (draft|active|paused|completed|archived), timezone, default_workflow_id, default_review_template_id, metadata(json)
- Invariants: code unique within organization; status transitions follow approved paths (Draft → Active → ...).
- Notes: Stores production-level configuration; avoid embedding project lists in a single JSON blob.

Project
- Purpose: Logical subdivision within a Production (episode, unit, delivery).
- Attributes: id, production_id, code, name, type (feature|episode|delivery|misc), status, planned_start, planned_end, metadata
- Invariants: Must reference a valid production_id; project dates normally within production planned dates (configurable exception).
- Notes: Episodes may be modelled as Projects with type=episode or as a first-class Episode entity (project choice documented in ADR).

Episode (optional)
- Purpose: Optional subdivision for episodic work (season → episode).
- Attributes: id, project_id, episode_number, code, name, status
- Notes: Use only if needed; keep simple.

Sequence
- Purpose: Group shots (e.g., SEQ001)
- Attributes: id, project_id, code, name, description, order_index
- Invariants: sequence.code unique within project

Shot (aggregate root candidate)
- Purpose: The primary unit of work representing a single in-screen shot.
- Attributes: id, sequence_id, project_id, code (e.g., SH010_020), name, description, start_frame, end_frame, fps, duration_frames, status (todo|assigned|in_progress|review|approved|published|archived|blocked), complexity, priority, metadata
- Invariants: start_frame < end_frame, frame range consistent with sequence/project settings
- Notes: Shot owns tasks and references to versions; shot-level business rules (e.g., freeze approval) should be applied here.

Asset
- Purpose: Reusable item across shots/projects (characters, props, environments)
- Attributes: id, project_id or production_id (scoped), code, name, type (character|prop|env|fx), status, metadata
- Invariants: Asset code uniqueness scoped to owner (project or production depending on configuration)
- Notes: Asset ownership strategy must be documented (per-production or per-project) and configurable.

Task (aggregate root)
- Purpose: Work item assigned to a resource for a discipline (Animation, Lighting, Comp)
- Attributes: id, parent_id (shot_id or asset_id), name, discipline, status (todo|in_progress|review|done|blocked), assignee_id, estimate_hours, started_at, completed_at, priority, metadata
- Invariants: If assignee_id set, user must be a member of production or have assignment rights; status transitions verified by validators
- Notes: Tasks should be small and discipline-specific; larger work is modelled as multi-task workflows.

Version (entity)
- Purpose: An immutable iteration of completed work associated with a Task or Asset output.
- Attributes: id, task_id, created_by, created_at, version_number (v001), checksum, storage_path, metadata(json), thumbnails, status (submitted|approved|rejected|archived)
- Invariants: version_number increments within task or asset; checksum required for storage integrity
- Notes: Versions are append-only; immutability simplifies audit and publishing.

Review
- Purpose: Capture review sessions, playlists, frame-accurate notes and decisions.
- Attributes: id, project_id, created_by, created_at, playlist (ordered list of version_ids), participants, decisions, comments
- Invariants: playlist items must reference existing versions
- Notes: Reviews may be single-version or playlist-based; support timecoded comments and drawing overlays in UI (implementation detail outside domain model)

Publish
- Purpose: Approved and staged artifact for downstream use.
- Attributes: id, version_id, origin_task_id, status (staged|published|failed), storage_path, destination, metadata, published_at
- Invariants: publish only allowed for approved versions; publish records include checksum and size
- Notes: PublishService validates and stages artifacts, may invoke transcoding.

Delivery
- Purpose: External transfer of published assets to clients or vendors.
- Attributes: id, publish_id, destination, manifest, status (scheduled|in_progress|completed|failed), tracking_url, metadata
- Invariants: delivery must reference an existing publish record

Department
- Purpose: Logical grouping (Animation, Lighting, Comp)
- Attributes: id, production_id, code, name, leads

Team
- Purpose: Team of users often aligned to department
- Attributes: id, department_id, name, members

Resource (scheduling)
- Purpose: Represents a schedulable resource (person, workstation, render node)
- Attributes: id, type (human|machine), calendar_id, skills, cost_center, availability_rules

Value objects and small types
-----------------------------
- FrameRange (start,end)
- Timecode (HH:MM:SS:FF)
- VersionNumber (v001)
- FileChecksum
- Resolution

Implementation notes
--------------------
- Keep domain entities pure Python classes where business logic is needed; map to Django ORM via Infrastructure adapters when persistence required.
- Avoid large model methods; prefer domain services for cross-entity logic.
- Provide database-level constraints for uniqueness, foreign keys, and indexes supporting selectors (project_id, sequence_id, shot code, status).
- Document per-entity soft-delete policy (e.g., Versions/Publishes use soft-delete).

End of entities document.
