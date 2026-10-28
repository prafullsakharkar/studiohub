# Django adds <fk>_id attributes and reverse accessors at runtime; no type stubs run here.
# pyright: reportAttributeAccessIssue=false
"""
`POST /deliveries/bulk-cancel/` (decision Q36): 1 to 100 distinct ids, each its own transaction,
200 when all succeed and 207 otherwise, identical `not_found` for unknown, foreign and forbidden
ones, the same transition map as a single cancel and never an override.
"""

from __future__ import annotations

import pytest

from apps.deliveries.constants.permissions import DeliveryPermissions as P
from apps.deliveries.models import DeliveryPackage, DeliveryStatusChange
from apps.deliveries.services.package import DeliveryService
from apps.deliveries.tests.helpers import (
    DELIVERY_CODES,
    client_for,
    make_package,
    operator,
    outsider,
    signed_off_package,
)
from apps.identity.tests.factories import UserFactory
from apps.identity.tests.rbac_helpers import grant_permissions
from apps.production.tests.factories import ProjectFactory

pytestmark = pytest.mark.django_db

URL = "/api/v1/deliveries/bulk-cancel/"
UNKNOWN = "00000000-0000-0000-0000-000000000000"


@pytest.fixture
def project():
    return ProjectFactory.create(code="BULK")


@pytest.fixture
def api(project):
    return client_for(operator(project, *DELIVERY_CODES))


def _status(package):
    return DeliveryPackage.objects.get(pk=package.pk).status


class TestResults:
    def test_all_ok_is_a_200_and_every_delivery_is_cancelled_with_the_reason(self, api, project):
        packages = [make_package(project) for _ in range(3)]

        response = api.post(
            URL,
            {"ids": [str(p.pk) for p in packages], "reason": "Show cancelled"},
            format="json",
        )

        assert response.status_code == 200
        body = response.json()
        assert (
            body["success"] is True and body["succeeded_count"] == 3 and body["failed_count"] == 0
        )
        assert body["results"] == [{"id": str(p.pk), "ok": True, "error": None} for p in packages]
        for package in packages:
            fresh = DeliveryPackage.objects.get(pk=package.pk)
            assert fresh.status == "Cancelled" and fresh.cancellation_reason == "Show cancelled"
            assert DeliveryStatusChange.objects.filter(
                delivery=package, to_status="Cancelled"
            ).exists()

    def test_a_delivery_that_cannot_be_cancelled_makes_it_a_207_and_the_rest_still_go(
        self, api, project
    ):
        good = make_package(project)
        sent = DeliveryService.send(actor=UserFactory.create(), package=signed_off_package(project))
        also_good = make_package(project)

        response = api.post(
            URL, {"ids": [str(good.pk), str(sent.pk), str(also_good.pk)]}, format="json"
        )

        assert response.status_code == 207
        body = response.json()
        assert (body["succeeded_count"], body["failed_count"]) == (2, 1)
        assert [(r["ok"], r["error"]) for r in body["results"]] == [
            (True, None),
            (False, "invalid_transition"),
            (True, None),
        ]
        assert (_status(good), _status(sent), _status(also_good)) == (
            "Cancelled",
            "Submitted",
            "Cancelled",
        )

    def test_unknown_foreign_and_legacy_ones_report_the_identical_not_found(self, api, project):
        foreign = make_package(ProjectFactory.create(code="OTHERB"))
        legacy = DeliveryPackage.objects.create(name="Legacy", code="LEGACY-B")

        response = api.post(URL, {"ids": [UNKNOWN, str(foreign.pk), str(legacy.pk)]}, format="json")

        assert response.status_code == 207
        errors = [{k: v for k, v in r.items() if k != "id"} for r in response.json()["results"]]
        assert errors == [{"ok": False, "error": "not_found"}] * 3
        assert (_status(foreign), _status(legacy)) == ("Draft", "Draft")

    def test_a_signed_off_delivery_the_caller_may_not_cancel_reports_not_found_too(self, project):
        package = signed_off_package(project)
        editor = client_for(operator(project, P.VIEW, P.UPDATE))

        response = editor.post(URL, {"ids": [str(package.pk)]}, format="json")

        assert response.json()["results"] == [
            {"id": str(package.pk), "ok": False, "error": "not_found"}
        ]
        assert _status(package) == "Signed Off"

    def test_an_approver_can_cancel_a_signed_off_one(self, project):
        package = signed_off_package(project)
        approver = client_for(operator(project, P.VIEW, P.UPDATE, P.APPROVE))

        response = approver.post(URL, {"ids": [str(package.pk)]}, format="json")

        assert response.status_code == 200 and _status(package) == "Cancelled"

    def test_the_override_is_never_used(self, project):
        holder = operator(project, *DELIVERY_CODES)
        grant_permissions(holder, P.STATUS_OVERRIDE)
        cancelled = make_package(project)
        DeliveryService.cancel(actor=None, package=cancelled)

        response = client_for(holder).post(
            URL,
            {"ids": [str(cancelled.pk)], "reason": "bring it back", "override_reason": "please"},
            format="json",
        )

        assert response.json()["results"][0]["error"] == "invalid_transition"
        assert _status(cancelled) == "Cancelled"


class TestTheBody:
    @pytest.mark.parametrize(
        "body",
        [
            {},
            {"ids": []},
            {"ids": ["not-a-uuid"]},
            {"ids": [UNKNOWN, UNKNOWN]},
        ],
    )
    def test_a_bad_list_is_a_400_and_nothing_is_cancelled(self, api, project, body):
        package = make_package(project)

        response = api.post(URL, body, format="json")

        assert response.status_code == 400 and _status(package) == "Draft"

    def test_one_hundred_are_fine_and_one_hundred_and_one_are_not(self, api):
        import uuid

        ids = [str(uuid.uuid4()) for _ in range(101)]

        assert api.post(URL, {"ids": ids}, format="json").status_code == 400
        assert api.post(URL, {"ids": ids[:100]}, format="json").status_code == 207

    def test_different_reason_spellings_are_a_400(self, api, project):
        package = make_package(project)

        response = api.post(
            URL,
            {"ids": [str(package.pk)], "reason": "a", "cancellation_reason": "b"},
            format="json",
        )

        assert response.status_code == 400 and _status(package) == "Draft"


class TestAccess:
    def test_it_needs_the_update_code(self, project):
        package = make_package(project)
        client = client_for(operator(project, *(set(DELIVERY_CODES) - {P.UPDATE})))

        assert client.post(URL, {"ids": [str(package.pk)]}, format="json").status_code == 403
        assert _status(package) == "Draft"

    def test_a_non_member_reaches_nothing(self, project):
        package = make_package(project)
        stranger = client_for(outsider(*DELIVERY_CODES))

        response = stranger.post(URL, {"ids": [str(package.pk)]}, format="json")

        assert response.json()["results"][0]["error"] == "not_found"
        assert _status(package) == "Draft"

    def test_each_item_is_its_own_transaction(self, api, project):
        good = make_package(project)

        response = api.post(URL, {"ids": [str(good.pk), UNKNOWN]}, format="json")

        assert response.status_code == 207 and _status(good) == "Cancelled"
