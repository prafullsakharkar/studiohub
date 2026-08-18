# Pipeline — Overview

Generated: 2026-08-18T12:34:00+05:30

Purpose
-------
This section defines StudioHub's Pipeline architecture, responsibilities, and how the platform integrates with Digital Content Creation (DCC) tools, storage systems, render farms, and automation systems. Pipeline documentation describes the technical "how" that complements the Production domain "what" defined in Parts 1–5.

Scope
-----
Pipeline documentation covers:
- Pipeline bounded context and responsibilities
- Pipeline configuration and profiles
- Workspace and context resolution
- Path templates, path resolver and path mapping
- Storage abstraction and transfer patterns
- DCC adapter and plugin architecture
- Publish model, publish rules, publish validation and manifests
- Automation: jobs, triggers, events and safety
- Render farm integration and render job abstractions
- Media processing and large-file handling
- Observability, audit and security for pipeline operations

Guiding principles
------------------
- StudioHub is the System of Record for Production entities (Project, Shot, Asset, Task, Version, Publish). Pipeline components are adapters that implement technical workflows without embedding business rules.
- Keep domain logic inside application services/domain; pipeline code is an infrastructure adapter layer.
- Configuration is hierarchical and environment-aware (Organization → Production → Project → Department → Task Type). Avoid hard-coded path or tool constants.
- Pipeline operations must be idempotent, auditable, and observable.
- Support multi-platform path mapping and storage backends through adapters.

How to use these docs
---------------------
Start with:
- docs/07-pipeline/overview.md (this page)
- docs/07-pipeline/architecture.md (system-level architecture)
- docs/03-domain/* for Production and Part 5 domain specifics

Then read subtopics for DCC integration, publishing, automation, storage, and render integration.

Goals for Part 6
----------------
- Define the pipeline bounded context and its interface with Production
- Provide canonical abstractions (PathResolver, StorageAdapter, DCCAdapter, PublishRule, Validator, PipelineSDK)
- Document operational requirements (health, metrics, retries, reconciliation)
- Produce ADRs only for decisions that require formalization (storage abstraction, SDK, path resolution, publish idempotency)

End of overview.
