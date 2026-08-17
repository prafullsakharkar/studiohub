# Core Module — API Foundation

## Overview

`apps.core.api` is the **shared API kernel** for StudioHub. It provides a small,
stable, reusable foundation that every domain app (`identity`, `organization`,
and future domains) builds upon. It follows the modular-monolith architecture
(ADR-0004) and the service/selector pattern (ADR-0003).

The API layer is intentionally thin: **views must not contain business logic**.
The request lifecycle is:

```text
HTTP Request
      │
Authentication
      │
Permission Check
      │
APIView / ViewSet
      │
Serializer
      │
Service / Selector
      │
Database
      │
Serializer
      │
HTTP Response
```

---

## Dependency Direction

Core is the shared kernel. The dependency rule is **Domain → Core**:

- Domain apps **may** import from `apps.core.api`.
- Core **must NOT** import from any domain app (`identity`, `organization`, …).

This is enforced by architecture tests in
[`apps/core/tests/test_architecture.py`](../../backend/apps/core/tests/test_architecture.py).

Domain-specific concerns (organization/project/reviewer permissions, domain
exceptions, domain filters) **do not** belong in Core. They live in their
respective domain apps.

---

## Package Layout

```text
apps/core/api/
├── __init__.py          # re-exports the public surface
├── constants.py
├── builders/            # response / pagination / export payload builders
├── exceptions/          # API exceptions + global handler
├── mixins/              # reusable view/serializer mixins
├── pagination/          # page-number, limit-offset, cursor, infinite
├── permissions/         # generic, domain-agnostic permissions
├── renderers/           # JSON / CSV / Excel renderers
├── serializers/         # base serializers + common fields
├── utils/               # request / serializer helpers
├── views/               # BaseAPIView
└── viewsets/            # BaseViewSet, CRUD, read-only, nested, bulk, service
```

---

## Builders

Builders standardize response and pagination payloads so every endpoint returns
a consistent envelope.

| Class | Purpose |
| --- | --- |
| [`ResponseBuilder`](../../backend/apps/core/api/builders/response.py) | Standardized `success` / `error` envelopes |
| [`PaginationBuilder`](../../backend/apps/core/api/builders/pagination.py) | Standardized pagination metadata |
| [`ExportBuilder`](../../backend/apps/core/api/builders/export.py) | Standardized export payloads |

### Success envelope

```json
{
  "success": true,
  "data": { },
  "meta": { }
}
```

### Error envelope

```json
{
  "success": false,
  "error": {
    "code": "validation_error",
    "message": "…",
    "errors": { }
  }
}
```

---

## Exceptions

Core provides a small set of generic API exceptions and a single global handler.

| Exception | HTTP Status |
| --- | --- |
| `BadRequestException` | 400 |
| `AuthenticationException` | 401 |
| `PermissionDeniedException` | 403 |
| `NotFoundException` | 404 |
| `ConflictException` | 409 |
| `ResourceLockedException` | 423 |
| `RateLimitException` | 429 |
| `ServiceUnavailableException` | 503 |
| `ValidationException` | 400 |
| `InvalidCredentials` / `UserInactive` / `EmailNotVerified` / `PasswordExpired` | 401 |

The global handler is
[`custom_exception_handler`](../../backend/apps/core/api/exceptions/handlers.py),
configured in DRF settings as `EXCEPTION_HANDLER`. It converts handled
exceptions into the standardized error envelope and returns `500` for
unhandled exceptions.

Domain-specific exceptions (e.g. organization/project permission errors) are
**not** part of Core; they belong to their domain apps.

---

## Serializers

Core provides generic serializer bases and common fields. Domain apps define
their own domain serializers on top of these.

### Base serializers

| Class | Purpose |
| --- | --- |
| `BaseSerializer` | Root serializer with `request` / `user` shortcuts |
| `BaseModelSerializer` | Model serializer with `request` / `user` shortcuts |
| `BaseReadSerializer` | Read-only model serializer |
| `BaseWriteSerializer` | Write serializer delegating persistence to services |
| `BaseNestedSerializer` | Nested read serializer |
| `BaseListSerializer` | List serializer supporting bulk `create` / `update` |
| `BulkModelSerializer` | Model serializer wired to `BaseListSerializer` for bulk ops |

### Common fields

| Field | Purpose |
| --- | --- |
| `LowercaseEmailField` | Email normalized to lowercase |
| `UppercaseCharField` | Char normalized to uppercase |
| `TrimmedCharField` | Char with whitespace trimmed |
| `ChoiceDisplayField` | Exposes the display value of a choice |

### Bulk support

Bulk create/update is supported through `BaseListSerializer` and
`BulkModelSerializer`:

```python
class ItemSerializer(BulkModelSerializer):
    class Meta:
        model = Item
        fields = ["name"]

    def bulk_update(self, instance_list, validated_data):
        # optional: implement efficient bulk update
        ...
```

---

## Views & Viewsets

Core prefers a small, stable set of view/viewset bases rather than many
near-identical CRUD abstractions.

