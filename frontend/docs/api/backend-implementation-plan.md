# StudioHub Backend Implementation Plan

## 1. Phased Implementation Sequence

To replace the MSW mock layer with a high-performance PostgreSQL/Django backend without downtime or breaking changes, implementation must proceed in 12 structured phases:

```
┌─────────────────────────────────────────────────────────────┐
│ 01. Core API Foundation (Base Models, TenantMiddleware, Err)│
└──────────────────────────────┬──────────────────────────────┘
                               ▼
┌─────────────────────────────────────────────────────────────┐
│ 02. Identity API (User, JWT Auth, Token Rotation, Profiles) │
└──────────────────────────────┬──────────────────────────────┘
                               ▼
┌─────────────────────────────────────────────────────────────┐
│ 03. Organization API (Orgs, Clients, Vendors, People, Teams)│
└──────────────────────────────┬──────────────────────────────┘
                               ▼
┌─────────────────────────────────────────────────────────────┐
│ 04. Production API (Projects, Sequences, Shots, Assets)     │
└──────────────────────────────┬──────────────────────────────┘
                               ▼
┌─────────────────────────────────────────────────────────────┐
│ 05. Task & Timelog API (Tasks, Bulk Operations, Timelogs)   │
└──────────────────────────────┬──────────────────────────────┘
                               ▼
┌─────────────────────────────────────────────────────────────┐
│ 06. Review & Playlists API (Screening, Annotations, Reels)  │
└──────────────────────────────┬──────────────────────────────┘
                               ▼
┌─────────────────────────────────────────────────────────────┐
│ 07. Pipeline & Publishing API (Versions, OpenUSD, DCC Pubs) │
└──────────────────────────────┬──────────────────────────────┘
                               ▼
┌─────────────────────────────────────────────────────────────┐
│ 08. Delivery & Turnover API (Packages, Checksums, Aspera/S3)│
└──────────────────────────────┬──────────────────────────────┘
                               ▼
┌─────────────────────────────────────────────────────────────┐
│ 09. Automation, Analytics, & Settings (Rules, KPIs, OCIO)   │
└──────────────────────────────┬──────────────────────────────┘
                               ▼
┌─────────────────────────────────────────────────────────────┐
│ 10. Seed Data Management Command (`python manage.py seed`)  │
└──────────────────────────────┬──────────────────────────────┘
                               ▼
┌─────────────────────────────────────────────────────────────┐
│ 11. Automated Contract Testing (MSW vs Django Response Diff)│
└──────────────────────────────┬──────────────────────────────┘
                               ▼
┌─────────────────────────────────────────────────────────────┐
│ 12. MSW to Live Backend Switch (`VITE_API_URL` Cutover)     │
└─────────────────────────────────────────────────────────────┘
```

---

## 2. Phase Breakdown & Deliverables

### Phase 01: Core API Foundation
- Implement `BaseModel` (UUID, created_at, updated_at, is_deleted, audit fields).
- Implement `TenantAwareModel` with PostgreSQL compound index `(organization_id, id)`.
- Configure `TenantMiddleware` to extract and validate `X-Organization-Id`.
- Implement `StandardResultsSetPagination` and `custom_exception_handler`.

### Phase 02: Identity API
- Custom `User` model with system roles (`SUPER_ADMIN`, `ORGANIZATION_ADMIN`, `SUPERVISOR`, `LEAD`, `ARTIST`, `CLIENT`).
- DRF SimpleJWT views for login, token refresh, logout, and `/me`.

### Phase 03: Organization API
- CRUD ViewSets, Selectors, and Services for `Organization`, `Client`, `Vendor`, `Person`, `Department`, `Team`, `Office`.
- Ensure multi-tenant queryset filtering on all read operations.

### Phase 04: Production Domain API
- ViewSets and Services for `Project`, `Sequence`, `Shot`, and `Asset`.
- Action endpoints: `POST /shots/{id}/approve/` with domain event emission.

### Phase 05: Task & Timelog API
- CRUD and Bulk Action endpoints for `Task` (`/bulk-assign/`, `/bulk-status/`, `/bulk-archive/`, `/bulk-delete/`).
- Time tracking ViewSets with supervisor approval workflows.

### Phase 06: Review & Playlists API
- `ReviewSession` with frame annotation JSONB validation.
- `Playlist` with entry re-ordering (`/reorder/`) and secure client sharing (`/share/`).

### Phase 07: Pipeline & Publishing API
- `PublishedVersion` tracking OpenUSD paths and technical frame metadata.
- Pre-flight DCC publish validation endpoints.

### Phase 08: Delivery & Turnover API
- Delivery package manifests, automated QC validation, and delivery state machines (`Draft` $\rightarrow$ `Validating` $\rightarrow$ `Prepared` $\rightarrow$ `Submitted` $\rightarrow$ `Approved`).

### Phase 09: Automation & Telemetry
- Workflow DAG and Trigger-Condition-Action automation rule engine with Celery workers.
- Studio KPI analytics endpoints.

### Phase 10: Realistic Seed Data Generation
- Django management command `python manage.py seed_studiohub_data` to generate realistic VFX projects, shots, tasks, and assets for development and demo environments.

### Phase 11: Automated Contract Testing
- Automated test suite validating exact schema parity, status codes, and error formatting between MSW fixtures and Django responses.

### Phase 12: Production Cutover
- Toggle `VITE_USE_MSW=false` and configure `VITE_API_URL` to route all frontend requests to the Django cluster with zero frontend modifications.
