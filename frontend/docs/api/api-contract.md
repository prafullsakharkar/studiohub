# StudioHub REST API Contract Specification

## 1. Global Request & Response Standards

### 1.1 Base URL & Versioning
All API endpoints are versioned and mounted under the `/api/v1/` prefix:
```
https://api.studiohub.vfx/api/v1/
```

### 1.2 Required Headers
| Header | Required | Example | Description |
| :--- | :--- | :--- | :--- |
| `Authorization` | Yes (except public auth) | `Bearer eyJhbGciOi...` | JWT Access Token |
| `X-Organization-Id` | Yes (tenant scoped) | `org-apex-01` | Active studio tenant context |
| `Content-Type` | Yes (for POST/PATCH/PUT) | `application/json` | Request payload format |
| `Accept` | Optional | `application/json` | Desired response format |

### 1.3 Standard DRF Pagination Structure
All list endpoints return standard DRF `PageNumberPagination` envelopes:
```json
{
  "count": 128,
  "next": "https://api.studiohub.vfx/api/v1/shots/?page=2&page_size=20",
  "previous": null,
  "results": [ /* Entity items */ ]
}
```

---

## 2. Authentication & Identity Endpoints (`/api/v1/auth/`)

### 2.1 User Login
- **Endpoint**: `POST /api/v1/auth/login/`
- **Auth Required**: No (Public)
- **Request Body**:
```json
{
  "email": "supervisor@studiohub.vfx",
  "password": "password123"
}
```
- **Response (200 OK)**:
```json
{
  "tokens": {
    "access": "jwt_acc_usr-001_1724660000000",
    "refresh": "jwt_ref_usr-001_1724660000000"
  },
  "user": {
    "id": "usr-001",
    "email": "supervisor@studiohub.vfx",
    "first_name": "Alex",
    "last_name": "Chen",
    "name": "Alex Chen",
    "role": "SUPERVISOR",
    "system_role": "ORGANIZATION_ADMIN",
    "avatar_url": "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150",
    "organization_id": "org-apex-01",
    "organization_name": "Apex VFX Studios",
    "department_id": "dept-005",
    "department_name": "VFX & Compositing",
    "title": "Head VFX Supervisor",
    "status": "Active"
  }
}
```
- **Error Responses**:
  - `400 Bad Request`: `{"detail": "Invalid credentials."}`
  - `401 Unauthorized`: `{"detail": "No active account found with the given email."}`

### 2.2 Refresh Access Token
- **Endpoint**: `POST /api/v1/auth/refresh/`
- **Auth Required**: No
- **Request Body**:
```json
{
  "refresh": "jwt_ref_usr-001_1724660000000"
}
```
- **Response (200 OK)**:
```json
{
  "access": "jwt_acc_refreshed_1724660100000"
}
```

### 2.3 Logout
- **Endpoint**: `POST /api/v1/auth/logout/`
- **Auth Required**: Yes
- **Request Body**:
```json
{
  "refresh": "jwt_ref_usr-001_1724660000000"
}
```
- **Response (200 OK)**:
```json
{
  "detail": "Successfully logged out."
}
```

### 2.4 Get Current User Profile
- **Endpoint**: `GET /api/v1/auth/me/`
- **Auth Required**: Yes
- **Response (200 OK)**: Returns the current authenticated `User` object.

---

## 3. Organization Management Endpoints

### 3.1 Organizations (`/api/v1/organizations/`)
- `GET /api/v1/organizations/`: List user organizations.
- `GET /api/v1/organizations/{id}/`: Retrieve organization details.
- `PATCH /api/v1/organizations/{id}/`: Update organization settings and metadata.

### 3.2 Clients (`/api/v1/clients/`)
- `GET /api/v1/clients/`: List studio clients (Supports `search`, `status`, `page`, `page_size`).
- `POST /api/v1/clients/`: Create client record.
  ```json
  {
    "name": "Warner Nexus Studios",
    "code": "WARNER",
    "status": "Active",
    "primary_contact_name": "Sarah Miller",
    "primary_contact_email": "s.miller@warner.com",
    "primary_contact_phone": "+1-555-0199",
    "billing_address": "Burbank, CA",
    "portal_access_enabled": true
  }
  ```
- `GET /api/v1/clients/{id}/`: Retrieve client profile.
- `PATCH /api/v1/clients/{id}/`: Update client details.
- `DELETE /api/v1/clients/{id}/`: Archive/Delete client (204 No Content).

