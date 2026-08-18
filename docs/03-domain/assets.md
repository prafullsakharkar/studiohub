# Asset Domain — Definition, Lifecycle & Usage

Generated: 2026-08-18T12:27:14+05:30

Purpose
-------
Defines the Asset domain for StudioHub: what an Asset is, its lifecycle, types, relationships to Shots, configuration, and implementation guidance aligned with the canonical architecture.

Core definition
---------------
An Asset is a reusable production object (character, prop, environment, vehicle, FX element, etc.) that may be used across multiple shots and projects. An Asset represents the production concept and metadata; its versions and media are captured as separate Version and Media entities.

Key distinctions
----------------
- Asset ≠ Version: Asset is the conceptual object; Version is an immutable iteration of an Asset's deliverable.
- Asset ≠ Publish: Publish is an approved derivative for downstream use.
- Asset Type is configurable and drives default behavior, not application logic.

Recommended attributes (non-exhaustive)
---------------------------------------
- id (UUID)
- organization_id
- production_id or project_id (scope)
- code (studio code, unique within scope)
- name
- type (configurable string)
- status (concept|modeling|texturing|lookdev|rigging|approved|published|retired)
- description
- tags (list)
- metadata (json)
- owner_id (user or team)
- created_by, created_at, updated_by, updated_at

Mandatory fields
----------------
- id, code, name, scope (production_id or project_id), created_at. Asset Type should be recommended but configurable per-studio.

Asset lifecycle (configurable)
------------------------------
Studios must be able to configure the lifecycle per-Production or per-AssetType. A typical lifecycle example:

Concept → Modeling → Texturing → Lookdev → Rigging → Approved → Published → Retired

Rules:
- Not every Asset must traverse every stage.
- Lifecycle transitions are governed by configured workflows and validators.
- Application Services perform transitions, enforce guards, and emit events (AssetCreated, AssetUpdated, AssetPublished).

Asset types and configuration
-----------------------------
Asset Types are configuration objects that define recommended defaults (not hard-coded rules):
- default_workflow_id
- default_task_templates (list)
- default_departments
- required_review_policy
- naming_pattern

Asset-type behavior should be applied by Application Services when creating assets or generating task templates, not by embedding logic in the Asset entity.

Asset hierarchy and collections
------------------------------
Support parent/child relationships only where studios need them. Recommended patterns:
- Parent Asset → Child Asset (explicit relation)
- Asset Collection / Group (many-to-many) for thematic grouping

Avoid deep implicit hierarchies unless real production value exists. Document both parent-child and collection models as explicit relations.

Asset usage in shots
--------------------
Model Asset usage as references:
- ShotAssetReference: (id, shot_id, asset_id, variant, version_id?, usage_metadata)

Notes:
- Asset referenced by shot should not be duplicated per-shot; instead store references with optional per-shot metadata (e.g., placement, variant, notes).
- When an Asset is updated, Versions are created; shot references may optionally bind to a specific Asset Version for reproducible renders.

Ownership and scope
-------------------
- Assets may be scoped to production or project; the ownership model should be configurable per-studio and documented in Production settings.
- Ownership affects code uniqueness scope, permissions and publishing responsibilities.

API considerations
------------------
Suggested REST resources (thin presentation layer):
- GET/POST /api/v1/assets/
- GET/PUT/DELETE /api/v1/assets/{id}/
- GET /api/v1/assets/{id}/versions/
- GET /api/v1/shots/{id}/assets/ (shot asset references)

Selectors
---------
Provide selectors for common read needs:
- AssetSelector.get_by_code(production_id, code)
- AssetSelector.search_by_tag(project_id, tags)
- AssetSelector.used_in_shot(asset_id)

Events
------
Emit domain events: AssetCreated, AssetUpdated, AssetPublished, AssetRetired. Keep payloads minimal (ids + key metadata).

Testing guidance
----------------
- Unit tests for asset creation, lifecycle transitions, and uniqueness constraints.
- Integration tests for asset usage in shot references, and UI/API contract tests.

End of Asset domain document.
