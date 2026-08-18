# Review Items — What Gets Reviewed

Generated: 2026-08-18T12:53:51+05:30

Definition
----------
A Review Item is the canonical unit under review. It references a Version, Publish, Representation or other production artifact and includes review-specific metadata (frame range, selected representation, snapshot reference).

Recommended attributes
----------------------
- id (UUID)
- project_id, production_id
- target_type (version|publish|representation|asset|shot)
- target_id (stable identifier)
- representation_id (which media representation to use)
- start_frame, end_frame, handles (optional)
- snapshot_reference (optional) — if snapshotting is enabled
- status (pending|in_review|approved|rejected)
- created_by, created_at

Snapshot policy
---------------
- Snapshotting captures the exact representation and metadata used in the review to preserve historical accuracy. Configure per project or per session.

APIs & selectors
----------------
- POST /api/v1/review-items/ (create from Version)
- GET /api/v1/review-items/{id}/comments

Selectors:
- ReviewItemSelector.for_playlist(playlist_id)
- ReviewItemSelector.pending_for_user(user_id)

Events
------
- ReviewItemCreated, ReviewItemSubmitted, ReviewItemUpdated

Testing
-------
- Validate snapshot references and representation resolution
- Validate target type constraints (e.g., representation exists for target)

End of review items doc.