### 3.3 Vendors & Partner Studios (`/api/v1/vendors/`)
- `GET /api/v1/vendors/`: List outsourced vendor studios.
- `POST /api/v1/vendors/`: Register vendor partner studio.
- `GET /api/v1/vendors/{id}/`: Retrieve vendor record.
- `PATCH /api/v1/vendors/{id}/`: Update vendor profile, NDA status, or capacity.
- `DELETE /api/v1/vendors/{id}/`: Remove/Archive vendor.

### 3.4 People & Crew Members (`/api/v1/people/`)
- `GET /api/v1/people/`: List studio crew (Supports `search`, `department_id`, `team_id`, `role`, `status`).
- `POST /api/v1/people/`: Add crew member.
  ```json
  {
    "first_name": "Elena",
    "last_name": "Rostova",
    "email": "elena.r@apexvfx.com",
    "role": "FX Lead Artist",
    "system_role": "CREW_MEMBER",
    "department_id": "dept-005",
    "team_id": "team-001",
    "office_id": "off-001",
    "hourly_rate_usd": 95.00,
    "status": "Active"
  }
  ```
- `GET /api/v1/people/{id}/`: Retrieve crew member profile.
- `PATCH /api/v1/people/{id}/`: Update crew profile.
- `DELETE /api/v1/people/{id}/`: Deactivate crew member.

### 3.5 Departments (`/api/v1/departments/`)
- `GET /api/v1/departments/`: List studio departments (e.g. Asset Modeling, Layout, FX, Lighting, Comp).
- `POST /api/v1/departments/`: Create department.
- `GET /api/v1/departments/{id}/`: Retrieve department with lead info and headcounts.
- `PATCH /api/v1/departments/{id}/`: Update department details.
- `DELETE /api/v1/departments/{id}/`: Remove department.

### 3.6 Teams (`/api/v1/teams/`)
- `GET /api/v1/teams/`: List production teams.
- `POST /api/v1/teams/`: Create team unit.
- `GET /api/v1/teams/{id}/`: Retrieve team roster.
- `PATCH /api/v1/teams/{id}/`: Update team details.
- `DELETE /api/v1/teams/{id}/`: Remove team.

### 3.7 Offices & Physical Locations (`/api/v1/offices/`)
- `GET /api/v1/offices/`: List studio locations (Vancouver, London, Montreal, Tokyo).
- `POST /api/v1/offices/`: Register office facility.
- `GET /api/v1/offices/{id}/`: Retrieve office info.
- `PATCH /api/v1/offices/{id}/`: Update office config.
- `DELETE /api/v1/offices/{id}/`: Remove office.

---

## 4. Production Domain Endpoints

### 4.1 Projects (`/api/v1/projects/`)
- `GET /api/v1/projects/`: List projects with progress metrics and filters (`search`, `status`, `type`, `client_id`).
- `POST /api/v1/projects/`: Create production project.
  ```json
  {
    "name": "Cyberpunk 2099: Neo-Kyoto",
    "code": "NK99",
    "type": "Feature Film",
    "status": "In Progress",
    "description": "High-end sci-fi VFX feature.",
    "fps": 24,
    "resolution": "4096x2160 (4K DCI)",
    "aspect_ratio": "2.39:1",
    "color_space": "ACEScg",
    "start_date": "2026-01-10",
    "delivery_date": "2026-12-15",
    "supervisor_id": "usr-001",
    "coordinator_id": "usr-002",
    "client_id": "cl-001",
    "budget_usd": 3500000.00
  }
  ```
- `GET /api/v1/projects/{id}/`: Retrieve project master record.
- `PATCH /api/v1/projects/{id}/`: Update project metadata or milestone dates.
- `DELETE /api/v1/projects/{id}/`: Archive project.

### 4.2 Sequences & Shots (`/api/v1/shots/`)
- `GET /api/v1/shots/`: List shots with pipeline stage flags (`project_id`, `sequence_code`, `status`, `assigned_artist_id`, `search`).
- `POST /api/v1/shots/`: Create shot entity.
  ```json
  {
    "project_id": "proj-001",
    "sequence_code": "NK_010",
    "code": "NK_010_010",
    "name": "Hero Spinner Dive Through Neon Canyon",
    "description": "Vehicle dives between megatowers.",
    "status": "In Progress",
    "frame_in": 1001,
    "frame_out": 1144,
    "handle_frames": 8,
    "assigned_artist_id": "usr-003",
    "assigned_artist_name": "Elena Rostova"
  }
  ```
