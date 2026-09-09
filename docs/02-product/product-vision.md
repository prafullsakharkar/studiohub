# StudioHub — Product Vision

Generated: 2026-08-18T12:04:01+05:30

## What is StudioHub?

StudioHub is an enterprise production operating platform for VFX, animation, post-production, and digital-content studios. StudioHub models and automates production lifecycle relationships — productions, projects, shots, assets, tasks, versions, reviews, publishes, and deliveries — while integrating safely with existing DCC tools, render infrastructure, storage systems, and studio pipelines.

StudioHub is not "just a task tracker" or a generic project-management tool. It is a production-aware platform that codifies the business of content creation so studios of all sizes can run repeatable, auditable, and configurable production processes.

## Vision (30k foot)

Enable studios to manage creative production at scale by providing:

- A domain-first model that reflects how productions are organized and executed.
- Configurable workflows that adapt to studio-specific pipelines (VFX, animation, virtual production, post).
- A secure, self-hosted enterprise platform that supports distributed teams, vendors, and clients.
- Integration-first design for DCC tools, storage, and render systems so artists remain in familiar environments.
- An API-first architecture for automation, custom tooling, and pipeline extension.

## Product Principles

1. Production-first — Model the real-world production entities and workflows rather than forcing teams to fit into an abstract generic tool.
2. Domain-driven — Domains and bounded contexts should drive design and contracts.
3. Workflow-aware & Configurable — Studio workflows must be expressible and customizable without code changes.
4. Integration-first — Prioritize safe, well-documented integrations (publishes, DCC plugins, render integrations, webhooks).
5. Self-hosted enterprise — The platform must be deployable inside customer infrastructure with enterprise controls.
6. Extensible — Allow custom fields, automations, and integrations while preserving upgradeability.
7. API-first — All core capabilities are available via stable, versioned APIs.
8. Auditability & Compliance — Preserve an auditable trail of production and administrative actions.
9. Media-aware — Treat media and files as first-class resources while avoiding reimplementing storage engines.
10. Human-centered — Reduce coordination friction for artists and supervisors; optimize for clarity and speed.

## Product Scope (capability map)

The following capability areas represent StudioHub's intended scope. Each capability is categorized as Core / Supporting / Generic / Optional.

- Identity (Generic)
- Organization & Tenancy (Generic)
- Production Management (Core)
- Project & Episode Management (Core)
- Shot Management (Core)
- Asset Management (Core)
- Task / Work Management (Core)
- Versioning & Publish (Core)
- Review & Approval (Core)
- Scheduling & Resource Management (Supporting)
- Pipeline Integrations (Supporting)
- DCC & Publishing Tools (Supporting)
- Media & File Storage (Infrastructure)
- Delivery & Packaging (Supporting)
- Notifications & Collaboration (Supporting)
- Reporting & Dashboards (Supporting)
- Automation & Workflow Engine (Supporting / Optional)
- Security & Audit (Generic)
- Administration & Governance (Generic)

## Who uses StudioHub? (Primary personas)

- Executive: production overview, portfolio, delivery status.
- Producer: schedule, milestones, resourcing, risk management.
- Production Coordinator: task/shot tracking, notes, follow-ups.
- VFX Supervisor: shot/sequence status, reviews, approvals.
- Department Supervisor: assignments, quality control, throughput.
- Artist: assigned tasks, references, versions, publishing flows.
- Pipeline TD: publishing, metadata, automation, integrations.
- Client: controlled review/approval and deliveries.
- Vendor: scoped assignments, uploads, reviews, deliveries.
- System Administrator: security, tenancy, deployment, audits.

## Strategic Distinctions

- StudioHub models production relationships (shots, assets, tasks, versions) as domain concepts — not as generic issues or tickets.
- Studio workflows are configurable: StudioHub provides first-class workflow primitives (states, transitions, conditions, automation hooks).
- StudioHub separates business concepts (domain) from infrastructure concerns (storage, message buses, render queues) and keeps the domain model technology-agnostic.

## How this document is used

This product vision document is the canonical business-level description of what StudioHub is and why it exists. Implementation teams, product management, and architects must reference this document when making decisions that affect product scope, domain boundaries, and user-facing functionality.

For the domain model details, see docs/03-domain/domain-overview.md and the domain-specific documents under docs/03-domain/.
