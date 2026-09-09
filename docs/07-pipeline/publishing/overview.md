# Publishing — Overview

Generated: 2026-08-18T12:34:07+05:30

Purpose
-------
Defines the Publish domain from a pipeline perspective: how a Version becomes a registered, validated, and consumable Publish for downstream consumers.

Scope
-----
- Publish registration and manifests
- Publish rules and validators
- Representation and media linking
- Idempotency and reconciliation
- Integration with storage and transfer services

Workflow
--------
1. Artist submits Version
2. ApplicationService schedules publish job
3. Job performs validation, transfers files, registers Publish manifest
4. Publish status updated and downstream consumers notified

Key concerns
------------
- Idempotency of publish actions
- Checksum and manifest integrity
- Validator extensibility
- Clear separation between Version (domain) and Publish (pipeline artifact)

End of publishing overview.
