# Asset Domain

## Purpose

The Asset domain manages reusable production resources (models, rigs, textures, materials, sets). Assets are first-class business entities with versions, publishes, and dependencies.

## Core responsibilities

- Define asset types and templates per Production/Project.
- Track asset metadata, ownership, and status.
- Manage asset versions and publish lifecycle.
- Support dependency graph between assets and between assets and shots.

## Typical entities

- Asset (name, code, type, project/production scope, owner, status)
- AssetType (Character, Prop, Environment, Camera, Material, Rig, Groom)
- AssetVersion (version number, metadata, representations, checksum)
- Publish (artifact record for a version)
- Dependency (links to other assets or shots)

## Asset lifecycle (business)

Suggested lifecycle:
- Draft → WIP → Submitted (for review) → InReview → Approved → Published

Notes:
- Published versions are discoverable by consumers (shots, other assets, render jobs).
- Asset ownership is important for billing and access control.

## Events

- AssetCreated
- AssetVersionCreated
- AssetSubmittedForReview
- AssetApproved
- AssetPublished

## Ownership & Permissions

- Create asset: Artists or Pipeline TDs depending on studio policy.
- Approve/publish: Department Supervisor or Asset Lead.
- Dependencies: Asset owners are responsible for declaring and validating dependencies.

## Integration points

- Publishing workflows integrate with object storage / publish registries.
- DCC integrations: StudioHub should provide publisher plugins and metadata contracts for common DCCs.

