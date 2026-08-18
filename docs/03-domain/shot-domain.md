# Shot Domain

## Purpose

The Shot domain models editorial units of work (shots) within sequences and projects. A Shot represents a frame range and carries editorial metadata used by departments to deliver final frames or passes.

## Key responsibilities

- Represent shot metadata (code, in/out frames, handles, aspect, fps)
- Group department tasks and assignments per-shot
- Track shot status across departments
- Reference dependencies (assets, other shots)
- Aggregate delivery artifacts and finalables

## Typical entities

- Sequence (grouping)
- Shot (code, frame range, handles, duration)
- ShotTask (task per department for a shot)
- ShotVersion (artist submissions for a shot task)
- ShotReview (review sessions scoped to shot versions)

## Shot lifecycle

Suggested business states:
- NotStarted → InProgress → InReview → Approved → Finalized

Transitions:
- InProgress → InReview (artist submits version)
- InReview → Approved/Revision Requested (supervisor decision)
- Approved → Finalized (QA / delivery complete)

## Events

- ShotCreated
- ShotTaskAssigned
- ShotVersionCreated
- ShotVersionSubmitted
- ShotApproved

## Ownership & Permissions

- Create shot: Producers / Editorial / Production Coordinators
- Modify shot metadata: Editorial or Production team
- Approve: VFX Supervisor / Department Supervisor

## Notes

- Frame ranges, handles and editorial notes are important for render and compositing handoffs.
- Shots can reference multiple assets; manage these dependencies explicitly to support batch updates when assets change.
