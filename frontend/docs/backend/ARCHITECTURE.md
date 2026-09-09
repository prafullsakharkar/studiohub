# StudioHub Backend Architecture

## Overview
StudioHub is an enterprise-grade multi-tenant Visual Effects (VFX) and 3D Animation Production Management Platform. The backend is designed as a **Modular Monolith** using **Django 5.x** and **Django REST Framework (DRF)**, operating against **PostgreSQL 16+**, **Redis 7+**, and **Celery 5.4+**.

---

## Architectural Principles

1. **Strict Multi-Tenant Isolation**: Every tenant entity is partitioned by `organization_id`. Tenant resolution is handled via the `TenantMiddleware` reading the `X-Organization-Id` HTTP header and fallbacks to authenticated user profiles.
2. **Clean Separation of Concerns**:
   - **Models**: Database schemas, constraints, indexing, soft deletion (`is_deleted`), and UUID primary keys.
   - **Serializers**: Data parsing, serialization, and input validation.
   - **Selectors**: Read/query optimizations, prefetching, and query isolation.
   - **Services**: Business mutations, workflow transitions, and domain events.
   - **Views**: HTTP routing, permission dispatching, and status codes.
3. **Frontend Contract Fidelity**: API endpoints, payloads, HTTP verbs, query parameters, and pagination envelopes match the frontend contract exactly.

---

## Tiered Module Hierarchy

```
┌─────────────────────────────────────────────────────────────┐
│                       5. DOMAIN APPS                        │
│  (Projects, Shots, Assets, Tasks, Reviews, Versions, etc.)  │
└──────────────────────────────┬──────────────────────────────┘
                               │ depends on
┌──────────────────────────────▼──────────────────────────────┐
│                    4. ORGANIZATION APP                      │
│ (Organizations, Clients, Vendors, People, Departments, Teams)│
└──────────────────────────────┬──────────────────────────────┘
                               │ depends on
┌──────────────────────────────▼──────────────────────────────┐
│                      3. IDENTITY APP                        │
│    (Custom User Model, Credentials, RBAC Roles, Tokens)     │
└──────────────────────────────┬──────────────────────────────┘
                               │ depends on
┌──────────────────────────────▼──────────────────────────────┐
│                        2. CORE APP                          │
│(Base Models, Tenant Isolation, Exception Handlers, Selectors)│
└─────────────────────────────────────────────────────────────┘
```

---

## High-Level Component Mapping

- **`apps.core`**: `BaseModel`, `TenantAwareModel`, `TenantMiddleware`, `StandardResultsSetPagination`, `custom_exception_handler`.
- **`apps.identity`**: Custom `User`, JWT auth endpoints (`/login/`, `/refresh/`, `/logout/`, `/me/`).
- **`apps.organization`**: `Organization`, `Client`, `Vendor`, `Person`, `Department`, `Team`, `Office`.
- **`apps.production`**: `Project`, `Sequence`, `Shot`, `Asset`, `Attachment`.
- **`apps.tasks`**: `Task`, `Timelog`, bulk action handlers (`/bulk-assign/`, `/bulk-status/`, `/bulk-archive/`, `/bulk-delete/`).
- **`apps.reviews`**: `ReviewSession`, `Playlist`, `PlaylistEntry`, `ReviewAnnotation`, `ReviewComment`.
- **`apps.pipeline`**: `PublishedVersion`, `MediaAsset`, `PublishItem`.
- **`apps.deliveries`**: `DeliveryPackage`, `DeliveryVersionRef`.
- **`apps.automation`**: `AutomationRule`, `AutomationLog`.
- **`apps.analytics`**: Real-time KPI aggregation & Department throughput counters.
- **`apps.audit`**: Mutation logging (`AuditLogEntry`).
- **`apps.settings`**: `StudioPipelineSettings`.
