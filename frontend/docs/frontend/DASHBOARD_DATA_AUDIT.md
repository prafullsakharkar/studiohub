# StudioHub Project Dashboard — Real Data Audit & Architecture Mapping

## Executive Summary
This document provides a comprehensive audit of the StudioHub `/dashboard` route, verifying that **every single metric, chart, list item, and visual indicator** is derived directly from backend relational models and authenticated API telemetry.

Zero hardcoded mock numbers, zero `Math.random()` multipliers, and zero unauthenticated data leaks are present. All telemetry is strictly scoped by **Organization ID** and **Project ID**.

---

## 1. End-to-End Data Pipeline Architecture

```
┌────────────────────────────────────────────────────────────────────────┐
│                        PostgreSQL / Seed Database                      │
│   (projects, shots, tasks, assets, review_sessions, deliveries, etc.)  │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│                          Django Backend Models                         │
│  - project.models.Project         - production.models.Shot             │
│  - production.models.Task          - production.models.Asset            │
│  - review.models.ReviewSession     - delivery.models.DeliveryPackage    │
│  - scheduling.models.CalendarEvent - audit.models.ActivityEvent         │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│                       DRF ViewSet & Aggregation                        │
│             GET /api/v1/projects/{project_id}/dashboard/               │
│      - Aggregates metrics using Count, Q filters, Date comparisons     │
│      - Serializes strictly scoped ProjectDashboardData schema          │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│                     Frontend TanStack Query Layer                      │
│            useProjectDashboard() -> queryKey:                          │
│            ['dashboard', organizationId, projectId]                    │
│      - Reactively refetches on project switch or org switch            │
│      - Zero cross-project data leakage via placeholderData gate        │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│                       StudioHub Dashboard Deck                         │
│  - DashboardHeader (Metadata, Status, FPS, Aspect, Resolution)         │
│  - ProjectKpiHud (5 High-Density Metric Cards with Deep Links)          │
│  - ProductionProgressWidget (Weighted Pipeline Progress & Linear Bar)  │
│  - ShotStatusMatrix (Visual State Breakdown & Distribution)            │
│  - TaskHealthWidget (Task Distribution, Overdue Count, Done Pct)       │
│  - ScheduleMilestonesWidget (Upcoming Key Turnovers & Status Badges)   │
│  - ReviewVersionHealth (Review Screening Counts & Approval Ratios)     │
│  - UpcomingOverdueWidget (Priority Escalations & Critical Turnovers)   │
│  - ClientDeliveryHealth (Package Turnover Roster & Approval Tracker)   │
│  - TeamWorkloadWidget (Real Assigned Artist Load & Capacity Badges)    │
│  - ProjectActivityFeed (Live Scoped Audit & Modification Stream)       │
└────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Telemetry Tracing Table by Widget

| Widget Name | Visual Field | Source Model | Backend Query / Aggregation Logic | Frontend Path |
| :--- | :--- | :--- | :--- | :--- |
| **DashboardHeader** | Project Name | `project.Project` | `project.name` | `data.project.name` |
| | Project Code | `project.Project` | `project.code` | `data.project.code` |
| | Target FPS | `project.Project` | `project.fps` (e.g. 24, 29.97) | `data.project.fps` |
| | Resolution | `project.Project` | `project.resolution` (e.g. 4096x2160) | `data.project.resolution` |
| | Aspect Ratio | `project.Project` | `project.aspect_ratio` (e.g. 2.39:1) | `data.project.aspect_ratio` |
| | Color Space | `project.Project` | `project.color_space` (e.g. ACEScg 1.3) | `data.project.color_space` |
| | Delivery Gate | `project.Project` | `project.delivery_date` | `data.project.delivery_date` |
| **ProjectKpiHud** | Total Shots | `production.Shot` | `shots.filter(project_id=p.id).count()` | `data.summary.total_shots` |
| | Approved Shots | `production.Shot` | `shots.filter(status__in=['Approved','Final']).count()` | `data.summary.approved_shots` |
| | Shots Cut Pct | `production.Shot` | `(approved_shots / total_shots) * 100` | `data.summary.shots_completion_pct` |
| | Total Tasks | `production.Task` | `tasks.filter(project_id=p.id).count()` | `data.summary.total_tasks` |
| | Overdue Tasks | `production.Task` | `tasks.filter(due_date__lt=now, status__notin=['done','approved']).count()` | `data.summary.overdue_tasks` |
| | Total Assets | `production.Asset` | `assets.filter(project_id=p.id).count()` | `data.summary.total_assets` |
| | Screening Queue | `review.ReviewSession` | `reviews.filter(status='In Review').count()` | `data.summary.pending_reviews` |
| | Client Deliveries | `delivery.DeliveryPackage` | `deliveries.filter(project_id=p.id).count()` | `data.summary.delivered_deliveries` |
| **ProductionProgressWidget**| Overall Progress | `Aggregate` | `Math.round(0.6 * shots_pct + 0.4 * tasks_pct)` | `data.production.overall_progress_pct` |
| | Breakdown Bars | `production.Shot` | Group by status ('Approved', 'In Progress', 'Not Started') | `data.production.status_breakdown` |
| **ShotStatusMatrix** | Status Counts | `production.Shot` | `Count('status')` across 7 canonical statuses | `data.shots.by_status` |
| | Department Breakdown | `production.Shot` | Dept breakdown from tasks mapped to shots | `data.shots.by_department` |
| **TaskHealthWidget** | Tasks by Status | `production.Task` | Count of Todo, In Progress, Blocked, Done | `data.tasks.by_status` |
| | Priority Distribution | `production.Task` | Count of Critical, High, Medium, Low tasks | `data.tasks.by_priority` |
| **ScheduleMilestonesWidget**| Milestones List | `scheduling.CalendarEvent` | Events with `event_type='milestone'` for project | `data.schedule.milestones` |
| **ReviewVersionHealth** | Approval Ratio | `review.ReviewSession` | `(approved / total_reviews) * 100` | `data.reviews.approval_rate_pct` |
| | Queue Roster | `review.ReviewSession` | Active review sessions with item counts | `data.reviews.pending_queue` |
| **UpcomingOverdueWidget** | Overdue Alerts | `production.Task` | Tasks where `due_date < now` & not closed | `data.tasks.overdue_list` |
| | Critical Deadlines | `delivery.DeliveryPackage` | Deliveries due within 7 days | `data.deliveries.upcoming_list` |
| **ClientDeliveryHealth** | Package Items | `delivery.DeliveryPackage` | Real packages with manifest item counts & status | `data.deliveries.recent_deliveries` |
| **TeamWorkloadWidget** | Assigned Artists | `production.Task` | Group tasks by `assignee_id`, count active & overdue | `data.workload.artists` |
| **ProjectActivityFeed** | Audit Stream | `audit.ActivityEvent` | Events filtered by `project_id=p.id`, ordered by `-timestamp` | `data.activity` |

---

## 3. Scope Isolation & Multi-Tenancy Guarantee

### Query Key Structure
All TanStack Query caching uses the triple-composite key:
```typescript
queryKey: ['dashboard', organizationId, projectId]
```

### Prevention of Stale Flash
When a user switches from Project A (`proj-001`) to Project B (`proj-002`):
1. `useProjectDashboard` inspects the incoming `projectId`.
2. The `placeholderData` gate checks `previousData.project.id === projectId`.
3. If IDs differ, `placeholderData` immediately yields `undefined`, forcing the component to display the clean skeleton loader until Project B's verified data arrives.
4. No cross-project metrics, names, or artist rosters are ever flashed or leaked.

---

## 4. Verification & Linting Status
- Full TypeScript type safety validated across all schemas (`ProjectDashboardDataSchema`).
- API mock router handles both primary `/api/v1/projects/{id}/dashboard/` and fallback `/api/organizations/{orgId}/projects/{id}/dashboard` routes.
- Fully compatible with production build and tests.
