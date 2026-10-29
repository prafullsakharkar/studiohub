# StudioHub Authentication & Access Contract

## 1. Authentication Architecture

StudioHub uses JSON Web Token (JWT) based authentication powered by `django-rest-framework-simplejwt`. The platform is org-free: there is no tenant header and no organization membership gate.

```
┌──────────────┐                  ┌────────────────────────┐                  ┌────────────┐
│ React Client │ ── POST credentials ──► │ Django /api/v1/auth/   │ ── Verify DB ──► │ PostgreSQL │
│ (ApiClient)  │ ◄── JWT Access+Refresh ──│ (apps.identity)        │                  │ User Model │
└──────┬───────┘                  └────────────────────────┘                  └────────────┘
       │
       │ Bearer <Access Token>
       ▼
┌────────────────────────┐
│ Auth Gate              │
│ (JWTAuthentication)    │
└────────────────────────┘
```

### 1.1 Token Standards
- **Access Token**: Short-lived JWT (15 minutes). Carries `user_id`, `email`, `role`.
- **Refresh Token**: Long-lived JWT (7 days) with token rotation and blacklist enforcement on refresh/logout.

### 1.2 Request Header Standards
For all protected API endpoints:
```http
Authorization: Bearer <access_token>
Content-Type: application/json
```

No `X-Organization-Id` header is sent; project access is enforced by project membership.

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
    "system_role": "VFX_SUPERVISOR",
    "avatar_url": "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150",
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

## 3. Access Isolation (org-free)

### 3.1 No Tenant Layer
The `TenantMiddleware` and `TenantAwareModel` were removed with the org module.
There is no `X-Organization-Id` header, no `request.organization`, and no
tenant-scoped queryset filtering.

### 3.2 Project Membership Isolation
Production data is isolated by **project membership**:
- DRF permission classes reject non-members with `403` at the API layer.
- The frontend route permission registry mirrors the check and redirects
  non-members to `/forbidden` before any project data renders (no data leak).
- Platform admins bypass membership checks by design (superuser access).

### 3.3 Removed endpoints
`GET /api/v1/users/me/memberships/` and all `/api/v1/organizations/*` routes
no longer exist. The frontend's `withMemberships` call was removed.
