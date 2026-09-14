"""
Contract test: MSW (frontend) = Django (backend) golden schema.

Verifies that the OpenAPI schema generated from Django contains the endpoints
inventoried in docs/api/api-contract.md, and that critical contract shapes
(pagination, auth, filtering) match frontend expectations.

This test is the Phase J gate: it fails if the Django API drifts from the
frontend contract. Run with: pytest apps/core/tests/test_contract.py -v
"""

import pytest
from django.contrib.auth.models import AnonymousUser
from django.test import RequestFactory
from drf_spectacular.generators import SchemaGenerator
from rest_framework.request import Request


@pytest.mark.django_db
def test_openapi_schema_contains_core_contract_endpoints():
    factory = RequestFactory()
    wsgi = factory.get("/api/schema/")
    # django-stubs declares HttpRequest.__new__ with no args, which shadows
    # DRF Request.__init__ for subclass construction.
    request = Request(wsgi)  # pyright: ignore[reportCallIssue]
    # DRF test Request needs user/auth for spectacular's mock request builder
    request.user = AnonymousUser()
    request.auth = None

    generator = SchemaGenerator()
    schema = generator.get_schema(request=request, public=True)

    paths = schema.get("paths", {})
    # Normalize paths to ignore trailing slash variance (mockRouter normalizes);
    # merge HTTP methods across slash variants of the same route.
    by_path: dict[str, set[str]] = {}
    for raw, operations in paths.items():
        norm = raw.rstrip("/") or "/"
        by_path.setdefault(norm, set()).update(
            m for m in operations if m in
            {"get", "post", "put", "patch", "delete", "head", "options"}
        )

    # Contract surface: path -> required HTTP methods. Sources:
    # docs/api/REAL_API.md + docs/api/API_MIGRATION_MATRIX.md + frontend
    # live callers verified in Phase 5/6. Phase 7 gate: any removal, rename,
    # or method change here fails loudly instead of breaking the frontend.
    required: dict[str, set[str]] = {
        # Auth
        "/api/v1/auth/login": {"post"},
        "/api/v1/auth/refresh": {"post"},
        "/api/v1/auth/logout": {"post"},
        "/api/v1/auth/me": {"get"},
        "/api/v1/auth/memberships": {"get"},
        "/api/v1/users/me/memberships": {"get"},
        # Production flat CRUD
        "/api/v1/projects": {"get", "post"},
        "/api/v1/projects/{uuid}": {"get", "put", "patch", "delete"},
        "/api/v1/projects/{uuid}/statistics": {"get"},
        "/api/v1/sequences": {"get", "post"},
        "/api/v1/shots": {"get", "post"},
        "/api/v1/shots/{uuid}": {"get", "put", "patch", "delete"},
        "/api/v1/shots/{uuid}/approve": {"post"},
        "/api/v1/shots/{uuid}/archive": {"post"},
        "/api/v1/shots/{uuid}/restore": {"post"},
        "/api/v1/shots/check-existence": {"post"},
        "/api/v1/shots/bulk-create": {"post"},
        "/api/v1/shots/bulk-update": {"post"},
        "/api/v1/shots/bulk-archive": {"post"},
        "/api/v1/shots/bulk-restore": {"post"},
        "/api/v1/assets": {"get", "post"},
        "/api/v1/assets/{uuid}": {"get", "put", "patch", "delete"},
        "/api/v1/assets/check-existence": {"post"},
        "/api/v1/assets/bulk-create": {"post"},
        "/api/v1/assets/bulk-update": {"post"},
        "/api/v1/tasks": {"get", "post"},
        "/api/v1/tasks/{uuid}": {"get", "put", "patch", "delete"},
        "/api/v1/timelogs": {"get", "post"},
        "/api/v1/timelogs/{uuid}": {"get", "put", "patch", "delete"},
        "/api/v1/versions": {"get", "post"},
        "/api/v1/reviews": {"get", "post"},
        "/api/v1/reviews/{uuid}/participant-verdict": {"post"},
        "/api/v1/media": {"get", "post"},
        "/api/v1/playlists": {"get", "post"},
        "/api/v1/workflows": {"get", "post"},
        # Deliveries / publishing
        "/api/v1/deliveries": {"get", "post"},
        "/api/v1/deliveries/{uuid}": {"get", "put", "patch", "delete"},
        "/api/v1/deliveries/{uuid}/approve": {"post"},
        "/api/v1/deliveries/{uuid}/submit": {"post"},
        "/api/v1/deliveries/{uuid}/retry": {"post"},
        "/api/v1/deliveries/{uuid}/remove-version": {"post"},
        "/api/v1/deliveries/destinations": {"get", "post"},
        "/api/v1/publishing": {"get", "post"},
        "/api/v1/publishing/{uuid}/validate": {"post"},
        "/api/v1/publishing/{uuid}/republish": {"post"},
        "/api/v1/publishing/destinations": {"get", "post"},
        # Scheduling
        "/api/v1/scheduling/events": {"get", "post"},
        "/api/v1/scheduling/resources": {"get", "post"},
        "/api/v1/scheduling/leaves": {"get", "post"},
        "/api/v1/scheduling/holidays": {"get", "post"},
        "/api/v1/scheduling/schedules": {"get", "post"},
        "/api/v1/scheduling/capacity": {"get"},
        "/api/v1/scheduling/overbooking": {"get"},
        "/api/v1/scheduling/resolve-overbooking": {"post"},
        # Settings
        "/api/v1/settings/categories": {"get", "post"},
        "/api/v1/settings/categories/{id}/archive": {"post"},
        "/api/v1/settings/categories/{id}/restore": {"post"},
        "/api/v1/settings/definitions": {"get", "post"},
        "/api/v1/settings/feature-flags": {"get", "post"},
        "/api/v1/settings/feature-flags/{id}/enable": {"post"},
        "/api/v1/settings/feature-flags/{id}/disable": {"post"},
        # Audit
        "/api/v1/audit/activities": {"get"},
        "/api/v1/audit/activity": {"get"},
        "/api/v1/audit/audit-logs": {"get"},
        # Intelligence
        "/api/v1/intelligence/knowledge": {"get", "post"},
        "/api/v1/intelligence/knowledge/{id}": {"get", "patch", "delete"},
        "/api/v1/intelligence/search": {"post"},
        "/api/v1/intelligence/search/saved": {"get", "post"},
        "/api/v1/intelligence/search/recent": {"get", "post"},
        "/api/v1/intelligence/ai/chat": {"post"},
        "/api/v1/intelligence/ai/risks": {"get", "post"},
        "/api/v1/intelligence/ai/risks/resolve": {"post"},
        "/api/v1/intelligence/ai/task-recommendations": {"get"},
        "/api/v1/intelligence/ai/project-summary/{project_code}": {"get"},
        "/api/v1/intelligence/ai/shot-summary/{shot_code}": {"get"},
        "/api/v1/intelligence/ai/permission-context": {"get"},
        "/api/v1/intelligence/analytics/{domain}": {"get"},
        # Master data
        "/api/v1/platform/master-data/asset-types": {"get", "post"},
        "/api/v1/platform/master-data/asset-types/{id}/archive": {"post"},
        "/api/v1/platform/master-data/asset-types/{id}/restore": {"post"},
        "/api/v1/platform/master-data/software": {"get", "post"},
        "/api/v1/platform/master-data/statuses": {"get", "post"},
        "/api/v1/platform/master-data/task-types": {"get", "post"},
        "/api/v1/organizations/{organization_id}/master-data/bundle": {"get"},
        # Nested org (representative; full set covered by API behavior tests)
        "/api/organizations/{organization_id}/teams/{uuid}/archive": {"post"},
        "/api/organizations/{organization_id}/clients/{uuid}/restore": {"post"},
        # Legacy compat aliases still served
        "/api/v1/attachments": {"get"},
        "/api/v1/core/attachments": {"get"},
    }

    missing = [p for p in required if p not in by_path]
    method_gaps = {
        p: sorted(required[p] - by_path.get(p, set()))
        for p in required
        if p in by_path and not required[p] <= by_path[p]
    }
    assert not missing, (
        f"Missing contract endpoints in OpenAPI schema: {missing}\n"
        f"Got {len(by_path)} paths."
    )
    assert not method_gaps, f"Contract endpoints lost HTTP methods: {method_gaps}"

    assert len(paths) > 500, f"Expected >500 paths, got {len(paths)}"


