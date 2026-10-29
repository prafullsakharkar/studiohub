# StudioHub — Real vs. Mocked Call-Site & Decimal Audit Report

*Generated: 2026-09-10T10:10:04.187Z*

---

## 1. Executive Summary

This document fulfills **Phase 0 & Phase 3** of the StudioHub Frontend Implementation Plan:
1. **Real vs. Mocked Call-Site Audit**: Catalogs every entity in `MockDatabaseState`, mapping its corresponding REST Adapter, Mock Adapter, and consumer services/hooks.
2. **Decimal Parsing Architecture**: Tracks the permanent shared `parseDecimal()` utility (`src/shared/utils/decimal.ts`) ensuring high-precision parsing for all Decimal-backed fields serialized as strings by Django REST Framework.

---

## 2. Shared Decimal Parsing Architecture

Django REST Framework intentionally serializes Decimal fields (`budget_usd`, `fps`, `storage_quota_tb`, `storage_used_tb`, `estimated_hours`, `logged_hours`, `hourly_rate_usd`, `file_size_mb`, `version_number`) as strings to preserve mathematical precision.

The shared utility in `src/shared/utils/decimal.ts` provides:
- `parseDecimal(val, default, options)`: Core NaN-safe, currency-clean, clamped decimal converter.
- `parseBudget(val)`: Fixed 2-decimal budget parser.
- `parseFps(val)`: Frame-rate parser (23.976, 24.0, 29.97, 60.0).
- `parseHours(val)`: Time estimate and logged hours parser.
- `parseStorage(val)`: Storage quota/usage Terabyte/Megabyte parser.
- `formatCurrency(val, currency)`: Formatted currency display helper.
- `formatDecimal(val, fractionDigits)`: Locale-aware decimal number stringifier.

---

## 3. Entity-by-Entity Real vs. Mock Call-Site Matrix

| Entity | Canonical Route | REST Client / Adapter (Real API) | Mock Handler / Adapter (Mock Mode) | Decimal Fields Handled | Call-Site Mode Classification |
|---|---|---|---|---|---|
| **Organization** | `/api/organizations/` | `RESTOrganizationAdapter` (`ApiClient`) | `MockOrganizationAdapter` (`mockRouter` / `MockDB`) | `storage_quota_tb, storage_used_tb` | **Dual-Mode (Real in REST / Mock in Dev)** |
| **Client** | `/api/organizations/{org_id}/clients/` | `RESTOrganizationAdapter` (`ApiClient`) | `MockOrganizationAdapter` (`mockRouter` / `MockDB`) | `total_billed_usd` | **Dual-Mode (Real in REST / Mock in Dev)** |
| **Vendor** | `/api/organizations/{org_id}/vendors/` | `RESTOrganizationAdapter` (`ApiClient`) | `MockOrganizationAdapter` (`mockRouter` / `MockDB`) | `bandwidth_gbps` | **Dual-Mode (Real in REST / Mock in Dev)** |
| **Person** | `/api/organizations/{org_id}/people/` | `RESTOrganizationAdapter` (`ApiClient`) | `MockOrganizationAdapter` (`mockRouter` / `MockDB`) | `logged_hours` | **Dual-Mode (Real in REST / Mock in Dev)** |
| **Department** | `/api/organizations/{org_id}/departments/` | `RESTOrganizationAdapter` (`ApiClient`) | `MockOrganizationAdapter` (`mockRouter` / `MockDB`) | `capacity_hours_weekly` | **Dual-Mode (Real in REST / Mock in Dev)** |
| **Project** | `/api/v1/projects/` | `RESTProjectAdapter` (`ApiClient`) | `MockProjectAdapter` (`mockRouter` / `MockDB`) | `budget_usd, fps, health_score, burn_rate_pct` | **Dual-Mode (Real in REST / Mock in Dev)** |
| **Shot** | `/api/v1/shots/` | `RESTShotAdapter` (`ApiClient`) | `MockShotAdapter` (`mockRouter` / `MockDB`) | `duration_seconds, progress_percentage` | **Dual-Mode (Real in REST / Mock in Dev)** |
| **Task** | `/api/v1/tasks/` | `RESTTaskAdapter` (`ApiClient`) | `MockTaskAdapter` (`mockRouter` / `MockDB`) | `estimated_hours, actual_hours, logged_hours, bid_days` | **Dual-Mode (Real in REST / Mock in Dev)** |
| **Asset** | `/api/v1/assets/` | `RESTAssetAdapter` (`ApiClient`) | `MockAssetAdapter` (`mockRouter` / `MockDB`) | `file_size_mb, version_number` | **Dual-Mode (Real in REST / Mock in Dev)** |
| **Sequence** | `/api/v1/sequences/` | `ProjectScopedApiService` (`ApiClient`) | `MockRouter` (`mockRouter` / `MockDB`) | `shots_count` | **Dual-Mode (Real in REST / Mock in Dev)** |
| **DeliveryPackage** | `/api/v1/deliveries/` | `RESTDeliveryAdapter` (`ApiClient`) | `MockDeliveryAdapter` (`mockRouter` / `MockDB`) | `total_size_bytes, validation_score` | **Dual-Mode (Real in REST / Mock in Dev)** |
| **PublishItem** | `/api/v1/publishing/` | `RESTPublishingAdapter` (`ApiClient`) | `MockPublishingAdapter` (`mockRouter` / `MockDB`) | `file_size_mb, total_frames` | **Dual-Mode (Real in REST / Mock in Dev)** |
| **ReviewSession** | `/api/v1/reviews/` | `ProjectScopedApiService` (`ApiClient`) | `MockRouter` (`mockRouter` / `MockDB`) | `versions_count` | **Dual-Mode (Real in REST / Mock in Dev)** |
| **CalendarEvent** | `/api/v1/scheduling/events/` | `SchedulingRepository` (`ApiClient`) | `MockRouter` (`mockRouter` / `MockDB`) | `hours` | **Dual-Mode (Real in REST / Mock in Dev)** |
| **Resource** | `/api/v1/scheduling/resources/` | `SchedulingRepository` (`ApiClient`) | `MockRouter` (`mockRouter` / `MockDB`) | `capacity_weekly_hours, capacity_daily_hours, hourly_rate, utilization_pct` | **Dual-Mode (Real in REST / Mock in Dev)** |
| **Timelog** | `/api/v1/tasks/timelogs/` | `RESTTaskAdapter` (`ApiClient`) | `MockTaskAdapter` (`mockRouter` / `MockDB`) | `duration_hours, hourly_rate_usd` | **Dual-Mode (Real in REST / Mock in Dev)** |

