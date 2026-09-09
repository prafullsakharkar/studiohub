# StudioHub Backend API Specification & Implementation Architecture

## 1. Executive Summary & Objective

**StudioHub** is an enterprise-grade VFX and Animation Production Management Platform engineered to unify shot tracking, asset management, review sessions, task scheduling, time tracking, automated publishing, and client turnover delivery into a high-performance, multi-tenant studio platform.

The frontend application utilizes a decoupled, type-safe API client interface with Mock Service Worker (MSW) and in-memory mock handlers mirroring production contracts. The primary objective of this documentation suite is to define the complete, authoritative **Django REST Framework (DRF)** backend API contract and implementation architecture. 

This contract ensures that a real Django backend replaces MSW seamlessly without requiring a single modification to frontend routes, request schemas, or response parsers.

---

## 2. Target Technology Stack & System Architecture

The StudioHub backend is architected as a **Modular Monolith** adhering to **Domain-Driven Design (DDD)** and **Clean Architecture** principles:

| Layer / Technology | Specification & Role |
| :--- | :--- |
| **Framework** | Django 5.x & Django REST Framework (DRF) 3.15+ |
| **Primary Database** | PostgreSQL 16+ with UUID primary keys and JSONB indexing |
| **Cache & Message Broker** | Redis 7+ for caching, session stores, and Celery broker |
| **Asynchronous Task Queue** | Celery 5.4+ with Celery Beat for periodic jobs & automation |
| **Architecture Pattern** | Modular Monolith (Core → Identity → Organization → Domain) |
| **Design Patterns** | Service Layer, Selector Pattern, Domain Events, Repository/Unit-of-Work |
| **Authentication** | JWT Authentication (`SimpleJWT`) with Refresh Rotation & Blacklisting |
| **Multi-Tenancy** | Header-based isolation via `X-Organization-Id` & Tenant Middleware |
| **Media & Storage** | S3 / MinIO compatible object storage with presigned URLs & OpenUSD paths |

---

## 3. Modular Monolith & Clean Architecture Hierarchy

To prevent circular dependencies and maintain strict boundary isolation, StudioHub organizes its Django applications into four strictly ordered architectural tiers:

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

### Module Structure Pattern
Every Django app inside `apps/` strictly implements the clean architecture separation:
```
apps/<module_name>/
├── models/             # Encapsulated SQLAlchemy/Django ORM data definitions
├── serializers/        # DRF Input & Output Serializers (Validation & Representation)
├── views/              # DRF ViewSets / APIViews (HTTP Routing & Status Codes only)
├── services/           # Business Logic & Mutations (Writes, Transactions, Events)
├── selectors/          # Query Logic & Read Operations (Optimized Select Related, Filters)
├── events/             # Domain Event Definitions & Signal Handlers
├── tasks/              # Celery Asynchronous Background Jobs
├── permissions.py      # Granular Object & Tenant Permission Classes
└── urls.py             # App-level REST URL Router
```

---

## 4. Documentation Suite Navigation

Explore the specialized architectural specifications:

1. **[API Contract & Endpoint Directory](./api-contract.md)**
   - Complete inventory of all REST endpoints, HTTP methods, query parameters, request bodies, response payloads, and status codes.
2. **[Frontend-to-Backend Architectural Mapping](./frontend-backend-mapping.md)**
   - Cross-reference mapping linking every frontend UI component, repository, hook, and MSW handler to its backend Django Model, Serializer, ViewSet, Selector, and Service.
3. **[Authentication & Multi-Tenancy](./authentication-and-multitenancy.md)**
   - JWT authentication flow, token storage, refresh rotation, `X-Organization-Id` tenant isolation middleware, and RBAC matrix.
4. **[Pagination, Filtering, & Sorting](./pagination-filtering-sorting.md)**
   - Standard DRF `PageNumberPagination` structure, `django-filter` filtersets, PostgreSQL full-text search vectors, and bulk batch operations.
5. **[Error Handling & Status Codes](./error-handling-and-status-codes.md)**
   - DRF exception handling, field-level validation dictionaries, non-field error schemas, and frontend `ApiError` mapping.
6. **[Domain Models & Clean Architecture](./domain-models-and-clean-architecture.md)**
   - Core entity models, Service Layer pattern, Selector pattern, Domain Events dispatching, and Celery asynchronous task infrastructure.
7. **[Backend Implementation Plan](./backend-implementation-plan.md)**
   - Phased execution roadmap for implementing Django applications, data migrations, unit testing, and integration verification.