- `GET /api/v1/shots/{id}/`: Retrieve shot detail with versions, tasks, and media.
- `PATCH /api/v1/shots/{id}/`: Update shot metadata, cut lengths, or pipeline statuses.
- `DELETE /api/v1/shots/{id}/`: Delete shot.
- `POST /api/v1/shots/{id}/approve/`: One-click supervisor shot approval (sets status to `Approved` and flags pipeline stages).

### 4.3 Asset Catalog (`/api/v1/assets/`)
- `GET /api/v1/assets/`: List assets (`project_id`, `category`, `status`, `department_id`, `search`).
- `POST /api/v1/assets/`: Register asset.
  ```json
  {
    "project_id": "proj-001",
    "name": "Spinner Police Cruiser",
    "code": "AST_SPINNER_01",
    "category": "Vehicle",
    "description": "Hero flying enforcement cruiser with interior rig.",
    "status": "In Progress",
    "file_format": "OpenUSD (.usda / .usdc)",
    "poly_count": 850000,
    "lod_levels": 4,
    "assigned_artist_id": "usr-004",
    "department_id": "dept-002",
    "team_id": "team-002",
    "software": "Maya / Houdini",
    "tags": ["Hero", "Vehicle", "OpenUSD"]
  }
  ```
- `GET /api/v1/assets/{id}/`: Retrieve asset detail.
- `PATCH /api/v1/assets/{id}/`: Update asset metadata.
- `DELETE /api/v1/assets/{id}/`: Delete asset.

---

## 5. Tasks, Timelogs, & Scheduling Endpoints

### 5.1 Tasks (`/api/v1/tasks/`)
- `GET /api/v1/tasks/`: List tasks with extensive filtering (`project_id`, `entity_type`, `entity_id`, `department`, `team_id`, `assignee_id`, `vendor_id`, `status`, `priority`, `is_archived`, `search`).
- `POST /api/v1/tasks/`: Create production task.
- `GET /api/v1/tasks/{id}/`: Retrieve task detail.
- `PATCH /api/v1/tasks/{id}/`: Update task (schedule, hours, progress, assignee).
- `DELETE /api/v1/tasks/{id}/`: Delete task.
- `POST /api/v1/tasks/bulk-assign/`: Assign multiple tasks to an artist or team in a single batch request.
  ```json
  {
    "task_ids": ["task-101", "task-102"],
    "assignee_id": "usr-003",
    "assignee_name": "Elena Rostova",
    "team_id": "team-001",
    "team_name": "Alpha FX Squad"
  }
  ```
- `POST /api/v1/tasks/bulk-status/`: Bulk change status for selected task IDs.
- `POST /api/v1/tasks/bulk-archive/`: Bulk archive/unarchive tasks.
- `POST /api/v1/tasks/bulk-delete/`: Bulk delete tasks.

### 5.2 Timelogs (`/api/v1/timelogs/`)
- `GET /api/v1/timelogs/`: Query logged crew hours (`task_id`, `person_id`, `project_id`, `status`, `billable`, `start_date`, `end_date`, `search`).
- `POST /api/v1/timelogs/`: Log working hours.
  ```json
  {
    "task_id": "task-001",
    "duration_hours": 4.5,
    "date": "2026-08-26",
    "billable": true,
    "activity_category": "Direct Work",
    "notes": "Completed explosion secondary sparks pass in Houdini."
  }
  ```
- `GET /api/v1/timelogs/{id}/`: Retrieve timelog entry.
- `PATCH /api/v1/timelogs/{id}/`: Edit timelog record.
- `DELETE /api/v1/timelogs/{id}/`: Delete timelog entry.
- `POST /api/v1/timelogs/{id}/approve/`: Approve submitted crew timelog.
- `POST /api/v1/timelogs/{id}/reject/`: Reject timelog with feedback reason.

