"""
Frontend sync, Phase 8: CR-17 (the list filters), CR-18 (only a Draft or a Cancelled delivery is deleted),
CR-19 (a destination's type), CR-20 (an item that was checked can be removed), CR-21 (names next to ids).
"""

from __future__ import annotations

import pytest

from apps.deliveries.models import DeliveryDestination, DeliveryPackage, DeliveryQCCheck
from apps.deliveries.tests.helpers import (
    DELIVERY_CODES,
    client_for,
    make_package,
    operator,
    package_with_items,
    prepared_package,
    signed_off_package,
)
from apps.masterdata.tests.factories import ClientFactory
from apps.production.tests.factories import ProjectFactory

pytestmark = pytest.mark.django_db

LIST = "/api/v1/deliveries/"


@pytest.fixture
def project():
    return ProjectFactory.create(code="CRD1")


@pytest.fixture
def api(project):
    return client_for(operator(project, *DELIVERY_CODES))


def _names(response) -> set[str]:
    assert response.status_code == 200, response.json()
    return {row["name"] for row in response.json()["results"]}


class TestListFilters:
    @pytest.fixture
    def rows(self, project):
        client = ClientFactory.create(name="Acme", code="ACME")
        destination = DeliveryDestination.objects.create(
            name="S3", destination_type="AWS S3 Bucket", endpoint="s3://x"
        )
        draft = make_package(
            project, name="A draft", client_id=client.pk, destination_id=destination.pk
        )
        ready = prepared_package(project, name="A ready one")
        done = make_package(project, name="A finished one", delivery_method="Aspera")
        DeliveryPackage.objects.filter(pk=done.pk).update(
            status="Complete", client_status="Approved"
        )
        return {
            "draft": draft,
            "ready": ready,
            "done": done,
            "client": client,
            "destination": destination,
        }

    @pytest.mark.parametrize(
        ("params", "expected"),
        [
            ({"status": "Draft"}, {"A draft"}),
            ({"status": "Ready"}, {"A ready one"}),  # the read word
            ({"status": "Prepared"}, {"A ready one"}),  # the stored word
            ({"status": "ready"}, {"A ready one"}),  # any case
            ({"status": "Completed"}, {"A finished one"}),
            ({"status": "Complete"}, {"A finished one"}),
            ({"status": "Bogus"}, set()),
            ({"client_status": "Approved"}, {"A finished one"}),
            ({"delivery_method": "Aspera"}, {"A finished one"}),
        ],
    )
    def test_by_status_and_method(self, api, rows, params, expected):
        assert _names(api.get(LIST, params)) == expected

    @pytest.mark.parametrize("key", ["client", "client_id"])
    def test_by_client_under_both_spellings(self, api, rows, key):
        assert _names(api.get(LIST, {key: str(rows["client"].pk)})) == {"A draft"}

    @pytest.mark.parametrize("key", ["destination", "destination_id"])
    def test_by_destination_under_both_spellings(self, api, rows, key):
        assert _names(api.get(LIST, {key: str(rows["destination"].pk)})) == {"A draft"}

    def test_by_project_narrows_to_that_project(self, project, rows):
        other = ProjectFactory.create(code="CRD2")
        make_package(other, name="Elsewhere")
        user = operator(project, *DELIVERY_CODES)
        from apps.production.models import ProjectMembership

        ProjectMembership.objects.create(user=user, project=other, status="active", role="Artist")
        api = client_for(user)

        assert "Elsewhere" in _names(api.get(LIST))
        for key in ("project", "project_id"):
            assert _names(api.get(LIST, {key: str(other.pk)})) == {"Elsewhere"}
            assert "Elsewhere" not in _names(api.get(LIST, {key: str(project.pk)}))

    def test_a_value_that_is_not_an_id_is_a_400(self, api, rows):
        assert api.get(LIST, {"client": "not-an-id"}).status_code == 400

    def test_the_project_route_filters_too(self, project, api, rows):
        resp = api.get(f"/api/organizations/projects/{project.pk}/deliveries/", {"status": "Ready"})

        assert _names(resp) == {"A ready one"}

    def test_search_still_works_with_a_filter(self, api, rows):
        assert _names(api.get(LIST, {"status": "Draft", "search": "finished"})) == set()


