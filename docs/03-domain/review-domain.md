# Review Domain

## Purpose

The Review domain models the processes and artifacts required to evaluate creative work: review sessions, notes, annotations, reviewers, decisions, and approvals.

## Responsibilities

- Create and manage review sessions (ad-hoc or scheduled)
- Associate review items (versions) with sessions
- Capture review notes (textual, frame-anchored annotations)
- Record decisions (approve, reject, request revision)
- Track reviewer roles and permissions

## Typical entities

- ReviewSession (title, participants, scope, start/end)
- ReviewItem (a Version or set of Versions)
- ReviewNote (author, timestamp, frame, severity, text)
- ReviewDecision (approve, request changes, reject)

## Review types

- Internal (in-team)
- Supervisor
- Client-facing
- Final

## Lifecycle

Planned → Active → Closed → Archived

Decisions create downstream effects (e.g., generating tasks from review notes).

## Events

- ReviewCreated
- ReviewNoteAdded
- ReviewDecisionMade
- ReviewClosed

## Permissions & ownership

- Create: Coordinators, Supervisors, Artists (depending on studio policy)
- Annotate: Participants in the session
- Decide: Supervisor, Designated Approver

## Notes

- Reviews should reference Versions by stable identifier.
- The system should support private reviewer notes (internal) and public notes (client-visible).
- Consider integrations with third-party review tools and frame-accurate annotation standards (RV, ftrack, ShotGrid connectors).