### 5.3 Scheduling & Resource Management (`/api/v1/scheduling/`)
- `GET /api/v1/scheduling/resources/`: List bookable crew resources with workload capacity.
- `GET /api/v1/scheduling/events/`: List calendar timeline events and milestone deadlines.
- `POST /api/v1/scheduling/events/`: Create or adjust milestone/calendar event.
- `GET /api/v1/scheduling/leaves/`: Query crew vacations and leaves.
- `POST /api/v1/scheduling/leaves/`: Submit crew leave request.
- `GET /api/v1/scheduling/alerts/`: Query overbooking capacity conflict alerts.
- `GET /api/v1/scheduling/capacity/`: Get department-level aggregate capacity analytics.

---

## 6. Review Sessions & Screening Endpoints (`/api/v1/reviews/`)

### 6.1 Review Sessions
- `GET /api/v1/reviews/`: List review sessions (`project_id`, `entity_code`, `status`, `client_only`, `search`).
- `POST /api/v1/reviews/`: Create new review screening room.
- `GET /api/v1/reviews/{id}/`: Retrieve session with versions, annotations, frame comments, and activity logs.
- `POST /api/v1/reviews/{id}/submit/`: Submit draft review to supervisor screening queue.
- `POST /api/v1/reviews/{id}/start-review/`: Transition session status to `In Review`.
- `POST /api/v1/reviews/{id}/approve/`: Set review status to `Approved`.
- `POST /api/v1/reviews/{id}/reject/`: Set review status to `Rejected` (Retake).
- `POST /api/v1/reviews/{id}/request-changes/`: Mark session with changes requested.
- `POST /api/v1/reviews/{id}/close/`: Close and archive review session.
- `POST /api/v1/reviews/{id}/verdict/`: Record supervisor/client verdict and notes.

### 6.2 Frame Annotations & Comments
- `POST /api/v1/reviews/{id}/annotations/`: Add visual drawing canvas annotation to a specific frame.
  ```json
  {
    "frame_number": 1042,
    "timecode": "01:00:01:18",
    "author_name": "Alex Chen",
    "comment": "Adjust glow falloff around front canopy edges.",
    "drawing_coordinates": {
      "strokes": [[120, 240], [135, 260], [180, 290]],
      "color": "#ef4444",
      "stroke_width": 3
    }
  }
  ```
- `POST /api/v1/reviews/{id}/comments/`: Add frame-specific critique comment.
- `POST /api/v1/reviews/{id}/comments/{commentId}/resolve/`: Resolve action item comment.
- `POST /api/v1/reviews/{id}/comments/{commentId}/reopen/`: Reopen previously resolved comment.
- `POST /api/v1/reviews/{id}/notes/`: Add general review session note.

---

## 7. Versions, Media, & Playlists Endpoints

### 7.1 Published Versions (`/api/v1/versions/`)
- `GET /api/v1/versions/`: List published pipeline versions (`project_id`, `entity_type`, `entity_code`, `status`, `department`, `search`).
- `POST /api/v1/versions/`: Register new published iteration.
- `GET /api/v1/versions/{id}/`: Retrieve version detail with USD paths and technical metadata.
- `PATCH /api/v1/versions/{id}/`: Update version record.
- `POST /api/v1/versions/{id}/promote/`: Promote version to Hero Master.
- `DELETE /api/v1/versions/{id}/`: Deprecate/Delete version.

### 7.2 Media Assets & Dailies (`/api/v1/media/`)
- `GET /api/v1/media/`: List transcoded media clips and reviewable proxies.
- `POST /api/v1/media/`: Upload / Register media proxy.
- `GET /api/v1/media/{id}/`: Retrieve media playback metadata (LUTs, audio channels, bitrates).
- `DELETE /api/v1/media/{id}/`: Remove media file.

### 7.3 Production Attachments (`/api/v1/attachments/`)
- `GET /api/v1/attachments/`: List attached reference files, PDF briefs, and concept art.
- `POST /api/v1/attachments/`: Upload attachment file (multipart/form-data or S3 presigned URL).
- `DELETE /api/v1/attachments/{id}/`: Remove attachment.