class TestDeleteOnlyDraftOrCancelled:
    @pytest.mark.parametrize("status", ["Draft", "Cancelled"])
    def test_these_can_be_deleted(self, project, api, status):
        package = make_package(project)
        DeliveryPackage.objects.filter(pk=package.pk).update(status=status)

        assert api.delete(f"{LIST}{package.pk}/").status_code == 204
        assert DeliveryPackage.all_objects.get(pk=package.pk).is_deleted is True

    @pytest.mark.parametrize(
        "status",
        ["Validating", "Prepared", "Signed Off", "Submitted", "Approved", "Rejected", "Complete"],
    )
    def test_the_rest_are_refused_and_nothing_changes(self, project, api, status):
        package = make_package(project)
        DeliveryPackage.objects.filter(pk=package.pk).update(status=status)

        resp = api.delete(f"{LIST}{package.pk}/")

        assert resp.status_code == 409
        assert resp.json()["error"]["code"] == "delivery_not_editable"
        assert resp.json()["detail"] == "Only a Draft or a Cancelled delivery can be deleted."
        assert DeliveryPackage.all_objects.get(pk=package.pk).is_deleted is False

    def test_the_code_is_still_needed(self, project):
        package = make_package(project)
        api = client_for(operator(project, "delivery.view", "delivery.update"))

        assert api.delete(f"{LIST}{package.pk}/").status_code == 403


class TestDestinationType:
    URL = "/api/v1/deliveries/destinations/"

    def test_one_of_the_seven_is_accepted(self, project, api):
        resp = api.post(
            self.URL,
            {"name": "Frame", "type": "Frame.io Enterprise", "endpoint": "https://f.io"},
            format="json",
        )

        assert resp.status_code == 201, resp.json()

    @pytest.mark.parametrize("value", ["S3", "aws s3 bucket"])
    def test_anything_else_is_refused_with_the_list(self, project, api, value):
        resp = api.post(self.URL, {"name": "Bad", "type": value, "endpoint": "x"}, format="json")

        assert resp.status_code == 400
        assert "Must be one of: Aspera Connect" in str(resp.json()["type"])
        assert not DeliveryDestination.objects.filter(name="Bad").exists()

    def test_a_blank_type_is_refused_too(self, project, api):
        assert (
            api.post(
                self.URL, {"name": "Blank", "type": "", "endpoint": "x"}, format="json"
            ).status_code
            == 400
        )

    def test_a_row_saved_before_the_check_keeps_its_old_type_unless_it_is_changed(
        self, project, api
    ):
        legacy = DeliveryDestination.objects.create(
            name="Old", destination_type="S3", endpoint="s3://old"
        )

        same = api.patch(
            f"{self.URL}{legacy.pk}/", {"type": "S3", "endpoint": "s3://older"}, format="json"
        )
        renamed = api.patch(f"{self.URL}{legacy.pk}/", {"name": "Older"}, format="json")
        changed = api.patch(f"{self.URL}{legacy.pk}/", {"type": "FTP"}, format="json")

        assert same.status_code == 200 and renamed.status_code == 200
        assert changed.status_code == 400


