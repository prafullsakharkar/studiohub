"""People and positions: personal data is gated field by field (H1, SEC-MD-02)."""

from __future__ import annotations

import pytest
from rest_framework.test import APIClient

from apps.identity.tests.factories import UserFactory
from apps.identity.tests.rbac_helpers import grant_permissions
from apps.masterdata.constants.permissions import MasterdataPermissions as P
from apps.masterdata.models import Person, Position

pytestmark = pytest.mark.django_db

API = "/api/v1"
PERSON_HIDDEN = ("email", "phone", "date_of_birth", "nationality", "security_clearance")


def client_for(*codes):
    user = UserFactory.create()
    if codes:
        grant_permissions(user, *codes)
    api = APIClient(raise_request_exception=False)
    api.force_authenticate(user=user)
    return api


@pytest.fixture
def person():
    return Person.objects.create(
        name="Jane Doe",
        email="jane@x.io",
        phone="+1 555 0100",
        nationality="CA",
        security_clearance="tier-2",
    )


def test_a_plain_reader_sees_no_personal_fields(person):
    reader = client_for()
    body = reader.get(f"{API}/people/{person.pk}/").json()
    assert body["name"] == "Jane Doe"
    assert not set(PERSON_HIDDEN) & set(body)
    row = reader.get(f"{API}/people/").json()["results"][0]
    assert not set(PERSON_HIDDEN) & set(row)


def test_the_sensitive_permission_reveals_them(person):
    body = client_for(P.PERSON_VIEW_SENSITIVE).get(f"{API}/people/{person.pk}/").json()
    assert set(PERSON_HIDDEN) <= set(body)
    assert body["email"] == "jane@x.io"


@pytest.mark.parametrize("field", PERSON_HIDDEN)
def test_a_writer_without_the_permission_cannot_set_a_hidden_field(person, field):
    writer = client_for(P.DIRECTORY_MANAGE)
    response = writer.patch(f"{API}/people/{person.pk}/", {field: "x"}, format="json")
    assert response.status_code == 403
    person.refresh_from_db()
    assert getattr(person, field) != "x"


def test_a_writer_without_the_permission_edits_ordinary_fields_and_nulls_nothing(person):
    writer = client_for(P.DIRECTORY_MANAGE)
    assert writer.patch(f"{API}/people/{person.pk}/", {"description": "d"}).status_code == 200
    put = writer.put(f"{API}/people/{person.pk}/", {"name": "Jane D"}, format="json")
    assert put.status_code == 200, put.content
    person.refresh_from_db()
    assert (person.email, person.phone, person.nationality) == ("jane@x.io", "+1 555 0100", "CA")


@pytest.mark.parametrize(
    "query",
    ["?email=jane@x.io", "?phone=555", "?ordering=email", "?ordering=-security_clearance"],
)
def test_hidden_fields_cannot_be_probed_by_filter_or_ordering(person, query):
    assert client_for().get(f"{API}/people/{query}").status_code == 403


def test_search_does_not_reach_hidden_fields(person):
    assert client_for().get(f"{API}/people/?search=jane@x").json()["count"] == 0
    assert client_for().get(f"{API}/people/?search=Jane").json()["count"] == 1
    assert (
        client_for(P.PERSON_VIEW_SENSITIVE).get(f"{API}/people/?search=jane@x").json()["count"] == 1
    )


def test_position_salary_range_is_gated():
    row = Position.objects.create(code="SUP", name="Supervisor", salary_range="100-200")
    assert "salary_range" not in client_for().get(f"{API}/positions/{row.pk}/").json()
    revealed = client_for(P.PERSON_VIEW_SENSITIVE).get(f"{API}/positions/{row.pk}/").json()
    assert revealed["salary_range"] == "100-200"
    assert client_for().get(f"{API}/positions/?ordering=salary_range").status_code == 403
    writer = client_for(P.DIRECTORY_MANAGE)
    assert (
        writer.patch(
            f"{API}/positions/{row.pk}/", {"salary_range": "1-2"}, format="json"
        ).status_code
        == 403
    )