### 7.4 Playlists & Screening Reels (`/api/v1/playlists/`)
- `GET /api/v1/playlists/`: List playlists (`project_id`, `is_archived`, `search`).
- `POST /api/v1/playlists/`: Create playlist reel.
- `GET /api/v1/playlists/{id}/`: Retrieve playlist with ordered item sequence.
- `PATCH /api/v1/playlists/{id}/`: Update playlist title, description, or tags.
- `POST /api/v1/playlists/{id}/add-entry/`: Append version to playlist.
- `POST /api/v1/playlists/{id}/remove-entry/`: Remove entry from playlist.
- `POST /api/v1/playlists/{id}/reorder/`: Update sequence ordering of playlist entries.
- `POST /api/v1/playlists/{id}/share/`: Generate secure client sharing link and passcode permissions.
- `POST /api/v1/playlists/{id}/archive/`: Archive playlist.
- `POST /api/v1/playlists/{id}/restore/`: Restore archived playlist.

---

## 8. Workflow Automation, Analytics, & Settings Endpoints

### 8.1 Workflows & Automation Rules (`/api/v1/workflows/`)
- `GET /api/v1/workflows/`: List pipeline workflow DAG templates.
- `POST /api/v1/workflows/`: Create workflow graph.
- `GET /api/v1/workflows/rules/`: List automated trigger-action rules.
- `POST /api/v1/workflows/rules/`: Create automation rule (e.g. *When Version Approved → Publish OpenUSD Layer*).
- `POST /api/v1/workflows/rules/{id}/toggle/`: Enable/Disable automation rule.
- `POST /api/v1/workflows/dry-run/`: Test dry-run execution of an automation rule against live entity states.
- `GET /api/v1/workflows/audit/`: Query automation execution audit logs.

### 8.2 Analytics & KPIs (`/api/v1/analytics/`)
- `GET /api/v1/analytics/kpis/`: Get high-level studio production KPIs (burn rates, shot completion percentages, on-time delivery ratios).
- `GET /api/v1/analytics/departments/`: Get departmental progress breakdowns and bottleneck analysis.

### 8.3 Audit Trail (`/api/v1/audit/`)
- `GET /api/v1/audit/`: List immutable studio audit log records (`user_id`, `action`, `entity_type`, `search`, pagination).
- `POST /api/v1/audit/`: Record structured audit event.

### 8.4 Pipeline Settings (`/api/v1/settings/`)
- `GET /api/v1/settings/pipeline/`: Get global pipeline configurations (naming conventions, OCIO color profiles, frame rate defaults, storage roots).
- `PATCH /api/v1/settings/pipeline/`: Update studio pipeline configuration.

---

## 9. Delivery Turnover & Publishing Endpoints

### 9.1 Client Deliveries (`/api/v1/deliveries/`)
- `GET /api/v1/deliveries/`: List turnover delivery packages.
- `POST /api/v1/deliveries/`: Create turnover package.
- `GET /api/v1/deliveries/{id}/`: Retrieve package manifest with QC verification checks.
- `POST /api/v1/deliveries/{id}/validate/`: Run automated QC pre-flight validation rules.
- `POST /api/v1/deliveries/{id}/prepare/`: Generate XML/EDL delivery manifests and checksums.
- `POST /api/v1/deliveries/{id}/submit/`: Dispatch package to client destination (Aspera, S3, FTP).
- `POST /api/v1/deliveries/{id}/approve/`: Record client approval of turnover package.
- `POST /api/v1/deliveries/{id}/reject/`: Record client rejection with feedback notes.
- `POST /api/v1/deliveries/{id}/retry/`: Re-prepare rejected package with updated elements.
- `POST /api/v1/deliveries/{id}/complete/`: Mark delivery officially complete and archived.
- `POST /api/v1/deliveries/{id}/cancel/`: Cancel active delivery package.
- `POST /api/v1/deliveries/{id}/add-version/`: Add shot/asset version to turnover manifest.
- `POST /api/v1/deliveries/{id}/remove-version/`: Remove version from manifest.

### 9.2 Pipeline Publishing (`/api/v1/publishing/`)
- `GET /api/v1/publishing/`: List DCC publish items and exports.
- `POST /api/v1/publishing/`: Submit publish from DCC (Nuke, Maya, Houdini, Blender).
- `GET /api/v1/publishing/{id}/`: Retrieve publish details and validation logs.
- `POST /api/v1/publishing/{id}/validate/`: Re-validate pre-flight rules.
- `POST /api/v1/publishing/{id}/republish/`: Create new iteration increment (e.g. v001 → v002).
- `POST /api/v1/publishing/{id}/unpublish/`: Deprecate and unlink published asset.
- `POST /api/v1/publishing/{id}/retry/`: Re-trigger failed publish export.
