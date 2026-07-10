# API Routing

## Overview

StudioHub follows a modular routing architecture where each business domain owns its own API endpoints. Every module is responsible for registering its own routes, while the main application aggregates them under a versioned API namespace.

This approach keeps the API organized, scalable, and easy to maintain as the platform grows.

---

# Objectives

The routing system provides:

- Modular API registration
- Versioned endpoints
- Consistent URL patterns
- Automatic route generation
- Resource-oriented URLs
- Easy module integration

---

# Routing Architecture

```text
config/urls.py
        │
        ▼
api/v1/
        │
        ├──────────────┐
        ▼              ▼
 Identity API    Organization API
        │              │
        ▼              ▼
 Production API   Core API
```

Each module manages its own routes independently.

---

# URL Structure

All APIs are exposed under a versioned namespace.

```text
/api/v1/
```

Example

```text
/api/v1/auth/

/api/v1/users/

/api/v1/organizations/

/api/v1/departments/

/api/v1/projects/

/api/v1/shots/

/api/v1/tasks/

/api/v1/versions/
```

---

# Directory Structure

Each module contains its own routing configuration.

```text
apps/

identity/
└── api/
    └── urls.py

organization/
└── api/
    └── urls.py

production/
└── api/
    └── urls.py
```

---

# Project Routing

Example project structure

```text
config/

urls.py

↓

api/v1/

↓

Identity URLs

Organization URLs

Production URLs

Core URLs
```

The project-level router should only include module routes.

---

# Router Structure

Each module should define its own router.

Example

```text
Identity Router

↓

Users

Roles

Permissions

Authentication
```

Organization

```text
Organization Router

↓

Organizations

Departments

Teams

Offices
```

Production

```text
Production Router

↓

Projects

Sequences

Shots

Tasks

Versions
```

---

# Resource Naming

Resources should always use plural nouns.

Good

```text
/users/

/projects/

/departments/

/tasks/

/shots/
```

Avoid

```text
/getUsers

/createProject

/deleteTask
```

REST endpoints should describe resources rather than actions.

---

# Nested Resources

Use nested routes only when relationships are explicit.

Example

```text
/projects/{project_id}/sequences/

/sequences/{sequence_id}/shots/

/shots/{shot_id}/tasks/
```

Avoid excessive nesting.

Maximum recommended depth

```text
Project

↓

Sequence

↓

Shot
```

---

# Custom Actions

Non-CRUD operations should use explicit action endpoints.

Examples

```text
POST /projects/{id}/archive/

POST /projects/{id}/restore/

POST /shots/{id}/approve/

POST /tasks/{id}/assign/

POST /versions/{id}/publish/
```

Custom actions should represent business workflows.

---

# API Versioning

Routes should always be versioned.

Example

```text
/api/v1/projects/

/api/v2/projects/
```

Never mix different versions under the same namespace.

---

# URL Naming Convention

Use lowercase words separated by hyphens where needed.

Examples

```text
/work-calendars/

/trusted-devices/

/backup-codes/
```

Avoid

```text
/workCalendars/

/TrustedDevices/

/Work_Calendar/
```

---

# Route Registration

Every module should expose a single routing entry point.

Example

```text
identity/api/urls.py

organization/api/urls.py

production/api/urls.py
```

The project router imports only these files.

---

# HTTP Methods

Supported methods

| Method | Purpose |
|---------|----------|
| GET | Retrieve |
| POST | Create |
| PUT | Replace |
| PATCH | Partial Update |
| DELETE | Soft Delete |

---

# Route Organization

Endpoints should be grouped logically.

Example

```text
Authentication

Users

Roles

Permissions

Organizations

Departments

Projects

Shots

Tasks

Reviews

Versions
```

---

# Best Practices

- Keep routing modular.
- Use RESTful URLs.
- Use plural resource names.
- Version every endpoint.
- Keep nesting shallow.
- Use ViewSets for CRUD resources.
- Use custom actions for workflows.

---

# Anti-Patterns

Avoid:

- Verb-based URLs
- Deeply nested routes
- Mixing API versions
- Duplicate endpoints
- Business logic in routing
- Large monolithic URL files

---

# Testing

Routing tests should verify:

- Route registration
- URL resolution
- HTTP methods
- API versioning
- Authentication requirements
- Permission enforcement
- Custom actions
- Reverse URL generation

---

# Related Documents

- overview.md
- views.md
- authentication.md
- permissions.md
- serializers.md
- versioning.md
- ../03-backend/development-guide.md