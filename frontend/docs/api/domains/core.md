# Core Domain API Specification (`apps.core`)

## 1. Responsibilities
The `core` application provides technical infrastructure, shared models, tenant isolation middleware, pagination classes, and exception handling for all domain applications.

---

## 2. Infrastructure Components

### 2.1 Abstract Models
- `BaseModel`: Standardizes `id` (UUIDv4), `created_at` (timestamptz), `updated_at` (timestamptz), `is_deleted` (bool for soft deletes), and `created_by` / `updated_by` audit fields.
- `TenantAwareModel`: Inherits from `BaseModel`, adds `organization` ForeignKey with composite index `(organization_id, id)`.

### 2.2 Middleware & Context
- `TenantMiddleware`: Extracts `X-Organization-Id` from HTTP headers, queries `apps.organization.selectors.get_active_organization`, and sets `request.organization`.

### 2.3 Exception Handler
- `custom_exception_handler`: Normalizes DRF field validation dictionaries into the standard `{ "errors": { ... }, "message": "..." }` contract required by the frontend.

---

## 3. Endpoints

### 3.1 GET `/api/v1/health/`
- **Purpose**: System health check endpoint reporting database connectivity, Redis ping, and Celery worker status.
- **Auth Required**: No
- **Response (200 OK)**:
```json
{
  "status": "healthy",
  "database": "connected",
  "redis": "connected",
  "version": "2.4.0"
}
```
