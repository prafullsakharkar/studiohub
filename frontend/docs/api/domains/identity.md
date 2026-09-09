# Identity Domain API Specification (`apps.identity`)

## 1. Domain Overview
The `identity` application governs user accounts, credentials, JWT token lifecycle, and system-level role authorization.

---

## 2. Models & Data Structures

### 2.1 User Model (`apps.identity.models.User`)
- `id`: UUID (Primary Key)
- `email`: EmailField (Unique, Normalized)
- `first_name`: CharField(150)
- `last_name`: CharField(150)
- `role`: CharField (Choices: `SUPERVISOR`, `ADMIN`, `LEAD`, `ARTIST`, `CLIENT`)
- `system_role`: CharField (Choices: `SUPER_ADMIN`, `ORGANIZATION_ADMIN`, `CREW_MEMBER`, `CLIENT_REVIEWER`)
- `avatar_url`: URLField (Optional)
- `status`: CharField (Default: `Active`)
- `is_active`: BooleanField (Default: `True`)

---

## 3. Endpoints

### 3.1 POST `/api/v1/auth/login/`
- **Purpose**: Authenticates email/password and returns JWT access + refresh tokens and user profile.
- **Request**:
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
    "organization_id": "org-apex-01",
    "organization_name": "Apex VFX Studios",
    "department_id": "dept-005",
    "department_name": "VFX & Compositing",
    "status": "Active"
  }
}
```

### 3.2 POST `/api/v1/auth/refresh/`
- **Purpose**: Rotate and refresh JWT access token.

### 3.3 POST `/api/v1/auth/logout/`
- **Purpose**: Blacklist the refresh token and terminate active session.

### 3.4 GET `/api/v1/auth/me/`
- **Purpose**: Fetch current active user profile and organization permissions.
