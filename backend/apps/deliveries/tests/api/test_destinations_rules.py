# Django adds <fk>_id attributes and reverse accessors at runtime; no type stubs run here.
# pyright: reportAttributeAccessIssue=false
"""
Destinations (DOM-DLV-10, API-DLV-18, decision Q33): a name is unique in any case among live
destinations, at most one is the default, and a delivery chooses one by id while the old free text
keeps working until no destination is chosen.
"""

from __future__ import annotations

import pytest
from django.db import IntegrityError, transaction
from django.db.models import ProtectedError

from apps.deliveries.models import DeliveryDestination, DeliveryPackage
from apps.deliveries.services.package import DeliveryService
from apps.deliveries.tests.helpers import make_package, signed_off_package
from apps.identity.tests.factories import UserFactory
from apps.production.tests.factories import ProjectFactory

pytestmark = pytest.mark.django_db

URL = "/api/v1/deliveries/"
DEST = f"{URL}destinations/"
UNKNOWN = "00000000-0000-0000-0000-000000000000"


def _destination(name="Studio S3", **fields):
    values = {
        "destination_type": "AWS S3 Bucket",
        "endpoint": "s3://studio-bucket",
        "target_directory": "",
        **fields,
    }
    return DeliveryDestination.objects.create(name=name, **values)


def _body(name, **extra):
    return {"name": name, "type": "AWS S3 Bucket", "endpoint": "s3://x", **extra}


class TestNames:
    def test_a_name_is_unique_in_any_case(self, staff_client):
        assert staff_client.post(DEST, _body("Studio S3"), format="json").status_code == 201

        for variant in ("Studio S3", "studio s3", "STUDIO S3", " Studio S3 "):
            response = staff_client.post(DEST, _body(variant), format="json")
            assert response.status_code == 400, variant
            assert "already exists" in response.content.decode()
        assert DeliveryDestination.objects.count() == 1

    def test_renaming_onto_another_is_refused_but_keeping_your_own_name_is_fine(self, staff_client):
        mine = _destination("Mine")
        _destination("Taken")

        clash = staff_client.patch(f"{DEST}{mine.pk}/", {"name": "taken"}, format="json")
        same = staff_client.patch(f"{DEST}{mine.pk}/", {"name": "MINE", "port": 22}, format="json")

        assert clash.status_code == 400 and same.status_code == 200

    def test_a_deleted_destination_frees_its_name(self, staff_client):
        old = _destination("Reused")
        assert staff_client.delete(f"{DEST}{old.pk}/").status_code == 204

        response = staff_client.post(DEST, _body("reused"), format="json")

        assert response.status_code == 201

    def test_the_database_holds_the_same_rule(self):
        _destination("Dup")

        with pytest.raises(IntegrityError), transaction.atomic():
            _destination("DUP")


class TestTheDefault:
    def test_a_new_default_replaces_the_old_one(self, staff_client):
        first = staff_client.post(DEST, _body("First", is_default=True), format="json").json()
        second = staff_client.post(DEST, _body("Second", is_default=True), format="json")

        assert second.status_code == 201
        defaults = DeliveryDestination.objects.filter(is_default=True)
        assert [d.name for d in defaults] == ["Second"]
        assert DeliveryDestination.objects.get(pk=first["id"]).is_default is False

    def test_making_an_existing_one_the_default_moves_it(self, staff_client):
        a = _destination("A", is_default=True)
        b = _destination("B")

        response = staff_client.patch(f"{DEST}{b.pk}/", {"is_default": True}, format="json")

        assert response.status_code == 200
        assert list(
            DeliveryDestination.objects.filter(is_default=True).values_list("name", flat=True)
        ) == ["B"]
        assert DeliveryDestination.objects.get(pk=a.pk).is_default is False

    def test_turning_the_default_off_leaves_none(self, staff_client):
        a = _destination("A", is_default=True)

        staff_client.patch(f"{DEST}{a.pk}/", {"is_default": False}, format="json")

        assert not DeliveryDestination.objects.filter(is_default=True).exists()

    def test_a_deleted_default_does_not_count(self, staff_client):
        a = _destination("A", is_default=True)
        staff_client.delete(f"{DEST}{a.pk}/")

        response = staff_client.post(DEST, _body("B", is_default=True), format="json")

        assert response.status_code == 201

    def test_the_database_holds_at_most_one_live_default(self):
        _destination("One", is_default=True)

        with pytest.raises(IntegrityError), transaction.atomic():
            _destination("Two", is_default=True)


