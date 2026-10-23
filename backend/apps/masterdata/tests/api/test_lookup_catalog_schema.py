"""The OpenAPI schema still builds with the lookup viewsets (full accuracy is WP 8.3)."""

from __future__ import annotations

import pytest
from drf_spectacular.generators import SchemaGenerator

pytestmark = pytest.mark.django_db

BASE = "/api/v1/platform/master-data"
SLUGS = [
    "statuses",
    "task-types",
    "asset-types",
    "shot-types",
    "review-types",
    "file-types",
    "software",
]


@pytest.fixture(scope="module")
def schema(django_db_blocker):
    with django_db_blocker.unblock():
        return SchemaGenerator().get_schema(request=None, public=True)


@pytest.mark.parametrize("slug", SLUGS)
def test_every_catalog_route_is_documented(schema, slug):
    paths = schema["paths"]
    assert {"get", "post"} <= set(paths[f"{BASE}/{slug}"])
    assert {"get", "put", "patch", "delete"} <= set(paths[f"{BASE}/{slug}/{{id}}"])
    assert "post" in paths[f"{BASE}/{slug}/{{id}}/archive"]
    assert "post" in paths[f"{BASE}/{slug}/{{id}}/restore"]
    assert "post" in paths[f"{BASE}/{slug}/reorder"]


def test_scope_is_documented_as_global_only(schema):
    scope = schema["components"]["schemas"]["MasterTaskType"]["properties"]["scope"]
    assert "GLOBAL" in str(scope) and "ORGANIZATION" not in str(scope)


def test_nested_software_versions_are_documented(schema):
    paths = schema["paths"]
    assert {"get", "post"} <= set(paths[f"{BASE}/software/{{software_pk}}/versions"])
    detail = paths[f"{BASE}/software/{{software_pk}}/versions/{{id}}"]
    assert {"get", "put", "patch", "delete"} <= set(detail)
    assert "post" in paths[f"{BASE}/software/{{software_pk}}/versions/{{id}}/archive"]
    assert "post" in paths[f"{BASE}/software/{{software_pk}}/versions/{{id}}/restore"]


def test_version_is_documented_with_its_read_only_and_optional_fields(schema):
    version = schema["components"]["schemas"]["SoftwareVersion"]
    assert "is_deprecated" in version["properties"] and version["properties"]["is_deprecated"].get(
        "readOnly"
    )
    assert "code" not in version.get("required", []) and "name" not in version.get("required", [])


PARTNER_ROUTES = ["clients", "vendors", "client-contacts", "vendor-contacts"]
CONTRACT_ROUTES = ["client-contracts", "vendor-contracts"]


@pytest.mark.parametrize("slug", PARTNER_ROUTES + CONTRACT_ROUTES)
def test_partner_routes_are_documented(schema, slug):
    paths = schema["paths"]
    assert {"get", "post"} <= set(paths[f"/api/v1/{slug}/"])
    assert {"get", "put", "patch", "delete"} <= set(paths[f"/api/v1/{slug}/{{id}}/"])
    assert "post" in paths[f"/api/v1/{slug}/{{id}}/restore/"]


@pytest.mark.parametrize("slug", CONTRACT_ROUTES)
def test_contract_actions_are_documented(schema, slug):
    paths = schema["paths"]
    for action in ("activate", "terminate", "adjust-end-date"):
        assert "post" in paths[f"/api/v1/{slug}/{{id}}/{action}/"], action
