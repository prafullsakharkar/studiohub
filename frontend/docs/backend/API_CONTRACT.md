# StudioHub Backend API Contract & Specification

## Reference
This document defines the REST endpoints exposed by the Django REST Framework backend at `/api/v1/`, conforming strictly to the frontend client expectations.

---

## 1. Authentication (`/api/v1/auth/`)

| Method | Endpoint | Description | Request Body | Response Payload | Status Code |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `POST` | `/api/v1/auth/login/` | Authenticate user credentials | `{"email": "...", "password": "..."}` | `{"tokens": {"access": "...", "refresh": "..."}, "user": {...}}` | 200 OK |
| `POST` | `/api/v1/auth/refresh/` | Refresh expired access token | `{"refresh": "..."}` | `{"access": "..."}` | 200 OK |
| `POST` | `/api/v1/auth/logout/` | Invalidate/blacklist refresh token | `{"refresh": "..."}` | `{"detail": "Successfully logged out."}` | 200 OK |
| `GET` | `/api/v1/auth/me/` | Retrieve current user profile | None | `UserSerializer` object | 200 OK |
| `PATCH` | `/api/v1/auth/me/` | Update current user profile | Partial user fields | `UserSerializer` object | 200 OK |

---

## 2. Organization (`/api/v1/org/`)

- `GET /api/v1/org/organizations/` - List organizations (filtered by tenant)
- `GET /api/v1/org/clients/` - List studio clients
- `POST /api/v1/org/clients/` - Create client
- `GET /api/v1/org/vendors/` - List external vendors
- `POST /api/v1/org/vendors/` - Create vendor
- `GET /api/v1/org/departments/` - List studio departments
- `GET /api/v1/org/teams/` - List department teams
- `GET /api/v1/org/offices/` - List global studio offices
- `GET /api/v1/org/people/` - List studio crew members & profiles

---

## 3. Production (`/api/v1/prod/`)

- `GET /api/v1/prod/projects/` - List projects
- `POST /api/v1/prod/projects/` - Create project
- `GET /api/v1/prod/sequences/` - List sequences (`?project=<id>`)
- `GET /api/v1/prod/shots/` - List shots (`?project=<id>&sequence_code=...`)
- `POST /api/v1/prod/shots/` - Create shot
- `POST /api/v1/prod/shots/{id}/approve/` - Approve shot
- `GET /api/v1/prod/assets/` - List 3D assets
- `POST /api/v1/prod/assets/` - Create asset
- `GET /api/v1/prod/attachments/` - List attachments

---

## 4. Tasks & Timelogs (`/api/v1/work/`)

- `GET /api/v1/work/tasks/` - List tasks (`?project=<id>&status=...&assignee=...`)
- `POST /api/v1/work/tasks/` - Create task
- `POST /api/v1/work/tasks/bulk-assign/` - Bulk assign tasks to crew/team
- `POST /api/v1/work/tasks/bulk-status/` - Bulk change status
- `POST /api/v1/work/tasks/bulk-archive/` - Bulk archive tasks
- `POST /api/v1/work/tasks/bulk-delete/` - Bulk soft-delete tasks
- `GET /api/v1/work/timelogs/` - List timelogs
- `POST /api/v1/work/timelogs/` - Submit timelog
- `POST /api/v1/work/timelogs/{id}/approve/` - Approve timelog
- `POST /api/v1/work/timelogs/{id}/reject/` - Reject timelog

---

## 5. Reviews & Screening (`/api/v1/review/`)

- `GET /api/v1/review/reviews/` - List review sessions
- `POST /api/v1/review/reviews/` - Create review session
- `POST /api/v1/review/reviews/{id}/submit/` - Submit for screening
- `POST /api/v1/review/reviews/{id}/start-review/` - Start screening session
- `POST /api/v1/review/reviews/{id}/approve/` - Approve session
- `POST /api/v1/review/reviews/{id}/reject/` - Reject session
- `POST /api/v1/review/reviews/{id}/annotations/` - Save canvas drawing annotations
- `POST /api/v1/review/reviews/{id}/comments/` - Add frame-accurate comment
- `GET /api/v1/review/playlists/` - List playlists
- `POST /api/v1/review/playlists/{id}/add-entry/` - Add version to playlist
- `POST /api/v1/review/playlists/{id}/share/` - Generate client screening link with passcode

---

## 6. Pipeline & Versions (`/api/v1/pipe/`)

- `GET /api/v1/pipe/versions/` - List published versions
- `POST /api/v1/pipe/versions/` - Publish new version
- `POST /api/v1/pipe/versions/{id}/promote/` - Promote to Hero Master
- `GET /api/v1/pipe/media/` - List transcoded media proxies
- `GET /api/v1/pipe/publishing/` - List DCC publish validations
- `POST /api/v1/pipe/publishing/{id}/validate/` - Trigger validation preflight

---

## 7. Deliveries (`/api/v1/out/`)

- `GET /api/v1/out/deliveries/` - List client turnover packages
- `POST /api/v1/out/deliveries/` - Create delivery package
- `POST /api/v1/out/deliveries/{id}/validate/` - Validate package manifest & checksums
- `POST /api/v1/out/deliveries/{id}/prepare/` - Prepare archive packages
- `POST /api/v1/out/deliveries/{id}/submit/` - Dispatch to Aspera/S3 dropzone
- `POST /api/v1/out/deliveries/{id}/approve/` - Client sign-off
- `POST /api/v1/out/deliveries/{id}/complete/` - Mark turnover completed

---

## 8. Automation, Analytics, Audit & Settings

- `GET /api/v1/auto/rules/` - List automation rules
- `POST /api/v1/auto/rules/{id}/toggle/` - Toggle active state
- `GET /api/v1/analytics/kpis/` - High-level production metrics
- `GET /api/v1/analytics/departments/` - Department completion stats
- `GET /api/v1/audit/` - List audit logs
- `GET /api/v1/settings/pipeline/` - Get studio OCIO, naming conventions & storage roots
- `PATCH /api/v1/settings/pipeline/` - Update pipeline settings
