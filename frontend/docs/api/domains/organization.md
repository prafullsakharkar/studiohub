# Organization Domain API Specification (`apps.organization`)

## 1. Domain Overview
The `organization` application manages studio tenant profiles, external partner clients, vendor studios, crew members, studio departments, production teams, and physical studio facilities.

---

## 2. Models & Data Structures

| Model Name | Table | Description |
| :--- | :--- | :--- |
| `Organization` | `org_organization` | Studio tenant entity holding branding, subscription plan, and slug. |
| `Client` | `org_client` | External production studio client (e.g. Warner, Disney, Netflix). |
| `Vendor` | `org_vendor` | Outsourced vendor studio partner. |
| `Person` | `org_person` | Studio crew member record linked to user account and department. |
| `Department` | `org_department` | Discipline department (Modeling, Rigging, FX, Lighting, Comp). |
| `Team` | `org_team` | Operational crew squad/team. |
| `Office` | `org_office` | Physical studio facility / campus. |

---

## 3. Endpoints

### 3.1 Clients (`/api/v1/clients/`)
- `GET /api/v1/clients/`: Returns paginated list of studio clients.
- `POST /api/v1/clients/`: Creates client entity with billing details.
- `GET /api/v1/clients/{id}/`: Retrieves single client profile.
- `PATCH /api/v1/clients/{id}/`: Partial update of client metadata.
- `DELETE /api/v1/clients/{id}/`: Soft-deletes client record (`204 No Content`).

### 3.2 Vendors (`/api/v1/vendors/`)
- Standard DRF ViewSet providing `GET`, `POST`, `GET {id}`, `PATCH`, and `DELETE`.

### 3.3 People / Crew (`/api/v1/people/`)
- Standard DRF ViewSet with filtering by `department_id`, `team_id`, `role`, `status`, and `search`.

### 3.4 Departments (`/api/v1/departments/`)
- Lists and manages studio departments with associated lead artist references and headcounts.

### 3.5 Teams & Offices
- Standard ViewSets for `/api/v1/teams/` and `/api/v1/offices/`.
