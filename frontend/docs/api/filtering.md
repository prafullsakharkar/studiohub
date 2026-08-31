# StudioHub Filtering & Sorting Specification

## 1. Query Parameter Filtering

StudioHub uses `django-filter` (`DjangoFilterBackend`) and `OrderingFilter` for standardized query operations.

### 1.1 Common Entity Filters
| Query Parameter | Example | Operator / Logic | Target Entities |
| :--- | :--- | :--- | :--- |
| `project_id` | `?project_id=proj-001` | Exact UUID match | Shots, Assets, Tasks, Reviews, Versions |
| `status` | `?status=In%20Progress` | Exact / In-list match | Shots, Tasks, Reviews, Assets, Deliveries |
| `department_id` | `?department_id=dept-005` | ForeignKey match | Tasks, People, Assets |
| `assigned_artist_id` | `?assigned_artist_id=usr-003` | ForeignKey match | Shots, Tasks |
| `is_archived` | `?is_archived=false` | Boolean match | Tasks, Playlists, Projects |
| `date_from` | `?date_from=2026-08-01` | `gte` (Date) | Timelogs, Scheduling, Audit Logs |
| `date_to` | `?date_to=2026-08-31` | `lte` (Date) | Timelogs, Scheduling, Audit Logs |

### 1.2 Multi-Value In-List Filtering
Filter sets accept comma-separated lists for bulk status queries:
```
GET /api/v1/tasks/?status=In%20Progress,Ready%20for%20Review,Blocked
```

---

## 2. Ordering & Sorting Specification

Sorting uses DRF's `ordering` parameter:
```
GET /api/v1/shots/?ordering=-created_at
GET /api/v1/tasks/?ordering=due_date,priority
```
- Prefix `-` denotes descending order.
- Commas delimit secondary sort fields.
