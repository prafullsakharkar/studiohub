# Production Domain — Canonical Specification

Generated: 2026-08-18T12:17:57+05:30
Author: Production Domain Architect (documentation produced by Copilot CLI runtime in VS Code)

Purpose
-------
This document defines the Production domain for StudioHub. It is the canonical source describing:
- What a Production represents in the business
- Core domain entities and aggregates
- Lifecycle states and transitions
- Production-level configuration and policies
- Workflows for Projects, Sequences, Shots, Tasks, Versions, Reviews, Publishes and Deliveries
- Implementation guidance targeted to the canonical architecture (Presentation → Application → Domain → Infrastructure)

Scope and audience
------------------
Scope: Studio-level production management for VFX, Animation, Post-production, Episodic media, Advertising, and Game cinematics. Not covered here: identity internals, infra plumbing, and 3rd-party vendor-specific adapters (described elsewhere).

Audience: Producers, Pipeline TDs, Engineers, Integration owners, Documentation authors.

High-level definition
---------------------
A Production models a studio's long-running creative engagement (feature film, season, episodic, campaign). A Production is a configuration and ownership boundary: it owns Projects/Episodes, shared Assets, default workflows, review templates, billing and reporting scopes, and production-level policies.

Key domain concepts
-------------------
- Organization (owns Productions) — defined in /docs and core domain
- Production (aggregate root)
- Project (domain entity; may represent episode/delivery)
- Episode (optional subdivision for episodic work)
- Sequence (logical grouping of shots)
- Shot (unit of work, identified by shot code)
- Asset (reusable production item)
- Task (work assigned to an artist)
- Version (iteration of a Task or Asset output)
- Review (review session or playlist)
- Publish (approved deliverable for downstream use)
- Delivery (final outbound transfer to client or vendor)
- Department, Team, Role, Resource (people or machines)

Aggregate boundaries and ownership
----------------------------------
Canonical aggregates:
- Production aggregate: owns production-level configuration and references to Projects. Transaction boundary: operations that change production configuration.
- Project aggregate: owns Sequences and high-level project metadata. Transaction boundary: project-level changes.
- Shot aggregate: root for shot-level state and invariants (contains Tasks and references to Versions). Transaction boundary: shot lifecycle operations (create, lock, archive).
- Asset aggregate: owns asset versions and publishes.
- Task aggregate: assignment, status, and version submission lifecycle.

General rule: prefer smaller aggregates. Transactions should normally remain within a single aggregate; cross-aggregate workflows are orchestrated by Application Services and Domain Events.

Canonical entity attributes (examples)
--------------------------------------
Production
- id (UUID)
- organization_id
- code (studio short code)
- name
- client
- status (draft, active, paused, completed, archived)
- dates: planned_start, planned_end, actual_start, actual_end
- default_workflow_id
- default_review_template_id
- timezone
- created_by, created_at, updated_at

Project
- id
- production_id
- code, name, description
- type (feature, episode, commercial)
- status
- planned/actual dates

Sequence
- id, project_id, code, name

Shot
- id, sequence_id, code, name, description
- start_frame, end_frame, frame_rate
- status (todo, in_progress, review, approved, published, blocked)

Task
- id, shot_id|asset_id, name, discipline, status (todo, in_progress, review, done), assignee_id, estimate_hours

Version
- id, task_id, version_number, created_by, created_at, path/uri, checksum, metadata

Review / Playlist / ReviewItem
- review session metadata, playlist of versions, comments, decisions

Publish
- id, version_id, destination, metadata, public_url, storage_path

Production lifecycle and states
-------------------------------
Production states: Draft → Active → Paused/OnHold → Completed → Archived
Transitions follow business approvals (e.g., Producer marks Active). When Archived, downstream effects (moving projects/tasks to read-only or archiving) are explicit operations, not automatic deletions.

Project lifecycle: Proposed → Active → OnHold → Completed → Archived
Shot lifecycle: Ready → Assigned → In Progress → Review → Approved → Published → Delivered/Archived
Task lifecycle mirrors Shot but is discipline-specific.

