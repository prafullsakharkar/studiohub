# StudioHub Authentication & Multi-Tenancy Contract

## 1. Authentication Architecture

StudioHub uses JSON Web Token (JWT) based authentication powered by `django-rest-framework-simplejwt`.

```
┌──────────────┐                  ┌────────────────────────┐                  ┌────────────┐
│ React Client │ ── POST credentials ──► │ Django /api/v1/auth/   │ ── Verify DB ──► │ PostgreSQL │
│ (ApiClient)  │ ◄── JWT Access+Refresh ──│ (apps.identity)        │                  │ User Model │
└──────┬───────┘                  └────────────────────────┘                  └────────────┘
       │
       │ Bearer <Access Token> + X-Organization-Id
       ▼
┌────────────────────────┐
│ Tenant & Auth Gate     │
│ (TenantMiddleware &    │
│  JWTAuthentication)    │
└────────────────────────┘
```

### 1.1 Token Standards
- **Access Token**: Short-lived JWT (15 minutes). Carries `user_id`, `email`, `role`, `org_id`.
- **Refresh Token**: Long-lived JWT (7 days) with token rotation and blacklist enforcement on refresh/logout.

### 1.2 Request Header Standards
For all protected API endpoints:
```http
Authorization: Bearer <access_token>
X-Organization-Id: org-apex-01
Content-Type: application/json
```

---

## 2. Endpoints & Schemas

### 2.1 POST `/api/v1/auth/login/`
- **Purpose**: Authenticates studio user credentials and issues access/refresh tokens.
- **Request Body**:
```json
{
  "email": "supervisor@studiohub.vfx",
  "password": "password123"
}
```
- **Response (200 OK)**:
```json
{
  "tokens": {
    "access": "eyJhbGciOi...",
    "refresh": "eyJhbGciOi..."
  },
  "user": {
    "id": "usr-001",
    "email": "supervisor@studiohub.vfx",
    "first_name": "Alex",
    "last_name": "Chen",
    "name": "Alex Chen",
    "role": "SUPERVISOR",
    "system_role": "ORGANIZATION_ADMIN",
    "avatar_url": "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150",
    "organization_id": "org-apex-01",
    "organization_name": "Apex VFX Studios",
    "department_id": "dept-005",
    "department_name": "VFX & Compositing",
    "title": "Head VFX Supervisor",
    "status": "Active"
  }
}
```

### 2.2 POST `/api/v1/auth/refresh/`
- **Purpose**: Issues a new short-lived access token using a valid refresh token.
- **Request Body**:
```json
{
  "refresh": "eyJhbGciOi..."
}
```
- **Response (200 OK)**:
```json
{
  "access": "eyJhbGciOi..."
}
```

### 2.3 POST `/api/v1/auth/logout/`
- **Purpose**: Invalidates and blacklists the refresh token.
- **Request Body**:
```json
{
  "refresh": "eyJhbGciOi..."
}
```
- **Response (200 OK)**:
```json
{
  "detail": "Successfully logged out."
}
```

### 2.4 GET `/api/v1/auth/me/`
- **Purpose**: Returns the authenticated user's profile and active permissions.
- **Response (200 OK)**: User profile object matching `login` response schema.

---

## 3. Multi-Tenant Context Isolation

### 3.1 Tenant Isolation Middleware (`apps.core.middleware.TenantMiddleware`)
1. Reads `X-Organization-Id` from incoming HTTP request headers.
2. Validates that the authenticated user holds active membership in the requested organization.
3. Sets `request.organization` and activates tenant-scoped database querysets.

### 3.2 QuerySet Multi-Tenancy Enforcement
All tenant-aware models inherit from `TenantAwareModel`:
```python
class TenantAwareModel(BaseModel):
    organization = models.ForeignKey('organization.Organization', on_delete=models.CASCADE, db_index=True)

    class Meta:
        abstract = True
```
Every selector automatically enforces `.filter(organization=request.organization)` to guarantee strict data isolation.
