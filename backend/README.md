# StudioHub Backend

Django + DRF backend for StudioHub.

## Frontend ↔ Backend wiring status

The Vite frontend calls the backend through `src/api/client/ApiClient.ts` (base URL from
`VITE_API_URL`). Modules wired to real, DB-backed Django viewsets:

| Module | Backend endpoint | Status |
| ------ | ---------------- | ------ |
| Settings | `/settings/system-settings/` | Real (seeded) |
| Data Platform (Shots/Tasks/Projects) | `/production/…` | Real (seeded) |
| Users | `/identity/users/` | Real |
| Roles | `/organization/roles/` | Real |
| Deliveries | `/deliveries/` | Real (seeded) |
| Publishing | `/publishing/` | Real (seeded) |
| Production (Projects/Shots/Assets/Tasks/Timelogs/Versions/Reviews/Media/Playlists/Workflows) | `/api/v1/projects|shots|assets|…` | Real (seeded) |
| Organization (Clients/Vendors/Departments/Teams/Offices/Organizations/People) | `/api/v1/clients|vendors|people|…` | Real (seeded) |
| Scheduling | `/api/v1/scheduling/…` | Real |
| Dashboard | `/api/v1/analytics/kpis/` | Real |
| Audit | `/api/v1/audit/…` | Real |
| Billing / Reports / Notifications | via `organizationApi` | Real |

### Intelligence (AI, Search, Knowledge, Analytics)

Mounted under `/intelligence/` but currently **intentional stubs** — not DB-backed:

- `search/` returns empty results (the real index would be Elasticsearch).
- `knowledge/`, `ai/*` serve hardcoded in-memory mock arrays.
- `analytics/<domain>/` returns a minimal fixed object.

Because of this, the frontend keeps its existing in-memory mock services for these pages.
Rewiring them to the stubs would regress the UI (e.g. search would degrade from a rich local
index to empty). These endpoints are the intended place to implement real behavior later.

### Automations & Integrations

No backend app exists for these modules. The frontend uses mock services only.