Workflows and policies
----------------------
StudioHub supports configurable workflows at Production level.
- A workflow is a named sequence of states and allowed transitions for an aggregate (e.g., Shot workflow: ready → layout → animation → lighting → comp → review → approve).
- Workflows may define per-state assignment rules, SLA/SLR timers, and automated transitions (scheduled or triggered by events).
- Default workflows are defined at Production level and can be overridden per Project.

Task assignment and resourcing
------------------------------
- Assignments are first-class: they link Task → User (or Resource pool).
- Assignment rules may include role/skill matching, availability windows, and capacity rules.
- Scheduling decisions are made by Application Services (Scheduler) using selectors and resource calendars.
- Avoid embedding scheduling into models — keep scheduling as an application-level orchestration service.

Scheduling & resource model
---------------------------
Key concepts:
- Resource (human or machine) with availability calendar, skills, cost center
- Calendar/booking windows (timezone-aware)
- Allocation / booking record (task_id, resource_id, start, end, percent)
- Constraints (no-overlap, capacity, working hours)

Scheduler responsibilities:
- Produce tentative schedules using selectors and constraint solvers
- Persist bookings as allocations
- Rebalance when constraints change (e.g., resource drop-out)
- Expose APIs for manual adjustments and approvals

Versioning, review, and approvals
---------------------------------
- Versions are immutable artifacts once created (content addressable via checksum + storage path).
- Reviews operate on Playlists (collections of Versions); Review sessions capture comments, frame-accurate notes, and decisions.
- Approval is a domain-level decision (VersionApproved) which may create a Publish.
- Publish covers transformations (e.g., transcode) and placement into downstream storage with metadata and rights.

Publishing & delivery
---------------------
- Publishes are approved outputs for downstream departments or vendors; PublishingService handles validation and staging.
- Delivery represents external transfer to client or vendor, including manifests, checksums, and signed receipts.

Events (domain / application / integration)
------------------------------------------
Domain events (business facts):
- ProductionCreated, ProductionUpdated, ProductionActivated, ProductionPaused, ProductionCompleted
- ProjectCreated, ProjectArchived
- SequenceCreated
- ShotCreated, ShotUpdated, ShotStatusChanged
- TaskAssigned, TaskUnassigned, TaskStatusChanged
- VersionCreated, VersionSubmitted, VersionApproved, VersionRejected
- ReviewCreated, ReviewDecisionMade
- PublishCreated, PublishCompleted

Application/Integration events (implementation):
- RenderJobQueued, RenderJobCompleted, StorageIngested, ExternalDeliveryInitiated

Event design rules (refer to architecture guidance):
- Keep payloads minimal, include trace ids, event_id, occurred_at, actor, org_id, aggregate_type/id, version
- Use on_commit to publish events; consider Outbox for external reliability (documented but optional)
- Consumers must be idempotent

Permissions & roles (brief)
---------------------------
- Role examples: Producer, Production Manager, Dept Lead, Artist, Reviewer, Ops, Organization Admin
- Permission granularity: module → category → action (as in docs/03-backend/production.md)
- Authorization checks: Presentation layer performs quick checks; Application services must re-assert business-level authorization

Data model & database ownership
-------------------------------
- Single PostgreSQL database is acceptable.
- Ownership: Production schema/tables belong to the Production bounded context.
- Other modules should use public module APIs rather than direct table access.
- Use UUIDs for cross-system identifiers; index appropriately (e.g., integer surrogate PKs are acceptable for hot tables after profiling).

Soft-delete, archival and retention
----------------------------------
- Soft-delete for entities that require audit/compliance (Versions, Publishes, Delivery records, Reviews).
- Archival is a two-step process: mark soft-deleted and then (optionally) move to cold storage.
- Queries default to excluding soft-deleted records.

Integration surface & DCC integrations
-------------------------------------
Production integrates with external systems: DCCs (Maya, Houdini, Nuke), Render Farms, Storage (S3/MinIO), Editorial, and 3rd-party production trackers.
- Integrations are implemented in Infrastructure/adapters and must not leak into Domain.
- Provide stable integration contracts and event mapping in docs/05-api and docs/integration.

