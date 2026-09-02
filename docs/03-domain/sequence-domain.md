# Sequence Domain

## Purpose

The Sequence domain models groups of shots (editorial reels) within a Project. A Sequence is an Organization-owned, Project-scoped grouping entity that carries editorial metadata and supports soft-delete (archive) and restore. It is the canonical parent grouping above Shot.

## Key responsibilities

- Group shots into editorial reels within a project
- Carry sequence-level metadata (code, name, status, frame range, department, tags)
- Provide a stable, org-scoped identity for shot grouping (`unique_together=(project, code)`)
- Support recoverable archive (soft-delete) and restore for lifecycle management
- Expose bulk operations for enterprise-scale sequence management

## Typical entities

- Sequence (org + project FK, code unique per project, name, status, frame range, department, tags, metadata)

## Relationship hierarchy

```text
Organization
    ↓
Project
    ↓
Sequence   ← first-class grouping entity
    ↓
Shot
```

## Lifecycle

Suggested business states (reuse `ProductionStatus`):
- Not Started → In Progress → Pending Review → Approved
- Archived (soft-delete) → Restored (recoverable)

Transitions:
- In Progress → Pending Review (production coordinator turnover)
- Pending Review → Approved (supervisor approval)
- Active → Archived (soft-delete via archive)
- Archived → Restored (un-archive)

## Events

- SequenceCreated
- SequenceUpdated
- SequenceArchived
- SequenceRestored

## Bulk operations

All bulk operations are organization-scoped and fail closed. Each item runs in
its own transaction so a failure on one row does not roll back the others
(partial success is reported back to the client).

- `bulk_create` — per-item `created | exists | soft_deleted | duplicate | invalid`
- `bulk_update` — per-item `updated | not_found | invalid`
- `bulk_archive` — soft-delete, per-item `archived | not_found`
- `bulk_restore` — un-delete, per-item `restored | not_found`
- `existence_check` — pre-create classification `new | exists | soft_deleted | duplicate | invalid`

Bulk responses use the envelope `{processed, successful, failed, results[]}`.

## API

`SequenceViewSet` at `/api/v1/sequences/`. See
[`docs/api/domains/production.md`](../api/domains/production.md#2-sequences).

## Ownership & Permissions

- View sequences: `sequences:read`
- Create sequences: `sequences:create`
- Update sequences: `sequences:update`
- Archive/delete sequences: `sequences:delete`

## Notes

- Sequence is a first-class model; Shot references a sequence by `code` (denormalized `sequence_code`) for backward compatibility.
- Soft-delete is the recoverable "archive" mechanism (see ADR-0014 soft-delete strategy). Archive/restore are preferred over hard deletes to preserve history.
- When a bulk-create encounters an existing soft-deleted code, the client is expected to prompt to restore rather than blindly creating a duplicate.
