# Domain Overview — StudioHub

Generated: 2026-08-18T12:04:01+05:30

This document summarizes the canonical domain model for StudioHub: the major domains, bounded contexts, domain ownership rules, production hierarchy, and cross-domain relationships.

It is intended as the authoritative domain reference for product, architecture, and implementation teams.

---

## High-level domain map

Organization (tenant)
 ├── Identity
 ├── People (Users)
 ├── Organization structure (Facilities, Departments, Teams)
 └── Productions
      ├── Projects / Episodes
      │    ├── Sequences
      │    │    └── Shots
      │    └── Assets
      └── Cross-project Shares (shared assets)

Cross-cutting domains: Tasks, Versions, Reviews, Publishes, Deliveries, Notifications, Reporting, Audit

---

## Production hierarchy (canonical)

StudioHub recommends the following canonical hierarchy while allowing configuration for studio-specific variations:

- Organization — top-level tenant (studio, facility, company)
- Production — large work program (feature film, series, campaign)
- Project — logical subdivision within a production (often aligned with episode or client deliverable)
- Episode (optional) — studio-specific, useful in episodic workflows
- Sequence (optional but common) — grouping of related shots
- Shot — primary work unit; frame range, editorial metadata

Notes:
- Assets are typically scoped to Project or Production depending on studio preference; StudioHub supports both (assets may be shared across projects in the same Production or Organization with access control).
- Productions can host multiple Projects; Projects belong to a single Production.
- Episode and Sequence are optional fields; StudioHub models them as configurable facets of Project structure.

---

## Bounded contexts (recommended)

StudioHub uses bounded contexts to enforce clear domain ownership without prescribing implementation boundaries. Suggested bounded contexts:

- Identity Context — users, credentials, SSO, MFA, roles
- Organization Context — facilities, departments, teams, billing metadata
- Production Context — production lifecycle, projects, episodes
- Asset Context — asset types, versions, publishes, dependencies
- Shot Context — sequences, shots, editorial data, frame ranges
- Task/Work Context — tasks, assignments, estimates, durations
- Versioning Context — versions, submissions, representations
- Review Context — review sessions, notes, decisions
- Publishing Context — publish artifacts, manifests, consumers
- Delivery Context — delivery packages, recipients, manifests
- Scheduling Context — calendars, availability, capacity
- Workflow/Automation Context — configured state machines, transitions, conditions
- Notification Context — email/slack/webhook integrations
- Reporting & Analytics Context — metrics and dashboards
- Audit Context — immutable audit records for compliance

Each context owns its language (Ubiquitous Language) and contracts; cross-context integration is via well-defined APIs and domain events.

---

## Core vs Supporting vs Generic Domains

Core Domains (business-critical, bespoke for StudioHub):
- Production Management
- Project & Episode Management
- Shot Management
- Asset Management
- Task / Work Management
- Versioning & Publish
- Review & Approval

Supporting Domains (important but reusable or pluggable):
- Scheduling & Resource Management
- Pipeline Integrations & DCC Connectors
- Notifications
- Reporting
- Delivery & Packaging

Generic Domains (infrastructure or cross-tenant concerns):
- Identity & Access
- Organization/Tenancy
- Audit & Compliance
- Configuration & Feature Flags
- Search
- Storage / Object Storage

---

## Domain ownership rules (guidelines)

- Each bounded context defines and owns its data models and invariants.
- Create operations are authorized by the context owner; e.g., ProductionContext owns Production creation and lifecycle.
- Cross-context references should be by stable identifiers and minimal denormalized metadata.
- Domain events are the preferred integration mechanism: a change in one context publishes a business event consumed by interested contexts.
- Avoid direct data mutation across contexts. Reads are allowed (selectors/queries) but writes must be via context APIs or events.

---

## Important cross-domain relationships

- Production → Projects, Sequences, Shots, Assets
- Project → Assets, Sequences
- Asset ↔ Asset Dependencies → other assets or shot-level references
- Shot → Tasks, Versions, Reviews, Dependencies (on assets or other shots)
- Task → Assignment (User/Team), Estimate, Actuals, Versions
- Version → Published artifacts, Review Submissions, Checksums
- Publish → Registered artifact metadata and consumers (render farm, archive, external systems)

Ownership should be explicit: e.g., Version is owned by Versioning Context; Review Context stores review notes but references the Version.

---

## Domain events (business-level)

Studio-level events (business vocabulary) — implementation of event bus is in Part 3.

- ProductionCreated
- ProjectCreated
- SequenceCreated
- ShotCreated
- AssetCreated
- TaskCreated
- TaskAssigned
- TaskCompleted
- VersionCreated
- VersionSubmitted
- ReviewCreated
- ReviewNoteAdded
- ReviewDecisionMade (Approved/Rejected)
- PublishCreated
- DeliveryRequested
- DeliveryCompleted

These events should carry minimal canonical metadata: event_id, occurred_at, actor, aggregate_type, aggregate_id, organization_id, payload.

---

## Lifecycle & State guidance

Documenting states is domain-specific. Example guidance:

- Production: Draft → Active → Paused → Completed → Archived
- Project: Planned → Active → On Hold → Completed
- Shot: NotStarted → InProgress → InReview → Approved → Finalized
- Asset: Draft → WIP → InReview → Approved → Published
- Task: Open → InProgress → Blocked → Review → Done
- Version: WIP → Submitted → UnderReview → Approved → Published
- Publish: Staged → Validated → Published → Consumed

State machines must be configurable per Production / Project.

---

## Next steps

- Read the individual domain documents (Production, Asset, Shot, Task, Version, Review, Publish, Delivery) in docs/03-domain/ for detailed domain definitions.
- Create example domain event contracts and a short ADR in Part 3 to formalize integration patterns.

