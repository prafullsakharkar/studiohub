# Review Domain — Sessions, Notes, Annotations & Approval

Generated: 2026-08-18T12:27:15+05:30

Purpose
-------
Defines StudioHub's Review domain: review sessions, notes, annotations, approvals, roles, workflows and audit requirements. This document maps how Versions are reviewed and decisions recorded.

Canonical definitions
---------------------
- Review: a structured evaluation of one or more Versions.
- Review Session: an event (meeting or virtual session) grouping Versions, Notes, and Decisions.
- Review Note: an individual comment or action item attached to a Version, optional frame or frame-range, with metadata.
- Approval: an explicit decision recorded against a Version or Review Session.

Recommended attributes
----------------------
Review
- id (UUID)
- production_id, project_id
- session_id (nullable)
- version_id
- reviewer_id
- status (open|addressed|approved|rejected|conditional)
- decision (approve|reject|conditional|comment)
- comment
- created_at, closed_at

Review Session
- id
- production_id, project_id
- title
- date
- department
- organizer_id
- attendees []
- versions []
- notes []
- decisions []
- created_at

Review Note
- id
- review_id
- author_id
- version_id
- frame (optional)
- frame_range (optional)
- text
- category
- severity
- assignee_id (optional)
- status (open|in_progress|resolved|closed)
- created_at, updated_at

Annotations
-----------
- Annotations are metadata or references to external annotation stores (e.g., web-based annotation service). Core domain stores only structured references (annotation_id, type). Do not embed binary annotation data in domain objects.

Note categories & status
------------------------
- Configurable categories: creative, technical, continuity, color, animation, fx, lighting, comp
- Status examples: open, in_progress, addressed, reviewed, closed

Review workflow
---------------
Typical flow:
1. Artist submits Version
2. Version enters Review queue
3. Lead or Reviewer opens Version and creates notes
4. Notes assigned to artists
5. Artists submit new Version addressing notes
6. Reviewer marks notes resolved; session records final decision

Review vs Approval
------------------
Approval is a structured decision with authoritative weight (supervisor, client). Reviews may result in approvals. Approval records must include approver_id, decision, timestamp, scope.

Audit & history
----------------
All review actions, note changes, and approvals must be auditable. Maintain immutable event logs or append-only records for decisions with user/timestamp.

Selectors & API
----------------
Endpoints:
- GET /api/v1/reviews/
- POST /api/v1/reviews/sessions/
- POST /api/v1/reviews/{id}/notes/

Selectors:
- ReviewSelector.for_version(version_id)
- ReviewSelector.open_notes_for_assignee(user_id)

Events
------
Emit: ReviewCreated, NoteCreated, NoteAssigned, NoteResolved, ApprovalGranted

Testing
-------
- Validate note frame references within version frame ranges
- Validate audit trails and immutability of approvals

End of Reviews document.
