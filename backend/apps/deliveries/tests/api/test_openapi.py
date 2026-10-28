"""The delivery endpoints appear in the OpenAPI schema with their real request bodies and answers."""

from __future__ import annotations

import pytest
from drf_spectacular.generators import SchemaGenerator

pytestmark = pytest.mark.django_db

BASE = "/api/v1/deliveries"


@pytest.fixture(scope="module")
def schema(django_db_blocker):
    with django_db_blocker.unblock():
        return SchemaGenerator().get_schema(request=None, public=True)


def _ref(node) -> str:
    return node["$ref"].rsplit("/", 1)[-1]


def _request_body(schema, path, method="post") -> str:
    return _ref(
        schema["paths"][path][method]["requestBody"]["content"]["application/json"]["schema"]
    )


def _answer(schema, path, status, method="post"):
    return schema["paths"][path][method]["responses"][status]["content"]["application/json"][
        "schema"
    ]


@pytest.mark.parametrize(
    ("action", "component"),
    [
        ("add-version", "DeliveryAddVersion"),
        ("remove-version", "DeliveryRemoveVersion"),
        ("sign-off", "DeliverySignOff"),
        ("approve", "DeliveryApprove"),
        ("reject", "DeliveryReject"),
        ("cancel", "DeliveryCancel"),
        ("submit", "DeliverySubmit"),
    ],
)
def test_actions_declare_their_bodies(schema, action, component):
    assert _request_body(schema, f"{BASE}/{{uuid}}/{action}/") == component


@pytest.mark.parametrize("action", ["retry", "complete"])
def test_actions_that_take_no_body_declare_none(schema, action):
    assert "requestBody" not in schema["paths"][f"{BASE}/{{uuid}}/{action}/"]["post"]


@pytest.mark.parametrize(
    "action",
    [
        "add-version",
        "remove-version",
        "sign-off",
        "reopen",
        "approve",
        "reject",
        "cancel",
        "complete",
        "retry",
    ],
)
def test_state_changing_actions_answer_with_the_detail(schema, action):
    status = "201" if action == "add-version" else "200"

    assert _ref(_answer(schema, f"{BASE}/{{uuid}}/{action}/", status)) == "DeliveryDetail"


def test_revise_answers_201_with_the_new_draft_and_its_skipped_versions(schema):
    answer = _answer(schema, f"{BASE}/{{uuid}}/revise/", "201")
    component = schema["components"]["schemas"][_ref(answer)]

    assert {"skipped_versions", "revision_of", "status"} <= set(component["properties"])


def test_bulk_cancel_declares_its_body_and_both_answers(schema):
    path = f"{BASE}/bulk-cancel/"

    assert _request_body(schema, path) == "DeliveryBulkCancel"
    assert _ref(_answer(schema, path, "200")) == "DeliveryBulkCancelResponse"
    assert _ref(_answer(schema, path, "207")) == "DeliveryBulkCancelResponse"
    body = schema["components"]["schemas"]["DeliveryBulkCancel"]["properties"]
    assert body["ids"]["maxItems"] == 100 and body["ids"]["minItems"] == 1


def test_the_passcode_endpoint_answers_with_one_field(schema):
    answer = _answer(schema, f"{BASE}/{{uuid}}/passcode/", "200", method="get")

    assert set(schema["components"]["schemas"][_ref(answer)]["properties"]) == {"passcode"}


def test_history_and_qc_answer_with_lists(schema):
    for action, item in (("history", "DeliveryStatusChange"), ("qc", "DeliveryQCCheck")):
        answer = _answer(schema, f"{BASE}/{{uuid}}/{action}/", "200", method="get")
        assert answer["type"] == "array" and _ref(answer["items"]) == item


def test_patching_declares_the_update_body_and_answers_with_the_detail(schema):
    patch = schema["paths"][f"{BASE}/{{uuid}}/"]["patch"]
    body = patch["requestBody"]["content"]["application/json"]["schema"]

    assert _ref(body).endswith("DeliveryUpdate")
    assert (
        _ref(patch["responses"]["200"]["content"]["application/json"]["schema"]) == "DeliveryDetail"
    )


def test_the_detail_shows_destination_workflow_and_no_passcode(schema):
    properties = schema["components"]["schemas"]["DeliveryDetail"]["properties"]

    assert {
        "destination",
        "destination_name",
        "has_passcode",
        "has_revoked_content",
        "signed_off_at",
        "rejection_reason",
        "cancellation_reason",
        "revision_of",
        "sent_at",
    } <= set(properties)
    assert "passcode" not in properties
    assert properties["has_revoked_content"]["readOnly"] is True


def test_the_create_body_takes_the_passcode_write_only_and_a_destination_id(schema):
    properties = schema["components"]["schemas"]["DeliveryCreate"]["properties"]

    assert properties["passcode"].get("writeOnly") is True
    assert {"destination_id", "project_id", "client_id"} <= set(properties)


def test_the_alias_spellings_are_write_only(schema):
    for component, alias in (
        ("DeliveryReject", "reason"),
        ("DeliveryApprove", "notes"),
        ("DeliveryCancel", "reason"),
    ):
        assert (
            schema["components"]["schemas"][component]["properties"][alias].get("writeOnly") is True
        )


def test_destination_routes_are_listed(schema):
    assert f"{BASE}/destinations/" in schema["paths"]
    assert f"{BASE}/destinations/{{uuid}}/" in schema["paths"]