class TestCheckedItemsCanBeRemoved:
    def test_removing_a_validated_item_works_and_keeps_the_history_of_its_checks(
        self, project, api
    ):
        package = package_with_items(project, items=2)
        assert api.post(f"{LIST}{package.pk}/validate/", {}, format="json").status_code == 200
        item = package.versions.first()
        before = DeliveryQCCheck.objects.filter(delivery=package).count()
        assert DeliveryQCCheck.objects.filter(item=item).exists()

        resp = api.post(
            f"{LIST}{package.pk}/remove-version/", {"item_id": str(item.uid)}, format="json"
        )

        assert resp.status_code == 200, resp.json()
        assert len(resp.json()["versions"]) == 1
        assert (
            DeliveryQCCheck.objects.filter(delivery=package).count() == before
        )  # nothing was erased
        assert not DeliveryQCCheck.objects.filter(item__isnull=False, item__uid=item.uid).exists()
        assert (
            api.get(f"{LIST}{package.pk}/qc/").json() == []
        )  # the run was cleared: validate again

    def test_the_delivery_can_be_prepared_again_afterwards(self, project, api):
        package = package_with_items(project, items=2)
        api.post(f"{LIST}{package.pk}/validate/", {}, format="json")
        item = package.versions.first()
        api.post(f"{LIST}{package.pk}/remove-version/", {"item_id": str(item.uid)}, format="json")

        resp = api.post(f"{LIST}{package.pk}/prepare/", {}, format="json")

        assert resp.status_code == 200, resp.json()
        assert resp.json()["status"] == "Ready"

    def test_a_prepared_delivery_can_lose_an_item_too(self, project, api):
        package = prepared_package(project)
        package_two = package_with_items(project, items=2)
        api.post(f"{LIST}{package_two.pk}/prepare/", {}, format="json")
        item = package_two.versions.first()

        resp = api.post(
            f"{LIST}{package_two.pk}/remove-version/", {"item_id": str(item.uid)}, format="json"
        )

        assert resp.status_code == 200, resp.json()
        assert package.pk != package_two.pk

    def test_a_signed_off_delivery_still_cannot_change(self, project, api):
        package = signed_off_package(project)
        item = package.versions.first()

        resp = api.post(
            f"{LIST}{package.pk}/remove-version/", {"item_id": str(item.uid)}, format="json"
        )

        assert resp.status_code in (400, 409)
        assert package.versions.count() == 1


class TestNamesNextToIds:
    def test_history_checks_and_sign_off_carry_a_name(self, project):
        preparer = operator(project, *DELIVERY_CODES)
        signer = operator(project, *DELIVERY_CODES)
        api = client_for(preparer)
        created = api.post(
            LIST, {"name": "Named", "project_id": str(project.pk)}, format="json"
        ).json()
        package = DeliveryPackage.objects.get(pk=created["id"])
        from apps.deliveries.tests.helpers import published_version

        version = published_version(project)
        api.post(f"{LIST}{package.pk}/add-version/", {"version_id": str(version.pk)}, format="json")
        api.post(f"{LIST}{package.pk}/prepare/", {}, format="json")
        assert (
            client_for(signer).post(f"{LIST}{package.pk}/sign-off/", {}, format="json").status_code
            == 200
        )

        history = api.get(f"{LIST}{package.pk}/history/").json()
        detail = api.get(f"{LIST}{package.pk}/").json()
        qc = api.get(f"{LIST}{package.pk}/qc/").json()

        assert history[0]["actor_name"] == preparer.email and history[0]["actor"] == str(
            preparer.pk
        )
        assert history[-1]["actor_name"] == signer.email
        assert detail["signed_off_by_name"] == signer.email
        assert detail["client_answered_by_name"] == ""
        assert qc and all(
            row["checked_by_name"] == signer.email for row in qc
        )  # signing off runs the checks again

    def test_a_system_move_has_no_name(self, project):
        from apps.deliveries.models import DeliveryStatusChange

        package = make_package(project)
        DeliveryStatusChange.objects.create(
            delivery=package,
            from_status="Signed Off",
            to_status="Prepared",
            actor=None,
            reason="content revoked",
            override_kind="system",
        )
        api = client_for(operator(project, *DELIVERY_CODES))

        rows = api.get(f"{LIST}{package.pk}/history/").json()

        system = next(r for r in rows if r["override_kind"] == "system")
        assert system["actor"] is None and system["actor_name"] == ""
