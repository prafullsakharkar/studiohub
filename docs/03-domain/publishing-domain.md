# Publishing Domain

## Purpose

Publishing records and registers consumable artifacts (representations, manifests) that downstream consumers (shots, renders, editorial, external systems) can reference.

Publishing is distinct from merely uploading a file — a Publish is a business-level registration of an artifact with metadata, validation, and discoverability.

## Key concepts

- Publish: registry entry linking a Version to a storage location and metadata
- Representation: a specific format (exr, dpx, alembic, USD, playblast)
- Manifest: a canonical list of files and checksums associated with a Publish
- PublishType: semantic category (work, review, deliverable, cacheable asset)
- Consumer: a system or process that consumes the publish (render, editorial, pipeline tools)

## Lifecycle

Staged → Validated → Published → Consumed (or Deprecated)

Notes:
- Validation steps can include checksum, format checks, dependency checks, and policy enforcement.
- A Publish must reference an Approved Version where the workflow requires approvals before publishing.

## Events

- PublishCreated
- PublishValidated
- PublishConsumed
- PublishDeprecated

## Ownership & permissions

- Who publishes: Artists (via DCC publishers) and automated pipeline processes
- Who validates: Pipeline TDs or automated validators
- Who can deprecate: Owners and Admins

## Integration

- Provide a stable publish manifest format and endpoint for registration.
- Publish registry must be discoverable via API and searchable (by asset, version, context).
