"""OpenAPI contract of the masterdata paths (PLAN WP 8.3, finding M7).

A snapshot of ``{path: {method: [response codes]}}`` for every masterdata path. It catches an
operation that appears, disappears or changes its documented statuses. After an intended change,
regenerate it:

    UPDATE_SCHEMA_SNAPSHOT=1 uv run pytest apps/masterdata/tests/api/test_schema_snapshot.py
"""

from __future__ import annotations

import json
import os
from pathlib import Path

import pytest
from drf_spectacular.generators import SchemaGenerator

pytestmark = pytest.mark.django_db

SNAPSHOT = Path(__file__).with_name("schema_snapshot.json")
PREFIXES = (
    "/api/v1/platform/",
    *(
        f"/api/v1/{name}/"
        for name in (
            "departments",
            "teams",
            "team-memberships",
            "offices",
            "positions",
            "people",
            "clients",
            "vendors",
            "client-contacts",
            "vendor-contacts",
            "client-contracts",
            "vendor-contracts",
        )
    ),
)
HTTP = ("get", "post", "put", "patch", "delete")


@pytest.fixture(scope="module")
def schema(django_db_blocker):
    with django_db_blocker.unblock():
        return SchemaGenerator().get_schema(request=None, public=True)


def masterdata_paths(schema):
    return {p: ops for p, ops in schema["paths"].items() if p.startswith(PREFIXES)}


def summarize(schema):
    return {
        path: {m: sorted(ops[m]["responses"]) for m in HTTP if m in ops}
        for path, ops in sorted(masterdata_paths(schema).items())
    }


def test_the_documented_operations_match_the_snapshot(schema):
    current = summarize(schema)
    if os.environ.get("UPDATE_SCHEMA_SNAPSHOT"):
        SNAPSHOT.write_text(json.dumps(current, indent=1, sort_keys=True) + "\n")
    expected = json.loads(SNAPSHOT.read_text())
    assert current == expected, (
        "The masterdata OpenAPI paths changed. If that is intended, regenerate the snapshot "
        "(see this module's docstring) and review the diff."
    )


def test_every_masterdata_operation_documents_its_error_statuses(schema):
    for path, ops in masterdata_paths(schema).items():
        for method in HTTP:
            if method not in ops:
                continue
            codes = set(ops[method]["responses"])
            assert "401" in codes, (method, path)
            if method != "get":
                assert {"403", "409"} <= codes, (method, path)
            if method in ("post", "put", "patch") and "reorder" not in path:
                assert "400" in codes, (method, path)
            if "{id}" in path or "_pk}" in path:
                assert "404" in codes, (method, path)


def test_catalog_delete_documents_both_outcomes(schema):
    delete = schema["paths"]["/api/v1/platform/master-data/task-types/{id}"]["delete"]
    assert {"200", "204"} <= set(delete["responses"])
    names = [p["name"] for p in delete["parameters"]]
    assert "hard" in names


def test_directory_delete_documents_204_and_the_hard_flag(schema):
    delete = schema["paths"]["/api/v1/departments/{id}/"]["delete"]
    assert "204" in delete["responses"] and "200" not in delete["responses"]
    assert "hard" in [p["name"] for p in delete["parameters"]]


def test_archive_and_restore_document_the_success_envelope(schema):
    for action in ("archive", "restore"):
        op = schema["paths"][f"/api/v1/platform/master-data/task-types/{{id}}/{action}"]["post"]
        ref = op["responses"]["200"]["content"]["application/json"]["schema"]["$ref"]
        assert ref.endswith("/ActionResult")


def test_restore_takes_no_request_body(schema):
    op = schema["paths"]["/api/v1/departments/{id}/restore/"]["post"]
    assert "requestBody" not in op


def test_actions_document_their_request_bodies(schema):
    link = schema["paths"]["/api/v1/people/{id}/link-user/"]["post"]
    assert link["requestBody"]["content"]["application/json"]["schema"]["$ref"].endswith(
        "/LinkUser"
    )
    adjust = schema["paths"]["/api/v1/client-contracts/{id}/adjust-end-date/"]["post"]
    assert "AdjustEndDate" in adjust["requestBody"]["content"]["application/json"]["schema"]["$ref"]


def test_the_overview_is_documented_without_the_removed_key(schema):
    props = schema["components"]["schemas"]["PlatformOverview"]["properties"]
    assert "total_custom_records_across_orgs" not in props
    assert {"global_software_count", "system_health", "last_definition_update"} <= set(props)


def test_error_components_exist(schema):
    components = schema["components"]["schemas"]
    assert {"ErrorBody", "ValidationErrorBody", "SuccessMessage"} <= set(components)
