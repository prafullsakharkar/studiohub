# StudioHub Modules & Integration Matrix

## 1. Module Topography

StudioHub divides responsibility into cohesive, decoupled feature modules organized by domain boundaries:

```
src/modules/
├── auth/           # JWT Authentication, Role Personas, Session Tokens
├── organization/   # Multi-Studio Tenancy, Offices, Departments, Teams, People, Clients, Vendors
├── production/     # Productions & Projects Master Hierarchy
├── shots/          # Shot Grid, Sequences, Frame In/Out, Cut Trims
├── assets/         # OpenUSD Assets, Categorization, Geometry LODs
├── tasks/          # Discipline Board, Workflows, Software Hooks
├── versions/       # Render Versions, Publish History, USD Layers
├── reviews/        # Screening Room, Synchronized Dailies, A/B Wipe
├── platform/       # Notifications, Analytics, Milestone Reports, Billing
├── audit/          # Compliance Audit Trail, DRF Change Logs
├── settings/       # OCIO Color Management, Pipeline Configuration
└── dashboard/      # Studio Operations Center, Farm HUD, KPIs
```

---

## 2. Cross-Module Navigation & Dependency Matrix

| Source Module | Related Module | Interaction Pattern |
|---|---|---|
| **Organization** | **Clients** | Organization owns client contracts & portal permissions |
| **Organization** | **Offices & People** | People are assigned to offices and discipline departments |
| **Clients** | **Projects** | Projects are commissioned by client entities |
| **Vendors** | **Tasks & Deliveries**| Vendors receive assigned outsourcing tasks and publish packages |
| **Projects** | **Shots & Assets** | Shots and assets belong to active project scope |
| **Shots** | **Versions & Reviews**| Shot versions feed directly into the Screening Room player |
| **Tasks** | **People & Vendors** | Tasks link assignees, discipline software, and logged hours |

---

## 3. API Contract Endpoints

- `GET /api/v1/organizations/` — List managed studio entities
- `GET /api/v1/clients/` — Client directory & project links
- `GET /api/v1/vendors/` — Outsourcing partner studios
- `GET /api/v1/people/` — Crew directory and talent status
- `GET /api/v1/departments/` — Studio craft departments
- `GET /api/v1/teams/` — Production squads and sequence leads
- `GET /api/v1/offices/` — Physical and virtual studio facilities
- `GET /api/v1/versions/` — Published caches and USD passes
- `GET /api/v1/notifications/` — Pipeline alerts and dailies mentions
- `GET /api/v1/analytics/` — Farm metrics, department velocity, and KPIs
- `GET /api/v1/billing/` — Compute credit usage, tier, and storage
