# Playlists — Ordered Review Item Collections

Generated: 2026-08-18T12:53:51+05:30

Definition
----------
A Playlist is an ordered collection of Review Items used during a Review Session or Presentation. Playlists preserve item order, per-item metadata (start/end frames) and are replayable.

Recommended attributes
----------------------
- id (UUID)
- name, description
- project_id, production_id
- items: [{review_item_id, order, start_frame, end_frame, duration}]
- status (draft|ready|in_review|completed|archived)
- created_by, created_at, updated_at

Playlists vs Presentations
--------------------------
- Playlist: an ordered list of items focused on content ordering
- Presentation: playlist + branding + viewer settings + watermarking; used for client-facing review

Ordering & reordering
---------------------
- Preserve stable ordering using an ordering key; support reorder operations with optimistic concurrency

APIs & selectors
----------------
- POST /api/v1/playlists/
- POST /api/v1/playlists/{id}/reorder
- GET /api/v1/playlists/{id}/items

Selectors:
- PlaylistSelector.by_project(project_id)
- PlaylistSelector.pending_review(project_id)

Events
------
- PlaylistCreated, PlaylistItemAdded, PlaylistReordered, PlaylistSubmitted

Testing
-------
- Test item ordering, pagination, bulk-add and reorder idempotency

End of playlists doc.