---

## 4. Phase 1 & Phase 2 Migration Status (Tiers 1–4)

### ✅ Phase 1: Route & Identifier Consolidation
- **Canonical Scoped Routes**: All organization sub-resources route through `/api/organizations/{org_id}/{resource}/`.
- **DRF Envelope Standardization**: Unconditional pagination supported via `paginateDRF()` and `PaginatedResponse<T>` envelope.
- **Identifier Single Source of Truth**: All models strictly keyed on `.id` with zero residual `.uuid` field dependencies.
- **Foreign Key Standard**: Standardized on `organization_id`, `department_id`, `project_id`.

### ✅ Phase 2: Entity Tier Alignment
- **Tier 1 (Real Feature Gaps)**:
  - `Task`: Supported `schedule` with `estimated_hours`, `logged_hours`, `bid_days`, `progress_percent`, and `overrun_risk`.
  - `Timelog`: Implemented full approval workflow (`status`, `approved_at`, `approved_by_id`, `rejection_reason`).
  - `Show` / `EditorialCut`: Retained in `MockDatabaseState` with clean project-scoped fallback.
  - `User` / `Person`: Composed auth + profile schema alignment with `user_avatar` dual-compatibility.
- **Tier 2 (Unit & Type Fixes)**:
  - `Sequence`: Normalized `shots_count` (integer) alongside `shot_count`.
  - `Resource`: Normalized `capacity_weekly_hours` (and `capacity_daily_hours = weekly / 5`).
  - `Media`: Integrated `storage_location` and `storage_tier`.
- **Tier 3 (Naming Renames)**:
  - `AccessRole`: Supported `is_system` (canonical) and `is_system_role` (alias).
  - `Client`: Supported `portal_access` (canonical) and `portal_access_enabled` (alias).
  - `Vendor`: Supported `email` & `contact_name` (canonical) with primary contact fallbacks.
- **Tier 4 (Tracked Architectural Items)**:
  - `Workflow`: Graph state-machine model documented; triggers/actions adapter preserved.
  - `Hero-Version`: Normalized via `Version.is_hero` with shot hero-version sync.

---

## 5. Phase 3 Re-Audit Checklist & Sign-Off

- [x] All `MockDatabaseState` entities verified with corresponding REST and Mock adapters.
- [x] Zero breaking field mismatches in staging/production code paths.
- [x] Shared decimal parsing utility active and available in `src/shared/utils/index.ts`.
- [x] TypeScript compiler (`tsc --noEmit`) passes with zero errors.
