# Production Domain API Specification (`apps.production`)

## 1. Domain Overview
The `production` domain represents the core creative workflow entities: Projects, Sequences, Shots, Assets, Tasks, Timelogs, Reviews, Versions, Playlists, and Deliveries.

---

## 2. Core Entities & Endpoints

### 2.1 Projects (`/api/v1/projects/`)
- `GET /api/v1/projects/`: Paginated project list with progress percentage aggregates.
- `POST /api/v1/projects/`: Create project with resolution, aspect ratio, frame rate, and color space settings.
- `GET /api/v1/projects/{id}/`: Detail view.
- `PATCH /api/v1/projects/{id}/`: Update metadata.
- `DELETE /api/v1/projects/{id}/`: Archive project.

### 2.2 Shots (`/api/v1/shots/`)
- `GET /api/v1/shots/`: Filter by `project_id`, `sequence_code`, `status`, `assigned_artist_id`.
- `POST /api/v1/shots/`: Create shot with `frame_in`, `frame_out`, `handle_frames`.
- `GET /api/v1/shots/{id}/`: Full shot detail.
- `PATCH /api/v1/shots/{id}/`: Update shot.
- `POST /api/v1/shots/{id}/approve/`: One-click supervisor signoff with domain event dispatch.

### 2.3 Assets (`/api/v1/assets/`)
- `GET /api/v1/assets/`: Filter by `project_id`, `category`, `status`, `department_id`.
- `POST /api/v1/assets/`: Register asset with OpenUSD schema reference, polygon count, LODs.

### 2.4 Tasks & Bulk Operations (`/api/v1/tasks/`)
- `GET /api/v1/tasks/`: Paginated task list with comprehensive status, priority, and date range filters.
- `POST /api/v1/tasks/`: Create task.
- `POST /api/v1/tasks/bulk-assign/`: Batch assign artist/team.
- `POST /api/v1/tasks/bulk-status/`: Batch change status.
- `POST /api/v1/tasks/bulk-archive/`: Batch archive.
- `POST /api/v1/tasks/bulk-delete/`: Batch delete.

### 2.5 Reviews & Screening Sessions (`/api/v1/reviews/`)
- `GET /api/v1/reviews/`: List active and archived screening rooms.
- `POST /api/v1/reviews/`: Create session.
- `POST /api/v1/reviews/{id}/annotations/`: Save visual drawing canvas annotations on exact frame numbers.
- `POST /api/v1/reviews/{id}/approve/`: Approve review session.
- `POST /api/v1/reviews/{id}/reject/`: Reject review session (retake).

### 2.6 Deliveries & Turnovers (`/api/v1/deliveries/`)
- `GET /api/v1/deliveries/`: List turnover packages.
- `POST /api/v1/deliveries/`: Create delivery manifest.
- `POST /api/v1/deliveries/{id}/validate/`: Run automated QC pre-flight validation rules.
- `POST /api/v1/deliveries/{id}/submit/`: Dispatch package to client destination.