### Views

| Class | Purpose |
| --- | --- |
| `BaseAPIView` | Root APIView with serializer helpers and context injection |

### Viewsets

| Class | Purpose |
| --- | --- |
| `BaseViewSet` | Root ViewSet (permission map, response/context/error mixins) |
| `BaseModelViewSet` | Full CRUD ViewSet (`lookup_field = "uuid"`) |
| `ReadOnlyModelViewSet` | Read-only (list + retrieve) ViewSet |
| `NestedModelViewSet` | ViewSet for nested resources |
| `ServiceModelViewSet` | Declarative service-driven ViewSet |
| `BulkModelViewSet` | CRUD ViewSet with bulk create/update support |

### ServiceModelViewSet

The preferred declarative ViewSet. Domain apps configure:

```python
class DepartmentViewSet(ServiceModelViewSet):
    selector_class = DepartmentSelector
    service_class = DepartmentService
    serializer_map = {
        "list": DepartmentListSerializer,
        "retrieve": DepartmentDetailSerializer,
        "create": DepartmentWriteSerializer,
    }
    permission_map = {
        "create": ("department.create",),
        "update": ("department.update",),
    }
```

Business logic lives in **Services**; read logic lives in **Selectors**.

### Bulk mixins

| Mixin | Purpose |
| --- | --- |
| `BulkCreateModelMixin` | `create` accepting a list of payloads |
| `BulkUpdateModelMixin` | `update` / `partial_update` accepting a list |

---

## Pagination

Core retains the pagination strategies that are genuinely required, each
standardized through `PaginationBuilder`.

| Class | Strategy |
| --- | --- |
| `StandardPagination` | Page-number (`page` / `page_size`) — the default |
| `StandardLimitOffsetPagination` | Limit/offset |
| `StandardCursorPagination` | Cursor-based |
| `InfinitePagination` | No pagination (all records) |

The default pagination class is configured in DRF settings as
`apps.core.api.pagination.StandardPagination` with `PAGE_SIZE = 20`.

---

## Filtering

Core does **not** ship domain filters. Filtering is generic and delegated to
DRF's `DjangoFilterBackend`, `OrderingFilter`, and `SearchFilter` (configured
in DRF settings). Domain-specific filters belong to their domain apps.

---

## Permissions

Core provides only **generic, domain-agnostic** permissions.

| Class | Purpose |
| --- | --- |
| `BasePermission` | Root permission base |
| `IsOwner` | Object-level ownership check |
| `IsStaff` | Staff-only |
| `IsSuperUser` | Superuser-only |
| `ReadOnlyPermission` | Read-only access |
| `PermissionMapPermission` | Action → permission map resolution |
| `PermissionResolver` | Resolves required permissions |

Domain-specific permissions (organization, project, reviewer) live in their
domain apps, e.g. `apps.identity.permissions`.

---

## Renderers

| Class | Media Type |
| --- | --- |
| `StandardJSONRenderer` | `application/json` (default) |
| `CSVRenderer` | `text/csv` |
| `ExcelRenderer` | `application/vnd.openxmlformats-officedocument.spreadsheetml.sheet` |

---

## Mixins

Reusable mixins compose view behavior:

| Mixin | Purpose |
| --- | --- |
| `AuditMixin` | Audit on create/update |
| `ContextMixin` | Serializer context injection |
| `DynamicFieldsMixin` | Request-driven field selection |
| `ErrorMixin` | Exception logging |
| `FilteringMixin` | Filtering hooks |
| `MetadataMixin` | Metadata hooks |
| `PaginationMixin` | Pagination hooks |
| `PermissionMixin` | Permission hooks |
| `QuerysetMixin` | Queryset hooks |
| `ResponseMixin` | Standardized success/error responses |
| `ServiceMixin` | Service resolution + perform hooks |
| `ValidationMixin` | Validation hooks |

---

## Utils

| Class | Purpose |
| --- | --- |
| `RequestUtils` | Request helpers (e.g. client IP) |
| `SerializerUtils` | Serializer helpers (e.g. field updates) |

---

## Public API Surface

All public classes are re-exported from
[`apps/core/api/__init__.py`](../../backend/apps/core/api/__init__.py) and the
sub-package `__init__.py` files. This surface is treated as a **stable
contract** and is guarded by architecture tests.

---

## Testing

The API foundation is covered by
[`apps/core/tests/test_api.py`](../../backend/apps/core/tests/test_api.py)
(response builders, exception handler, serializers, views, viewsets, bulk
support) and
[`apps/core/tests/test_architecture.py`](../../backend/apps/core/tests/test_architecture.py)
(dependency direction and public API stability).

Run the API foundation tests:

```bash
cd backend
.venv/bin/python -m pytest apps/core/tests/test_api.py apps/core/tests/test_architecture.py -o addopts=""
```

> Note: DB-dependent core tests (models, querysets, selectors, services)
> require a PostgreSQL test database. The `studio` DB user must have the
> `CREATEDB` privilege for the test database to be created automatically.