class TestChoosingADestination:
    def test_a_delivery_shows_the_destination_and_its_address(self, staff_client):
        project = ProjectFactory.create(code="DEST1")
        destination = _destination("Aspera Hub", target_directory="/incoming/show")

        created = staff_client.post(
            URL,
            {"name": "x", "project_id": str(project.pk), "destination_id": str(destination.pk)},
            format="json",
        )
        detail = staff_client.get(f"{URL}{created.json()['id']}/").json()

        assert created.status_code == 201
        assert (
            detail["destination"] == str(destination.pk)
            and detail["destination_name"] == "Aspera Hub"
        )
        assert detail["delivery_destination"] == "/incoming/show"

    def test_the_endpoint_is_the_address_when_there_is_no_directory(self, staff_client):
        project = ProjectFactory.create(code="DEST2")
        destination = _destination("Bucket", endpoint="s3://bucket/x")

        created = staff_client.post(
            URL,
            {"name": "x", "project_id": str(project.pk), "destination_id": str(destination.pk)},
            format="json",
        ).json()

        assert (
            staff_client.get(f"{URL}{created['id']}/").json()["delivery_destination"]
            == "s3://bucket/x"
        )

    def test_the_old_free_text_still_works_while_no_destination_is_chosen(self, staff_client):
        project = ProjectFactory.create(code="DEST3")

        created = staff_client.post(
            URL,
            {"name": "x", "project_id": str(project.pk), "delivery_destination": "s3://old/path"},
            format="json",
        ).json()
        detail = staff_client.get(f"{URL}{created['id']}/").json()

        assert detail["destination"] is None and detail["delivery_destination"] == "s3://old/path"

    def test_text_that_disagrees_with_the_chosen_destination_is_a_400(self, staff_client):
        project = ProjectFactory.create(code="DEST4")
        destination = _destination("Hub", endpoint="s3://hub")

        response = staff_client.post(
            URL,
            {
                "name": "x",
                "project_id": str(project.pk),
                "destination_id": str(destination.pk),
                "delivery_destination": "s3://somewhere/else",
            },
            format="json",
        )

        assert response.status_code == 400
        assert "Cannot be set directly while a destination is chosen" in response.content.decode()
        assert DeliveryPackage.objects.count() == 0

    def test_text_that_matches_the_destination_is_an_echo_and_fine(self, staff_client):
        project = ProjectFactory.create(code="DEST5")
        destination = _destination("Hub", endpoint="s3://hub")

        response = staff_client.post(
            URL,
            {
                "name": "x",
                "project_id": str(project.pk),
                "destination_id": str(destination.pk),
                "delivery_destination": "s3://hub",
            },
            format="json",
        )

        assert response.status_code == 201

    @pytest.mark.parametrize("which", ["unknown", "inactive", "deleted"])
    def test_an_unknown_inactive_or_deleted_destination_is_a_400(self, staff_client, which):
        project = ProjectFactory.create(code="DEST6")
        destination = _destination("Gone", is_active=which != "inactive")
        if which == "deleted":
            DeliveryDestination.objects.filter(pk=destination.pk).update(is_deleted=True)
        value = UNKNOWN if which == "unknown" else str(destination.pk)

        response = staff_client.post(
            URL,
            {"name": "x", "project_id": str(project.pk), "destination_id": value},
            format="json",
        )

        assert response.status_code == 400 and "Unknown destination" in response.content.decode()

    def test_changing_and_clearing_it_on_an_edit(self, staff_client):
        package = make_package(delivery_destination="s3://old")
        first, second = (
            _destination("First", endpoint="s3://first"),
            _destination("Second", endpoint="s3://second"),
        )

        a = staff_client.patch(
            f"{URL}{package.pk}/", {"destination_id": str(first.pk)}, format="json"
        )
        b = staff_client.patch(
            f"{URL}{package.pk}/", {"destination_id": str(second.pk)}, format="json"
        )
        c = staff_client.patch(f"{URL}{package.pk}/", {"destination_id": None}, format="json")

        assert a.json()["delivery_destination"] == "s3://first"
        assert b.json()["destination"] == str(second.pk)
        assert c.json()["destination"] is None and c.json()["delivery_destination"] == ""
        assert DeliveryPackage.objects.get(pk=package.pk).delivery_destination == ""

    def test_a_full_put_of_what_was_read_is_accepted_with_a_destination(self, staff_client):
        destination = _destination("Hub", endpoint="s3://hub")
        package = make_package()
        staff_client.patch(
            f"{URL}{package.pk}/", {"destination_id": str(destination.pk)}, format="json"
        )
        read = staff_client.get(f"{URL}{package.pk}/").json()

        response = staff_client.put(f"{URL}{package.pk}/", read, format="json")

        assert response.status_code == 200, response.content
        assert response.json()["destination"] == str(destination.pk)

    def test_the_read_name_cannot_be_used_to_change_it(self, staff_client):
        destination = _destination("Hub")
        package = make_package()

        response = staff_client.patch(
            f"{URL}{package.pk}/", {"destination": str(destination.pk)}, format="json"
        )

        assert response.status_code == 400 and "Cannot be set directly" in response.content.decode()

    def test_a_sent_delivery_keeps_its_destination(self, staff_client):
        destination = _destination("Hub")
        package = make_package()
        DeliveryService.update(actor=None, package=package, data={"destination_id": destination.pk})
        DeliveryPackage.objects.filter(pk=package.pk).update(status="Signed Off")

        response = staff_client.patch(
            f"{URL}{package.pk}/", {"destination_id": None}, format="json"
        )

        assert response.status_code == 409

    def test_a_destination_in_use_cannot_be_hard_deleted(self):
        destination = _destination("Hub")
        package = make_package()
        DeliveryService.update(actor=None, package=package, data={"destination_id": destination.pk})

        with pytest.raises(ProtectedError):
            DeliveryDestination.all_objects.filter(pk=destination.pk).delete()

    def test_a_revision_keeps_the_destination(self):
        destination = _destination("Hub")
        package = signed_off_package()
        DeliveryPackage.objects.filter(pk=package.pk).update(destination=destination)
        sent = DeliveryService.send(actor=UserFactory.create(), package=package)
        rejected = DeliveryService.record_client_answer(
            actor=None, package=sent, accepted=False, reason="Redo"
        )

        new, _ = DeliveryService.revise(actor=None, package=rejected)

        assert new.destination_id == destination.pk
