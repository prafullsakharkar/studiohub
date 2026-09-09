# Version Domain — Numbering, Ownership, Media & Immutability

Generated: 2026-08-18T12:27:14+05:30

Purpose
-------
Defines the Version domain: numbering, ownership, media relationships, statuses, immutability, derivation and dependencies. This document establishes the canonical StudioHub model for Versions and Representations.

Canonical definition
--------------------
A Version is a submitted creative result produced as the outcome of a Task (or WorkSession). A Version is an immutable record that references one or more Media/Representation objects describing encoded or derived files.

Recommended attributes
----------------------
- id (UUID)
- project_id, production_id
- task_id (optional)
- shot_id (optional)
- asset_id (optional)
- version_number (v001, v002)
- name, description
- author_id
- status (wip|submitted|in_review|approved|rejected|published|superseded|archived)
- created_at, submitted_at
- metadata (json)
- derived_from_version_id (optional)
- references [] (list of version ids)

Version numbering rules
-----------------------
- Version number scope: recommend per-task scope by default. Projects may opt for per-shot or global numbering via project configuration.
- Uniqueness: (task_id, version_number) must be unique for per-task scope; enforce DB constraints.
- Incrementing: typically automatic allocation on submission. Allow manual setting for special cases but validate uniqueness.
- Revisions: represent revisions by creating a new Version with incremented version_number; do not mutate prior versions.

Ownership and relationships
---------------------------
- Preferred canonical relationship: Task → Version (Version belongs to Task). Version references Shot/Asset/Production for context.
- Versions must record author and origin information (uploader, source commit, source files) in metadata.

Version immutability
--------------------
- Recorded metadata may be updated in limited circumstances (e.g., tags, classification), but core identity and created_at/submitted_at should be immutable.
- Media references (representations) should be append-only; replacing media requires creating a new Version.

Media, Representation & Files
-----------------------------
Separation of concerns:
- Version: logical submission record
- Media: storage-level object (URL, storage_key, size, checksum, mime_type, start_frame, end_frame)
- Representation: a labeled form of media ("1080p_mp4", "exr_sequence", "thumbnail")

Model suggestion:
- Media(id, storage_key, location, size, checksum, mime_type, start_frame, end_frame, resolution)
- Representation(id, version_id, name, media_id, attributes_json)

A Version may have multiple Representations pointing at Media objects.

Version status and lifecycle
----------------------------
Possible statuses:
- wip, submitted, in_review, approved, rejected, published, superseded, archived

Submission is a domain event: on submission, assign sequential version number (per scope), set submitted_at, emit VersionSubmitted event.

Version relationships
---------------------
Support relationships such as:
- derived_from_version_id
- supersedes_version_id (when published or finalized)
- references [] for supporting materials

Version dependencies
--------------------
A Version may depend on other Versions (asset versions, camera versions). Model explicit VersionDependency(version_id, depends_on_version_id, type).

Representation transformations
------------------------------
When deriving representations (encode to mp4, transcode, generate thumbnails), create new Media objects and link them with Representation records. Emit events: RepresentationCreated, MediaUploaded.

Publishing vs Version
---------------------
Publishing creates a Publish record referencing the source Version (see publishes.md). Publishing is a separate domain action that can trigger downstream consumption.

Selectors & API
----------------
API endpoints:
- GET /api/v1/versions/
- POST /api/v1/versions/submit/
- GET /api/v1/versions/{id}/representations/

Selectors:
- VersionSelector.by_task(task_id)
- VersionSelector.pending_review(project_id)

Events
------
Emit: VersionCreated, VersionSubmitted, VersionApproved, VersionPublished, RepresentationCreated

Testing & Validation
--------------------
- Enforce uniqueness constraints per chosen scope
- Validate immutability rules in tests
- Test representation linking and media integrity checks (checksum)

End of Versions document.
