# Publish Domain — Types, Lifecycle & Integration

Generated: 2026-08-18T12:27:15+05:30

Purpose
-------
Defines StudioHub's Publish domain: what publishing means, publish types, lifecycle, metadata, and how downstream consumers discover and consume publishes.

Canonical definition
--------------------
A Publish represents a registered, production-approved output derived from a Version intended for downstream consumption by other departments, external partners, or delivery pipelines. Publishing records a stable artifact reference with metadata and optional storage location.

Key attributes
--------------
- id (UUID)
- production_id, project_id
- source_version_id
- publish_type (geometry|cache|texture|render|comp|audio|camera|usd|reference|other)
- name
- location (storage key or logical reference)
- metadata (json)
- created_by, created_at
- status (draft|submitted|approved|published|superseded|archived)
- manifest (list of representations/media ids)

Publish vs Version
------------------
- Version: immutable creative submission
- Publish: an approved consumable artifact derived from a Version

Publish lifecycle
-----------------
Example lifecycle:
- draft → submitted → approved → published → superseded

Publishing actions
------------------
- Register: create a publish record referencing a Version
- Validate: run automated checks (schema, expected files, checksums)
- Approve: human approval if required
- Promote: mark publish as available for downstream
- Deprecate/supersede: when a new publish replaces an old one

Discovery & integration
-----------------------
Downstream consumers discover publishes via selectors or APIs. Provide stable logical names and semantic metadata for consumers to locate suitable publishes (e.g., latest geometry publish for character X, LOD0).

Manifest and integrity
----------------------
A publish manifest enumerates representations and media objects. Validate checksums and sizes during publish validation stage.

Selectors & API
----------------
Endpoints:
- GET /api/v1/publishes/
- POST /api/v1/publishes/register/

Selectors:
- PublishSelector.latest_for(asset_id, publish_type)
- PublishSelector.by_version(version_id)

Events
------
Emit: PublishRegistered, PublishValidated, PublishApproved, PublishPublished

Testing
-------
- Validate manifest integrity
- Integration tests with downstream consumers

End of Publishes document.
