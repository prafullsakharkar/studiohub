# Annotations — Geometry, Frame Accuracy & History

Generated: 2026-08-18T12:53:51+05:30

Purpose
-------
Defines the annotation model used for draw-overs and frame-accurate feedback: geometries, coordinate systems, and audit/history requirements.

Annotation model
----------------
- id (UUID)
- review_id, review_item_id
- author_id
- frame (optional)
- frame_range (optional)
- geometry_type (point|line|rect|polygon|freehand|text|mask)
- geometry_payload (normalized coordinates, stroke width, color)
- comment_id (optional link to a comment)
- visibility (internal|external)
- created_at, updated_at

Coordinate system
-----------------
- Store normalized coordinates [0..1] relative to representation resolution to avoid platform differences

History & edits
---------------
- Preserve edit history for annotations when audit or legal requirements exist
- Provide soft-delete/hide for annotations to avoid permanent loss

APIs & events
-------------
- POST /api/v1/annotations/
- AnnotationCreated, AnnotationUpdated, AnnotationDeleted

Performance
-----------
- Batch annotation persistence where possible; avoid DB writes per mouse move

End of annotations doc.
