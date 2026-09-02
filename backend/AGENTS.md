# StudioHub Backend Agent Rules

## ALWAYS READ FIRST

- .ai/ARCHITECTURE.md
- .ai/PROJECT_RULES.md
- .ai/CODING_GUIDELINES.md
- .ai/DEVELOPMENT_WORKFLOW.md
- ../docs/APP_ARCHITECTURE_TEMPLATE.md

## REFERENCE IMPLEMENTATIONS

Always analyze:

- apps/core
- apps/identity
- apps/organization

Use apps/organization as the primary reference for domain application structure.

## ARCHITECTURE

StudioHub uses:

- DDD
- Clean Architecture
- Modular Monolith
- Service Layer
- Selector Pattern
- Domain Events
- Django ORM
- Django REST Framework

Never introduce a competing architecture without an approved ADR.

## CORE

Core is the shared backend foundation.

Reuse Core before creating new infrastructure.

Never duplicate:

- Base models
- Managers
- QuerySets
- Selectors
- Services
- Validators
- Permissions
- Events
- API infrastructure
- Middleware
- Utilities

## DOMAIN APPLICATIONS

Follow the established Organization application structure.

Never invent a new application structure when an existing pattern applies.

## IDENTITY

Reuse apps/identity for:

- Users
- Authentication
- Roles
- Permissions
- Security
- Devices

Do not recreate identity functionality in domain apps.

## ORGANIZATION

Reuse apps/organization for:

- Organizations
- Departments
- Teams
- Offices
- Positions
- Memberships
- Invitations
- Organization settings

All organization-aware domains must respect organization isolation.

## DATA ACCESS

Follow:

Model
→ QuerySet
→ Manager
→ Selector
→ Service
→ API

Use selectors for reads and services for business operations.

## API

Follow:

Request
→ View/ViewSet
→ Serializer
→ Service/Selector
→ Domain
→ Database

Preserve existing frontend API contracts.

## SECURITY

Backend authorization is authoritative.

Never rely only on frontend permission checks.

Always enforce:

- Authentication
- Authorization
- Organization isolation
- Object-level permissions
- Business validation

## DATABASE

Use Django ORM.

Development/testing may use SQLite when requested.

Production uses PostgreSQL.

Do not introduce database-specific business logic.

## PYTHON ENVIRONMENT

Always use `uv run`.

Examples:

uv run python manage.py check
uv run python manage.py migrate
uv run python manage.py test

Never use the system Python environment.

## BEFORE CODING

1. Read `.roo/rules/` when present.
2. Read `.ai/` documentation.
3. Analyze Core.
4. Analyze Identity.
5. Analyze Organization.
6. Search for existing implementations.
7. Reuse existing patterns.
8. Implement.
9. Test.
10. Update documentation.

## NEVER

- Create a competing architecture.
- Create duplicate Core functionality.
- Duplicate Identity functionality.
- Duplicate Organization functionality.
- Bypass services/selectors.
- Put complex business logic in serializers/views.
- Break API contracts.
- Bypass permissions.
- Create cross-domain circular dependencies.
- Run Python outside `uv run`.
- Add architectural changes without reviewing/creating an ADR.

## COMPLETION CHECKLIST

Before finishing:

- Rules reviewed
- Architecture reviewed
- Core analyzed
- Identity analyzed
- Organization analyzed
- Existing implementation searched
- Correct folder structure used
- Core reused
- Domain boundaries preserved
- Organization isolation preserved
- API contract preserved
- Tests added/updated
- `uv run python manage.py check` passes
- Tests pass
- Documentation updated