# ADR-0026: Core Shared-Kernel Boundary and Dependency Rules

# Context

The `apps.core` module has evolved into a "shared kernel" - a collection of reusable, cross-cutting concerns that are shared across the entire application. This includes:

- **Base models**: Audit, UUID, Entity, NamedEntity, Branding
- **Base services**: CRUD, Lifecycle, SoftDelete, Audit
- **Base selectors**: QuerySet helpers, filtering, ordering
- **Base serializers**: Read/Write, Nested, Bulk
- **Base viewsets**: CRUD, Nested, Service, Bulk
- **Base permissions**: Organization, Project, Owner, Reviewer
- **Base exceptions**: API exceptions, validation, authentication
- **Base filters**: Date range, search, soft delete, ownership
- **Base pagination**: Page number, limit offset, cursor, infinite
- **Base renderers**: JSON, CSV, Excel
- **Base choices**: Status, Priority, Visibility, Department
- **Base validators**: Country, Currency, Language, Timezone
- **Base utils**: UUID, Slug, Strings, JSON, Enums, Datetime
- **Base middleware**: Logging, Security, Request ID, Organization
- **Base events**: DomainEvent, EventBus, EventDispatcher
- **Base managers**: Active, SoftDelete, Publishable
- **Base querysets**: Active, SoftDelete, Publishable

However, as the codebase grew, several architectural violations emerged:

1. **Core → Domain leakage**: Domain-specific code (permissions, services) was moved into Core
2. **God-class services**: BusinessService grew to 577 lines, mixing CRUD, lifecycle, and soft delete operations
3. **Dependency direction violations**: Core was importing from `apps.identity`, violating the Domain→Core dependency rule
4. **No architecture tests**: No automated tests to enforce architectural rules

# Decision

We established clear boundaries for the Core shared kernel:

## 1. Core Responsibilities (ALLOWED)

Core should ONLY contain:

- **Generic infrastructure**: UUID, Slug, Strings, JSON, Enums, Datetime
- **Base models**: Audit, UUID, Entity, NamedEntity, Branding
- **Base services**: CRUD, Lifecycle, SoftDelete, Audit (no domain logic)
- **Base selectors**: QuerySet helpers, filtering, ordering
- **Base serializers**: Read/Write, Nested, Bulk (no domain validation)
- **Base viewsets**: CRUD, Nested, Service, Bulk (no domain logic)
- **Base permissions**: Organization, Project, Owner, Reviewer (no domain-specific rules)
- **Base exceptions**: API exceptions, validation, authentication
- **Base filters**: Date range, search, soft delete, ownership
- **Base pagination**: Page number, limit offset, cursor, infinite
- **Base renderers**: JSON, CSV, Excel
- **Base choices**: Status, Priority, Visibility, Department
- **Base validators**: Country, Currency, Language, Timezone
- **Base middleware**: Logging, Security, Request ID, Organization
- **Base events**: DomainEvent, EventBus, EventDispatcher
- **Base managers**: Active, SoftDelete, Publishable
- **Base querysets**: Active, SoftDelete, Publishable

## 2. Domain Responsibilities (NOT Core)

Domain-specific code should be in `apps.domain` or individual domain apps:

- **Domain permissions**: Business-specific authorization rules
- **Domain services**: Business logic, domain rules, workflows
- **Domain selectors**: Domain-specific query logic
- **Domain serializers**: Domain-specific validation
- **Domain viewsets**: Domain-specific API behavior

## 3. Dependency Direction

```
Domain → Core (ALLOWED)
Core → Domain (FORBIDDEN)
```

Core is a "shared kernel" - it should be dependency-free and only depend on:
- Django
- Django REST Framework
- Python standard library

Domain apps can depend on Core, but NOT vice versa.

## 4. Service Pattern

Services should be **focused** and **composable**:

```
CRUDService      → Create, Read, Update, Delete
LifecycleService → Activate, Deactivate, Archive, Draft
SoftDeleteService → Soft delete, Restore, Hard delete
AuditService     → Audit logging (created_by, updated_by)
```

Avoid god-classes like the old `BusinessService` (577 lines).

## 5. Backward Compatibility

- Deprecated classes should inherit from focused services
- Use deprecation warnings in docstrings
- Maintain backward compatibility until migration is complete

# Architecture

## Directory Structure

```
apps/
├── core/                          # Shared kernel (dependency-free)
│   ├── models/
│   │   └── bases/                 # Base models only
│   ├── services/
│   │   ├── crud.py                # CRUD operations
│   │   ├── lifecycle.py           # Lifecycle operations
│   │   ├── soft_delete.py         # Soft delete operations
│   │   └── audit.py               # Audit logging
│   ├── selectors/
│   │   └── base.py                # Base selector
│   ├── api/
│   │   ├── serializers/           # Base serializers
│   │   ├── viewsets/              # Base viewsets
│   │   ├── permissions/           # Base permissions
│   │   ├── exceptions/            # Base exceptions
│   │   ├── filters/               # Base filters
│   │   ├── pagination/            # Base pagination
│   │   └── renderers/             # Base renderers
│   ├── choices/                   # Base choices
│   ├── validators/                # Base validators
│   ├── utils/                     # Base utilities
│   ├── middleware/                # Base middleware
│   ├── events/                    # Base events
│   ├── managers/                  # Base managers
│   └── querysets/                 # Base querysets
│
├── domain/                        # Domain-specific code (compatibility shims)
│   ├── permissions.py             # Re-exports from Core (deprecated)
│   └── services.py                # Re-exports from Core (deprecated)
│
├── identity/                      # Identity domain app
│   ├── models/
│   ├── services/
│   ├── selectors/
│   └── api/
│
├── organization/                  # Organization domain app
│   ├── models/
│   ├── services/
│   ├── selectors/
│   └── api/
│
└── ...                            # Other domain apps
```

