"""The scheduling actions declare their real request bodies and answers in the OpenAPI schema."""

from __future__ import annotations

import pytest
from drf_spectacular.generators import SchemaGenerator

pytestmark = pytest.mark.django_db

BASE = "/api/v1/scheduling"


@pytest.fixture(scope="module")
def schema(django_db_blocker):
    with django_db_blocker.unblock():
        return SchemaGenerator().get_schema(request=None, public=True)


def _ref(node) -> str:
    return node["$ref"].rsplit("/", 1)[-1]


def _body(schema, path, method="post"):
    return schema["paths"][path][method]["requestBody"]["content"]["application/json"]["schema"]


def _properties(schema, path) -> set[str]:
    return set(schema["components"]["schemas"][_ref(_body(schema, path))]["properties"])


def test_approve_declares_the_override_reason(schema):
    assert _properties(schema, f"{BASE}/leaves/{{uuid}}/approve/") == {"override_reason"}


def test_reject_declares_both_spellings_of_the_reason_and_the_override(schema):
    assert _properties(schema, f"{BASE}/leaves/{{uuid}}/reject/") == {
        "rejection_reason",
        "reason",
        "override_reason",
    }


def test_event_status_update_declares_its_status(schema):
    assert _properties(schema, f"{BASE}/events/{{uuid}}/update-status/") == {"status"}


def test_bulk_delete_declares_its_body_and_both_answers(schema):
    path = f"{BASE}/schedules/bulk-delete/"

    assert _properties(schema, path) == {"ids"}
    answers = schema["paths"][path]["post"]["responses"]
    assert {"200", "207"} <= set(answers)
    component = schema["components"]["schemas"][
        _ref(answers["207"]["content"]["application/json"]["schema"])
    ]
    assert set(component["properties"]) == {"success", "succeeded_count", "failed_count", "results"}


@pytest.mark.parametrize(
    "path",
    [
        "calendars/",
        "calendars/{uuid}/set-default/",
        "milestones/",
        "milestones/{uuid}/complete/",
        "milestones/{uuid}/reopen/",
        "capacity/",
        "overbooking/",
        "resolve-overbooking/",
    ],
)
def test_the_phase_9_and_10_routes_are_in_the_schema(schema, path):
    assert f"{BASE}/{path}" in schema["paths"]
