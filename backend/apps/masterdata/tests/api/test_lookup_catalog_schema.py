"""The OpenAPI schema still builds with the lookup viewsets (full accuracy is WP 8.3)."""

from __future__ import annotations

import pytest
from drf_spectacular.generators import SchemaGenerator

pytestmark = pytest.mark.django_db

BASE = "/api/v1/platform/master-data"
SLUGS = ["statuses", "task-types", "asset-types", "shot-types", "review-types", "file-types"]


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
