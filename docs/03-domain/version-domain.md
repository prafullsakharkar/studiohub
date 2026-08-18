# Version Domain

## Purpose

The Version domain distinguishes artist work iterations (versions) from published artifacts and deliveries. Versions are the canonical units for review and approval.

## Concepts & responsibilities

- Work-in-progress: local artist files not yet registered
- Version: a recorded submission representing a named iteration (v001, v002)
- Revision: a follow-up version created after review comments
- Submission: act of creating a Version for review
- Approved Version: a version that passed review
- Published Version: a version registered as a published artifact (may include multiple representations)

## Typical attributes

- version_number, tag, author, submitted_at, frame_range, representations (exr, mp4, playblast)
- metadata: checksum, resolution, duration, notes
- status: WIP, Submitted, UnderReview, Approved, Published

## Lifecycle

WIP → Submitted → UnderReview → Approved → Published

Notes:
- A Version is immutable once recorded (metadata may be augmented but binary artifacts remain content-addressed).
- A Publish references a Version (or multiple Versions) and registers it for consumption.

## Events

- VersionCreated
- VersionSubmitted
- VersionApproved
- VersionPublished

## Ownership & permissions

- Who creates versions: Artists and automated pipeline processes (publishers)
- Who can approve: Supervisors and designated approvers
- Policies: Policy-driven retention and naming conventions

## Integration

- Versions are key integration points for review tools and playback systems.
- StudioHub should provide stable contracts for representations and manifests so render/ingest pipelines can register and consume versions.
