# Django adds <fk>_id attributes and reverse accessors at runtime; no type stubs run here.
# pyright: reportAttributeAccessIssue=false
"""
The frontend's body spellings (decision Q18): `reason` and `notes` are accepted beside the backend's
own names, both at once must agree, and the old spellings keep working.
"""

from __future__ import annotations

import pytest

from apps.deliveries.models import DeliveryPackage
from apps.deliveries.services.package import DeliveryService
from apps.deliveries.tests.helpers import (
    client_for,
    make_package,
    signed_off_package,
)
from apps.identity.tests.factories import UserFactory

pytestmark = pytest.mark.django_db

URL = "/api/v1/deliveries/"


@pytest.fixture
def api():
    return client_for(UserFactory.create(is_superuser=True))


def _sent():
    return DeliveryService.send(actor=UserFactory.create(), package=signed_off_package())


class TestReject:
    def test_the_backend_spelling_works(self, api):
        sent = _sent()

        response = api.post(
            f"{URL}{sent.pk}/reject/", {"rejection_reason": "Too dark"}, format="json"
        )

        assert response.status_code == 200 and response.json()["rejection_reason"] == "Too dark"

    def test_the_frontends_reason_works(self, api):
        sent = _sent()

        response = api.post(f"{URL}{sent.pk}/reject/", {"reason": "Too dark"}, format="json")

        assert response.status_code == 200
        assert response.json()["rejection_reason"] == "Too dark"
        assert DeliveryPackage.objects.get(pk=sent.pk).client_notes == ""

    def test_both_with_the_same_value_work(self, api):
        sent = _sent()

        response = api.post(
            f"{URL}{sent.pk}/reject/",
            {"reason": "Too dark", "rejection_reason": "Too dark"},
            format="json",
        )

        assert response.status_code == 200

    def test_both_with_different_values_are_a_400_and_nothing_changes(self, api):
        sent = _sent()

        response = api.post(
            f"{URL}{sent.pk}/reject/",
            {"reason": "Too dark", "rejection_reason": "Too bright"},
            format="json",
        )

        assert (
            response.status_code == 400 and "Send only one of the two" in response.content.decode()
        )
        assert DeliveryPackage.objects.get(pk=sent.pk).status == "Submitted"

    @pytest.mark.parametrize("body", [{}, {"reason": ""}, {"rejection_reason": "  "}])
    def test_a_missing_or_blank_reason_is_a_400(self, api, body):
        sent = _sent()

        response = api.post(f"{URL}{sent.pk}/reject/", body, format="json")

        assert response.status_code == 400
        assert DeliveryPackage.objects.get(pk=sent.pk).status == "Submitted"


class TestApprove:
    def test_notes_is_the_clients_feedback(self, api):
        sent = _sent()

        response = api.post(f"{URL}{sent.pk}/approve/", {"notes": "Great"}, format="json")

        assert response.status_code == 200 and response.json()["client_notes"] == "Great"

    def test_client_notes_still_works_and_nothing_at_all_is_fine(self, api):
        first, second = _sent(), _sent()

        a = api.post(f"{URL}{first.pk}/approve/", {"client_notes": "Fine"}, format="json")
        b = api.post(f"{URL}{second.pk}/approve/", {}, format="json")

        assert (a.status_code, b.status_code) == (200, 200)
        assert a.json()["client_notes"] == "Fine" and b.json()["client_notes"] == ""

    def test_different_values_are_a_400(self, api):
        sent = _sent()

        response = api.post(
            f"{URL}{sent.pk}/approve/", {"notes": "a", "client_notes": "b"}, format="json"
        )

        assert response.status_code == 400
        assert DeliveryPackage.objects.get(pk=sent.pk).status == "Submitted"


class TestCancel:
    def test_the_frontends_reason_lands_in_the_cancellation_column(self, api):
        package = make_package()

        response = api.post(f"{URL}{package.pk}/cancel/", {"reason": "Show paused"}, format="json")

        assert response.status_code == 200
        body = response.json()
        assert body["cancellation_reason"] == "Show paused" and body["client_notes"] == ""

    def test_the_backend_spelling_and_an_empty_body_work(self, api):
        a, b = make_package(), make_package()

        one = api.post(f"{URL}{a.pk}/cancel/", {"cancellation_reason": "x"}, format="json")
        two = api.post(f"{URL}{b.pk}/cancel/", {}, format="json")

        assert (one.status_code, two.status_code) == (200, 200)

    def test_different_values_are_a_400(self, api):
        package = make_package()

        response = api.post(
            f"{URL}{package.pk}/cancel/",
            {"reason": "a", "cancellation_reason": "b"},
            format="json",
        )

        assert response.status_code == 400
        assert DeliveryPackage.objects.get(pk=package.pk).status == "Draft"


class TestTheSpellingsAreNotStoredAsSeparateFields:
    def test_the_responses_never_echo_the_alias_names_as_data(self, api):
        sent = _sent()

        body = api.post(f"{URL}{sent.pk}/reject/", {"reason": "Too dark"}, format="json").json()

        assert "reason" not in body
        assert body["rejection_reason"] == "Too dark"
