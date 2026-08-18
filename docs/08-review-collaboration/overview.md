# Review & Collaboration — Overview

Generated: 2026-08-18T12:53:51+05:30

Purpose
-------
This section defines StudioHub's Review and Collaboration domain: review sessions, playlists, review items, feedback (comments, annotations, draw-overs), approvals, client/vendor review flows, and collaboration features (mentions, threads, notifications). It complements Parts 1–7 by treating review as a first-class, auditable domain capability for enterprise VFX/animation productions.

Scope
-----
- Review session lifecycle and templates
- Playlist and presentation models
- Review item, media selection and snapshotting rules
- Feedback model: comments, annotations, threads, draw-overs
- Approvals, decisions, and approval policies
- Client and vendor review flows, secure links, and portals
- Notifications, reminders and escalation
- Analytics and review performance metrics
- Integration points with Version/Publish/Media systems and Pipeline

Guiding principles
------------------
- Review must be a first-class domain: model sessions, items, playlists and decisions explicitly.
- Preserve immutability for reviewed Versions/Representations (snapshots) when required for auditability.
- Keep domain logic in the Production/Domain layer; review UI/players and media processing live in Presentation/Infrastructure.
- Support configurable workflows, approval gates and visibility (internal vs external).
- Prioritize security and tenant isolation for client/vendor access and review links.

How to use these docs
---------------------
Read sequentially:
1. docs/08-review-collaboration/overview.md
2. docs/08-review-collaboration/architecture.md
3. docs/08-review-collaboration/review-sessions.md
4. docs/08-review-collaboration/playlists.md
5. feedback and approvals subfolders for details

Next steps
----------
- Produce data model sketches and API contracts for core review entities.
- Create Mermaid diagrams for session/playlist/workflow flows.
- Draft ADRs for review snapshotting and external review link security.

End of overview.