Migration & interoperability (ShotGrid, ftrack)
-----------------------------------------------
- Provide import utilities and mapping docs for common tools. Keep mapping configurable in Production settings.
- Do not hard-code external vendor schemas into Domain models; map them in adapters.

APIs and presentation guidance
-----------------------------
- REST endpoints should be thin: view → serializer → application service.
- Example endpoints: /api/v1/productions/, /projects/, /sequences/, /shots/, /tasks/, /versions/, /reviews/, /publishes/
- API versioning and stable contracts are required for integrations.

Selectors, QuerySets, Managers and Services (implementation guidance)
--------------------------------------------------------------------
- QuerySets: implement DB-level reusable filters (ShotQuerySet.active(), VersionQuerySet.for_task())
- Managers: creation helpers and model-level shortcuts only
- Selectors: read-optimized APIs used by dashboards and app services (e.g., get_pending_reviews(project_id, user_id))
- Services: application-level orchestration (CreateProductionService, ScheduleTaskService, SubmitVersionForReview)
- Validators: separate structural (serializers) from domain validators (services/domain)

Example use-cases (pseudo-workflows)
-----------------------------------
1. Create Production
   - Presentation: POST /api/v1/productions/
   - Application: CreateProductionService (validate unique code, set default workflow)
   - Domain: Production aggregate created
   - Event: ProductionCreated

2. Create Shot and Assign Task
   - Presentation: POST /api/v1/projects/{project_id}/sequences/{seq_id}/shots/
   - Application: ShotService.create_shot
   - Domain: Shot aggregate created; Task created
   - Event: ShotCreated, TaskAssigned

3. Submit Version for Review
   - Presentation: POST /api/v1/versions/ (upload metadata)
   - Application: VersionService.submit_for_review (transaction: create version, attach to playlist)
   - Domain: VersionCreated, VersionSubmitted
   - Subscriber: notify review microflow (notification, thumbnail generation)

4. Approve Version and Publish
   - Application: VersionService.approve_version (validate publish rules)
   - Domain: VersionApproved → PublishCreated
   - Infrastructure: PublishService stages artifacts to storage

Testing and quality gates
-------------------------
- Unit tests: domain invariants, value object behaviour
- Integration tests: application services against test DB
- Contract tests: API and event payloads
- Architectural tests: import-boundary tests to ensure dependency direction

Operational considerations
--------------------------
- Optimize hot queries (selectors) and add caching for dashboards
- Use background workers for heavy tasks (thumbnailing, transcode, render orchestration)
- Monitor event queues and outbox if implemented
- Add runbooks for archive and delivery processes

ADR recommendations (production-domain specific)
------------------------------------------------
- ADR: Production Shared Configuration Scope (what is configurable per-production)
- ADR: Scheduling & Resource Ownership (how resources are represented and who owns calendars)
- ADR: Version Immutability and Publish Guarantees
- ADR: Outbox adoption for external delivery reliability (deferred decision)

Open questions / configurable options
------------------------------------
- Does the studio prefer Episode as a first-class aggregate or a Project subtype? (configurable)
- Outbox pattern: required now or documented for future?
- Scheduling engine: built-in simple scheduler vs pluggable advanced engine (recommend pluggable)

Next steps (recommended immediate tasks)
---------------------------------------
1. Expand docs/03-domain with the following files (create/merge):
   - production-domain.md (this file, canonical)
   - production-entities.md (detailed attributes and examples)
   - production-workflows.md (workflow DSL and examples)
   - production-scheduling.md (resource model and APIs)
   - production-events.md (event schemas and example payloads)
2. Add example application service and selector templates in docs/04-architecture or a code examples folder.
3. Create import-boundary tests to ensure backend/apps do not import outside allowed dependencies.
4. Convene a short review with Producers and Pipeline TDs to validate domain rules.

Related documents
-----------------
- docs/03-backend/production.md (implementation-level guidance)
- docs/02-architecture/* (service layer, event system)
- docs/03-domain/* (related domain docs)
- docs/05-api/* (API contracts and examples)

End of Production Domain specification.
