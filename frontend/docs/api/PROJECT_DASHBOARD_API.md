# StudioHub Project Dashboard API Specification

## Endpoints

### 1. GET `/api/v1/projects/{projectId}/dashboard/`
Retrieves consolidated, strictly-scoped project dashboard metrics and telemetry.

#### Headers
- `Authorization: Bearer <token>`
- `X-Organization-Id: <organizationId>` (optional, defaults to active tenant)

#### URL Parameters
- `projectId` (string, required): The UUID or unique code of the target project (e.g., `proj-001` or `NK99`).

#### Response: `200 OK`
```json
{
  "project": {
    "id": "proj-001",
    "organization_id": "org-apex-01",
    "name": "Cyberpunk 2099: Neo-Kyoto",
    "code": "NK99",
    "type": "Feature Film VFX",
    "description": "Hero police spinner dives vertically through dense holographic billboards",
    "status": "In Progress",
    "fps": 24,
    "resolution": "4096x2160 (4K DCI)",
    "aspect_ratio": "2.39:1",
    "color_space": "ACEScg 1.3",
    "start_date": "2026-01-15",
    "delivery_date": "2026-11-30",
    "client_name": "Warner Bros Pictures",
    "supervisor_name": "Marcus Vance"
  },
  "summary": {
    "total_shots": 148,
    "approved_shots": 82,
    "in_progress_shots": 45,
    "shots_at_risk": 3,
    "shots_completion_pct": 55,
    "total_tasks": 310,
    "open_tasks": 40,
    "in_progress_tasks": 120,
    "completed_tasks": 150,
    "overdue_tasks": 4,
    "tasks_completion_pct": 48,
    "total_assets": 95,
    "in_progress_assets": 20,
    "approved_assets": 70,
    "needs_revision_assets": 5,
    "pending_reviews": 8,
    "approved_reviews": 24,
    "changes_requested_reviews": 2,
    "upcoming_deliveries": 3,
    "delivered_deliveries": 12,
    "late_deliveries": 0
  },
  "production": {
    "overall_progress_pct": 52,
    "completed_shots": 82,
    "in_progress_shots": 45,
    "not_started_shots": 21,
    "status_breakdown": [
      { "status": "Approved", "count": 82, "percentage": 55 },
      { "status": "In Progress", "count": 45, "percentage": 30 },
      { "status": "Not Started", "count": 21, "percentage": 15 }
    ],
    "methodology_note": "Weighted aggregate: 60% Approved Shots + 40% Completed Tasks"
  },
  "shots": { ... },
  "tasks": { ... },
  "reviews": { ... },
  "schedule": { ... },
  "workload": { ... },
  "deliveries": { ... },
  "activity": [ ... ]
}
```

#### Error Responses
- `401 Unauthorized`: Missing or invalid authentication token.
- `403 Forbidden`: User does not possess permission to access the specified project.
- `404 Not Found`: Project with ID or code `{projectId}` does not exist.

---

### 2. GET `/api/organizations/{organizationId}/projects/{projectId}/dashboard`
Organization-scoped alternative endpoint providing the exact same telemetry payload, enforcing explicit organizational multi-tenancy verification.
