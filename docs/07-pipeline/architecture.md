# Pipeline Architecture — Roles, Boundaries & Patterns

Generated: 2026-08-18T12:34:01+05:30

Summary
-------
This document describes the high-level architecture for StudioHub's Pipeline capabilities and how they integrate with the rest of the system described in Parts 1–5. It focuses on bounded contexts, adapter patterns, job execution, and safe separation between domain and infrastructure.

Bounded context
---------------
The Pipeline bounded context is responsible for technical workflows: workspace creation, DCC integration, path resolution, validation, media processing, publishing, transfers, render submission, and automation jobs. It is NOT responsible for business decisions such as "what must be done" — those remain in the Production/Domain context.

Primary responsibilities
-----------------------
- Path resolution and mapping
- Storage abstraction and transfers
- DCC adapters and plugin integration
- Publish registration and manifest validation
- Media processing pipeline (thumbnails, proxies)
- Job orchestration (validation jobs, publish jobs, transfer jobs)
- Integration with render managers and external services
- Event emission for domain events and pipeline events

Key abstractions
----------------
- PathResolver: generate canonical logical paths from context and templates
- StorageAdapter / TransferService: adapter interface for uploads/downloads/copies
- DCCAdapter: runtime adapter for DCC actions (collect, publish, validate)
- PublishRule: declarative rules that validate publishes and map to storage
- Validator: pluggable validation units returning Pass/Warning/Fail
- PipelineJob / JobExecution: job definitions and executions (queued, running, done)
- PipelineSDK: client library for DCCs and CLI to interact with StudioHub via public APIs

Layering & dependencies
-----------------------
Maintain the canonical layering from Part 3:
- Domain/Application (Production, Version, Publish rules remain here)
- Infrastructure (Pipeline adapters, Storage, Render, Celery tasks)

Application services schedule pipeline jobs rather than invoking infrastructure synchronously. Example:
- Domain: Artist marks Version as ready_for_publish → ApplicationService: SchedulePublish(domain_event) → Infrastructure: Celery task executes transfer/validation

Job execution & reliability
---------------------------
- Use Celery (existing) for job execution; treat it as an execution mechanism only.
- Jobs must be idempotent and durable; use retries, status tracking and reconciliation.
- For cross-process reliability (DB + transfers), recommend Outbox pattern or compensating reconciliation processes (documented as ADR candidate).

Security & permissions
----------------------
- Pipeline adapters operate under service accounts with limited scopes; DCC plugins use short-lived tokens issued by StudioHub.
- Pipeline actions respect domain permissions enforced by StudioHub API — adapters never bypass authorization.

Observability & audit
---------------------
- Emit structured logs and metrics for job lifecycle, transfer status, validation results, and render submissions.
- Record audit events for workspace creation, publishes, and critical pipeline operations.

Next steps
----------
- Define concrete interfaces (PathResolver, StorageAdapter, DCCAdapter) in docs/07-pipeline/* and propose ADRs for storage abstraction and outbox.
- Produce example flow diagrams and example SDK calls.

End of architecture document.
