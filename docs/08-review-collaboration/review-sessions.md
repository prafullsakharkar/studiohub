# Review Sessions — Lifecycle, Participants & Templates

Generated: 2026-08-18T12:53:51+05:30

Definition
----------
A ReviewSession groups a presentation of one or more review items (versions/representations) at a scheduled time or ad-hoc for a set of participants. Sessions capture context (project, sequence, shot, playlist), participants, decisions and audit.

Recommended attributes
----------------------
- id (UUID)
- project_id, production_id
- title, description
- owner_id (creator)
- scheduled_at, started_at, completed_at
- status (draft|scheduled|open|in_review|paused|completed|cancelled|archived)
- type (internal|dailies|client|vendor|final|delivery)
- participants [{user_id, role, invited_at, status}]
- playlist_id (current)
- policies (visibility, watermarking, downloads)
- created_at, updated_at

Participant model & roles
-------------------------
- Participant has role (presenter, reviewer, supervisor, approver, observer, client, vendor)
- Invitation flow (pending, accepted, declined, expired) tracked per participant

Templates & workflow
--------------------
- ReviewSessionTemplate: reusable defaults (roles, playlist, watermarking, approval gates)
- Workflow integration: sessions can be connected to ReviewWorkflowTemplates to enforce steps and approvals

Snapshotting & immutability
---------------------------
- Consider snapshotting playlist items (version_id + representation_id + manifest) at session start to prevent historical drift
- Snapshotting preserves auditability but increases storage references — make snapshot policy configurable per project

APIs & selectors
----------------
- POST /api/v1/review-sessions/ (create)
- POST /api/v1/review-sessions/{id}/start
- POST /api/v1/review-sessions/{id}/complete
- GET /api/v1/review-sessions/?project_id=...

Selectors:
- ReviewSessionSelector.active_for_user(user_id)
- ReviewSessionSelector.by_project(project_id)

Events
------
- ReviewSessionCreated, ReviewSessionStarted, ReviewSessionCompleted, ParticipantInvited

Testing
-------
- Test invitation lifecycle, snapshot behavior, and session-state transitions

End of review sessions doc.
