# StudioHub Django REST Framework (DRF) API Integration

## 1. Overview
StudioHub connects to a Django REST Framework (DRF) backend API architecture. In frontend development and testing environments, a Mock Service Worker (MSW) server mirrors the full DRF specification.

---

## 2. DRF Standards & Protocols

### 2.1 Standardized Endpoints
All API resources follow standard DRF REST conventions:
- `GET /api/v1/{resource}/`: List entities with filtering, search, and pagination.
- `POST /api/v1/{resource}/`: Create new entity instance.
- `GET /api/v1/{resource}/{id}/`: Retrieve detailed entity representation.
- `PATCH /api/v1/{resource}/{id}/`: Partial field update.
- `PUT /api/v1/{resource}/{id}/`: Full entity replacement.
- `DELETE /api/v1/{resource}/{id}/`: Hard/soft deletion (returns `204 No Content`).

### 2.2 Pagination Contract (`PageNumberPagination`)
All paginated DRF list responses return the standard payload structure:
```json
{
  "count": 48,
  "next": "http://api.studio.vfx/api/v1/shots/?page=2",
  "previous": null,
  "results": [
    {
      "id": "shot-001",
      "code": "NK_010_010",
      "status": "In Progress"
    }
  ]
}
```

### 2.3 Multi-Tenant Header Protocol
Every outgoing HTTP request automatically includes:
- `Authorization: Bearer <JWT_ACCESS_TOKEN>`
- `X-Organization-Id: <ACTIVE_ORGANIZATION_ID>`
- `Content-Type: application/json`

---

## 3. Error Handling Architecture

### 3.1 DRF Error Representation
- **Field Validation Errors (400 Bad Request)**:
  ```json
  {
    "name": ["This field may not be blank."],
    "code": ["Project code 'NK99' already exists in this organization."]
  }
  ```
- **Non-Field Errors**:
  ```json
  {
    "non_field_errors": ["Invalid credentials or inactive account."],
    "detail": "Authentication credentials were not provided."
  }
  ```

### 3.2 ApiError Class & ErrorMapper
The frontend transforms all network and HTTP exceptions into a typed `ApiError` instance:
- `error.isValidationError` (400 / 422)
- `error.isAuthError` (401)
- `error.isPermissionDenied` (403)
- `error.isNotFound` (404)
- `error.isRateLimited` (429)
- `error.isServerError` (500 / 502 / 503)
- `error.isNetworkError` (0 / Offline / Timeout)
- `error.getFieldErrors('fieldName')` retrieves specific array of validation messages.
