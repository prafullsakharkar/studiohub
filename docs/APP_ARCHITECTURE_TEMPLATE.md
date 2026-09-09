# StudioHub Application Architecture Template

## 1. Purpose

Every StudioHub backend application must use this document as its architecture template.

The template ensures that all applications follow the same:

* Architecture
* Folder structure
* Domain boundaries
* Data access patterns
* API patterns
* Security patterns
* Testing conventions

---

# 2. Application Information

```text
Application:
Domain:
Purpose:
Owner:
Dependencies:
Status:
```

---

# 3. Domain Responsibility

Describe exactly what the application owns.

### Owns

```text
...
```

### Does Not Own

```text
...
```

---

# 4. Dependencies

Expected dependency direction:

```text
Core
 ↓
Identity
 ↓
Organization
 ↓
Domain
```

Document external domain dependencies explicitly.

---

# 5. Folder Structure

Use the established StudioHub structure:

```text
apps/<domain>/
├── admin/
├── api/
├── choices/
├── constants/
├── events/
├── exceptions/
├── filters/
├── managers/
├── middleware/
├── migrations/
├── models/
├── permissions/
├── querysets/
├── selectors/
├── serializers/
├── services/
├── signals/
├── tasks/
├── validators/
├── views/
└── apps.py
```

Do not create unnecessary directories.

---

# 6. Models

Document each model.

```text
Model:
Purpose:
Organization Scoped:
Relationships:
Core Base Models:
Indexes:
Constraints:
Soft Delete:
Audit:
```

---

# 7. Relationships

Document domain relationships.

Example:

```text
Organization
    ↓
Project
    ↓
Sequence
    ↓
Shot
    ↓
Task
    ↓
Version
```

---

# 8. QuerySets

Document custom QuerySet behavior.

```text
active()
for_organization()
for_project()
search()
published()
```

Only implement domain-specific QuerySet behavior.

---

# 9. Managers

Document custom managers.

Keep managers thin.

---

# 10. Selectors

Document read operations.

Example:

```text
ProjectSelector
    list()
    get()
    search()
    for_organization()
```

---

# 11. Services

Document business operations.

Example:

```text
CreateProjectService
UpdateProjectService
ArchiveProjectService
RestoreProjectService
```

For each service document:

```text
Input
Validation
Transaction
Database Changes
Events
Side Effects
```

---

# 12. Validators

Document:

```text
Generic Validators
Domain Validators
State Transition Validators
Organization Validators
```

---

# 13. Events

Document:

```text
Event
Trigger
Payload
Subscribers
Side Effects
```

Example:

```text
ProjectCreated
 ↓
Audit
 ↓
Notification
 ↓
Analytics
```

---

# 14. Permissions

Document:

```text
Authentication
Organization Scope
Object Permission
Role Permission
Action Permission
```

---

# 15. API Endpoints

Document every endpoint.

| Method | Endpoint     | Purpose | Permission | Service/Selector |
| ------ | ------------ | ------- | ---------- | ---------------- |
| GET    | `/...`       | List    | ...        | ...              |
| POST   | `/...`       | Create  | ...        | ...              |
| GET    | `/.../{id}/` | Detail  | ...        | ...              |
| PATCH  | `/.../{id}/` | Update  | ...        | ...              |
| DELETE | `/.../{id}/` | Delete  | ...        | ...              |

---

# 16. API Actions

Document custom actions.

Example:

```text
POST /projects/{id}/archive/
POST /projects/{id}/restore/
POST /versions/{id}/submit/
POST /reviews/{id}/approve/
POST /reviews/{id}/reject/
```

Document:

```text
Request
Response
Permission
Validation
Events
```

---

# 17. Filtering

Document supported filters.

```text
organization
project
status
owner
created_at
updated_at
```

---

# 18. Searching

Document searchable fields.

```text
name
code
description
```

---

# 19. Ordering

Document supported ordering.

```text
created_at
updated_at
name
priority
```

---

# 20. Pagination

Use Core pagination.

Document the pagination format exposed by the API.

---

# 21. Organization Isolation

Document how organization boundaries are enforced.

Example:

```text
Request
 ↓
Organization Context
 ↓
Selector
 ↓
Organization Scope
 ↓
Object
```

Every relevant list/detail/action endpoint must enforce the boundary.

---

# 22. Events and Background Tasks

Document Celery tasks.

```text
Task
Trigger
Queue
Retry Policy
Failure Handling
```

---

# 23. Files

If the application handles media/files:

```text
File Type:
Storage:
Path:
Upload:
Validation:
Processing:
Cleanup:
```

Use Core filesystem infrastructure.

---

# 24. Audit

Document auditable operations.

```text
Create
Update
Delete
Publish
Approve
Reject
Assign
Archive
Restore
```

---

# 25. Testing

Required tests:

```text
Models
QuerySets
Selectors
Services
Validators
Serializers
API
Permissions
Organization Isolation
Events
Tasks
```

---

# 26. Frontend Integration

Document:

```text
Frontend Route
API Endpoint
Request
Response
Actions
Filters
Pagination
```

If mock APIs exist, document the compatibility requirements.

---

# 27. Performance

Document:

```text
Indexes
select_related
prefetch_related
Annotations
Caching
Pagination
```

---

# 28. Security

Document:

```text
Authentication
Authorization
Organization Isolation
Object Permissions
Sensitive Data
Audit Requirements
```

---

# 29. ADR References

List relevant architectural decisions:

```text
ADR-XXXX
ADR-XXXX
```

---

# 30. Definition of Done

The application is complete when:

```text
[ ] Domain boundaries documented
[ ] Models implemented
[ ] QuerySets implemented
[ ] Managers implemented
[ ] Selectors implemented
[ ] Services implemented
[ ] Validators implemented
[ ] Events implemented
[ ] Permissions implemented
[ ] API implemented
[ ] Filtering implemented
[ ] Pagination implemented
[ ] Organization isolation implemented
[ ] Tests implemented
[ ] API contract verified
[ ] Documentation complete
[ ] Architecture compliant
```

---

# 31. Architecture Rule

Every StudioHub application must be understandable by an engineer familiar with:

```text
apps/core
apps/identity
apps/organization
```

A new application must look and behave like a natural extension of those applications rather than introducing an independent framework.
