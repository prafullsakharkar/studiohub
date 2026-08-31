# StudioHub Domain Model Specification

## Domain Overview
StudioHub partitions the enterprise studio ecosystem into logical bounded contexts:

### 1. Identity & Access Context (`apps.identity`)
- **User**: Primary authentication identity with global system roles (`SUPER_ADMIN`, `ORGANIZATION_ADMIN`, `CREW_MEMBER`, `CLIENT_REVIEWER`) and VFX studio roles (`SUPERVISOR`, `ADMIN`, `LEAD`, `ARTIST`, `COORDINATOR`, `PRODUCER`, `CLIENT`).

### 2. Studio Organization Context (`apps.organization`)
- **Organization**: Top-level tenant container.
- **Client**: Production studios or streaming networks commissioning VFX work.
- **Vendor**: External outsource VFX facilities.
- **Department**: Discipline groupings (e.g., Compositing, FX, Modeling, Rigging, Lighting, Animation).
- **Team**: Tactical crews within a department led by a Lead Artist.
- **Office**: Physical facility hubs (e.g., Vancouver HQ, London Soho, Montreal, Mumbai).
- **Person**: Studio crew member profile linking to identity `User`, department, team, and billing rates.

### 3. Production Context (`apps.production`)
- **Project**: Root production container representing a film, episodic series, or commercial.
- **Sequence**: Narrative editorial chunk of shots.
- **Shot**: Individual camera cut with frame in/out ranges, handles, and pipeline status.
- **Asset**: Reusable 3D model, character, rig, prop, or environment lookdev asset.
- **Attachment**: Associated files, briefs, and reference materials.

### 4. Tasks & Timelogs Context (`apps.tasks`)
- **Task**: Granular unit of work assigned to a person or vendor.
- **Timelog**: Recorded billable/non-billable hours logged against a task with supervisor approval.

### 5. Review & Screening Context (`apps.reviews`)
- **ReviewSession**: Collaborative screening room with timecode-synced drawing annotations.
- **Playlist**: Curated reel of shot versions for internal dailies or client review.
- **ReviewAnnotation**: Frame-accurate vector drawing strokes and annotations.
- **ReviewComment**: Timecode-specific feedback notes.

### 6. Pipeline & Versions Context (`apps.pipeline`)
- **PublishedVersion**: Immutable render or DCC output snapshot (e.g. OpenUSD layers, EXR plates, Nuke scripts).
- **MediaAsset**: High-performance streaming proxy (QuickTime/H.264).
- **PublishItem**: Pre-flight validation gate before ingestion into master pipeline.

### 7. Delivery Turnover Context (`apps.deliveries`)
- **DeliveryPackage**: Formal client turnover bundle with QC validation, MD5 checksums, and delivery manifests.
