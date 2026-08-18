# Client Review — Secure Sharing, Portals & Guest Access

Generated: 2026-08-18T12:53:51+05:30

Purpose
-------
Documents secure client-facing review capabilities: guest users, expiring links, presentation packaging, watermarking, and data isolation.

Guest identities & access
------------------------
- Guests should be modeled separately from full StudioHub users (limited scope and permissions)
- Invite flows produce short-lived tokens or presentation links scoped to a Presentation or Playlist

Review links & security
-----------------------
- Links must support expiration, optional password protection, and access logging
- Links are single-purpose and revocable

Client portal
-------------
- Client portal exposes only authorized projects and presentations
- Provide role-limited UIs for comment submission and replies
- Avoid exposing internal production metadata unless explicitly allowed

Watermarking & downloads
------------------------
- Apply per-presentation watermarking (client name, email, timestamp) for external reviewers
- Control download permissions (none, proxy-only, full) and record downloads in audit logs

APIs & events
-------------
- POST /api/v1/client-invites/
- InviteCreated, InviteAccessed, InviteRevoked

Testing
-------
- Test link expiry, revocation, scope enforcement, and audit logs

End of client review doc.
