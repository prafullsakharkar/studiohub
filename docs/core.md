API Foundation — apps/core/api

Purpose
-------
Provide a small, stable, and reusable DRF foundation for the StudioHub backend. The Core API layer offers generic serializers, view/viewset bases, response builders, pagination, and lightweight utilities that domain applications can compose.

Guiding principles
------------------
- Keep Core domain-agnostic and reusable.
- Views must not contain business logic; they should delegate to serializers, selectors (read), and services (write/use-cases).
- Keep the public surface small and stable: Base serializers, Base viewsets, ResponseBuilder, and Base pagination primitives.
- Prefer composition over inheritance for domain-specific behaviours.

Public foundations
------------------
- apps.core.api.serializers.base
  - BaseModelSerializer, BaseReadSerializer, BaseWriteSerializer, BaseNestedSerializer

- apps.core.api.viewsets.base
  - BaseViewSet (root GenericViewSet with standard mixins)
  - ServiceModelViewSet (read via selector, write via service)

- apps.core.api.builders.response
  - ResponseBuilder.success / error — standardized response payloads

- apps.core.api.pagination.base
  - BaseAPIPagination — shared pagination helpers

Stability guarantees
--------------------
- These primitives should remain stable across releases. Domain apps may rely on them.
- If changes are required, prefer additive changes and provide compatibility aliases where practical.

Duplication and consolidation
-----------------------------
- The codebase contains multiple pagination implementations (page number, cursor, limit/offset, infinite). These are retained but organized under apps.core.api.pagination.
- Response construction is centralized in ResponseBuilder to avoid duplicated response shapes across view code.

Developer guidance
------------------
- When creating a new view/use-case, compose:
  - Serializer for input/validation
  - Selector for read/query operations (if needed)
  - Service for write/use-case operations (mutations)
  - View/ViewSet should orchestrate serializer & service/selector only — avoid implementing business workflows inside views.

Testing
-------
- A new meta-level test asserts that the core foundations (base serializers, base viewsets, response builder, pagination helper) exist and expose the expected API surface. These tests live in backend/apps/core/tests/test_api_foundation.py.

Migration notes
---------------
- If future decisions move specific API helpers to domain apps, provide compatibility re-exports in core and deprecation warnings for one release before removal.

Reference
---------
See apps/core/api/ for the concrete implementations and mixins.