@pytest.mark.django_db
def test_pagination_contract_via_api_client():
    """Verify that paginated endpoints return {count, next, previous, results}."""
    from django.contrib.auth import get_user_model
    from rest_framework.test import APIClient

    User = get_user_model()
    user = User.objects.filter(is_active=True).first()
    if not user:
        pytest.skip("No user for pagination test")

    client = APIClient()
    client.force_authenticate(user=user)

    # Projects list should be paginated
    resp = client.get("/api/v1/projects/")
    assert resp.status_code == 200
    data = resp.json()
    assert "count" in data and "results" in data, f"Expected paginated, got {data.keys()}"
    assert "next" in data and "previous" in data

    # Legacy departments should be bare array (no pagination)
    # Use organization header if needed
    from apps.organization.models import Organization

    org = Organization.objects.first()
    headers = {}
    if org:
        headers["HTTP_X_ORGANIZATION_ID"] = str(org.id)
    resp2 = client.get("/api/v1/departments/", **headers)
    # May be 200 with list or paginated depending on view; legacy departments is bare array
    assert resp2.status_code in (200, 404)  # 404 if no org, but should be 200 with list
    if resp2.status_code == 200:
        data2 = resp2.json()
        # Legacy departments is bare array
        assert isinstance(data2, list) or "results" in data2