## Dependency Graph

```
Domain Apps (identity, organization, ...)
    ↓ depends on
Core Shared Kernel
    ↓ depends on
Django + DRF + Python Standard Library
```

# Objectives

- ✅ **Enforce architectural boundaries**: Core should not depend on domain
- ✅ **Prevent god-classes**: Services should be focused and composable
- ✅ **Maintain backward compatibility**: Deprecated classes should work
- ✅ **Automate architecture tests**: Prevent regressions
- ✅ **Document rules**: Clear ADR for future reference

# Architecture Tests

The following architecture tests were added to `backend/apps/core/tests/test_architecture.py`:

## 1. Core Dependency Direction

```python
class TestCoreDependencyDirection:
    def test_core_does_not_import_domain(self):
        # Verify Core modules don't import from domain apps
        pass
    
    def test_domain_can_import_core(self):
        # Verify domain apps can import from Core
        pass
```

## 2. Public API Stability

```python
class TestPublicApiStability:
    def test_core_exports_expected_modules(self):
        # Verify Core exports expected modules
        pass
    
    def test_core_api_exports_expected_modules(self):
        # Verify Core API exports expected modules
        pass
```

## 3. No Core→Domain Violations

```python
class TestNoCoreDomainViolation:
    def test_base_viewset_does_not_import_domain_permissions(self):
        # Verify BaseViewSet doesn't import domain permissions
        pass
```

# Implementation Guidelines

## Creating a New Service

1. **Determine the responsibility**: CRUD, Lifecycle, SoftDelete, or Audit?
2. **Inherit from the appropriate base**: CRUDService, LifecycleService, etc.
3. **Set the model**: `model = YourModel`
4. **Add domain-specific methods**: Only if truly domain-specific
5. **Publish events**: Use `_publish_event()` for lifecycle operations

```python
class ProjectService(CRUDService):
    model = Project
    
    @classmethod
    def create_project(cls, *, user=None, **validated_data):
        # Domain-specific creation logic
        validated_data = cls.before_create(**validated_data)
        instance = super().create(user=user, **validated_data)
        instance = cls.after_create(instance, user=user)
        cls._publish_event("create", instance=instance, user=user)
        return instance
```

## Creating a New Permission

1. **Inherit from BasePermission**: `from apps.core.api.permissions.base import BasePermission`
2. **Implement has_permission**: For view-level permissions
3. **Implement has_object_permission**: For object-level permissions
4. **Add to __init__.py**: Export the permission

```python
from apps.core.api.permissions.base import BasePermission

class IsProjectOwner(BasePermission):
    def has_object_permission(self, request, view, obj):
        return obj.owner == request.user
```

## Creating a New Selector

1. **Inherit from BaseSelector**: `from apps.core.selectors.base import BaseSelector`
2. **Implement get_queryset**: Return the base queryset
3. **Add domain-specific methods**: Query helpers

```python
from apps.core.selectors.base import BaseSelector

class ProjectSelector(BaseSelector):
    @classmethod
    def get_queryset(cls):
        return super().get_queryset().select_related("owner")
    
    @classmethod
    def by_owner(cls, user):
        return cls.filter(owner=user)
```

# Compliance

## Positive

- ✅ **Clear boundaries**: Core vs domain is now explicit
- ✅ **Focused services**: No more 577-line god-classes
- ✅ **Architecture tests**: Automated enforcement of rules
- ✅ **Backward compatibility**: Deprecated classes still work
- ✅ **Documentation**: Clear ADR for future reference

## Negative

- ⚠️ **Migration effort**: Existing code needs to be refactored
- ⚠️ **Breaking changes**: Some imports may need to change
- ⚠️ **Learning curve**: Developers need to understand the new structure

# Implementation Guidelines

## For Developers

1. **When adding to Core**: Ask "Is this truly generic?"
2. **When adding to domain**: Ask "Is this domain-specific?"
3. **When creating services**: Use focused services, not god-classes
4. **When creating permissions**: Use BasePermission, not domain-specific imports
5. **When writing tests**: Add architecture tests for new patterns

## For Code Review

1. **Check dependency direction**: Core should not import domain
2. **Check service size**: Services should be focused, not god-classes
3. **Check permission imports**: Use Core permissions, not domain-specific
4. **Check test coverage**: Architecture tests should pass

# Related ADRs

- [ADR-0002](ADR-0002-layered-architecture.md): Layered Architecture
- [ADR-0003](ADR-0003-service-selector-pattern.md): Service & Selector Pattern
- [ADR-0004](ADR-0004-domain-driven-design.md): Domain-Driven Design
- [ADR-0005](ADR-0005-event-driven-architecture.md): Event-Driven Architecture
- [ADR-0017](ADR-0017-permission-authorization-model.md): Permission & Authorization Model

# References

- [Clean Architecture - Robert C. Martin](https://blog.cleancoder.com/uncle-bob/2012/08/13/the-clean-architecture.html)
- [Domain-Driven Design - Eric Evans](https://www.oreilly.com/library/view/domain-driven-design-tackling/9780321125217/)
- [Shared Kernel - Martin Fowler](https://martinfowler.com/bliki/SharedKernel.html)
- [Dependency Inversion Principle - Robert C. Martin](https://blog.cleancoder.com/uncle-bob/2016/10/21/dependency-inversion-principle.html)
