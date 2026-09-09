# Presentations — Client-Facing Playlists & Branding

Generated: 2026-08-18T12:53:51+05:30

Definition
----------
A Presentation builds on a Playlist to provide a client- or executive-facing package: branding, watermarking, viewer settings, and access controls.

Recommended attributes
----------------------
- id (UUID)
- playlist_id
- title, description
- branding {logo, project_name, confidentiality_text}
- watermark {enabled, template}
- viewer_settings {player_controls, playback_speed_limits}
- access_policy {expires_at, password_protected, allowed_emails}
- created_by, created_at

Use cases
---------
- Client reviews where branding and restricted download are required
- Executive presentations where a curated set of shots is shown

APIs & events
-------------
- POST /api/v1/presentations/
- PresentationCreated, PresentationPublished

Security
--------
- Presentations often grant external access; use expiring links and audit access events

End of presentations doc.
