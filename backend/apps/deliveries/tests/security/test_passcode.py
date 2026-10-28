# Django adds <fk>_id attributes and reverse accessors at runtime; no type stubs run here.
# pyright: reportAttributeAccessIssue=false
"""
The delivery passcode (SEC-DLV-02, DOM-DLV-09): encrypted at rest, read only by a holder of
``delivery.view_secret`` who may see the project, every read audited, failing closed.
"""

from __future__ import annotations

import pytest
from cryptography.fernet import Fernet

from apps.audit.models import AuditLog
from apps.deliveries import passcode
from apps.deliveries.models import DeliveryPackage
from apps.deliveries.services.package import DeliveryService
from apps.deliveries.tests.helpers import client_for, make_package, operator
from apps.identity.tests.factories import UserFactory
from apps.production.tests.factories import ProjectFactory

pytestmark = pytest.mark.django_db

SECRET = "CLIENT-PASSCODE-4417"
URL = "/api/v1/deliveries/"


def _locked_delivery(**fields):
    return make_package(passcode=SECRET, **fields)


def _reader(project, *codes):
    return client_for(operator(project, "delivery.view", *codes))


def test_the_test_run_gets_its_passcode_key_from_the_env_file(settings):
    """`DELIVERY_SECRET_KEY` is read from `.env.test` (pytest sets DJANGO_ENV=testing), not hardcoded."""
    import inspect

    from config.settings import testing

    assert "DELIVERY_SECRET_KEYS" not in inspect.getsource(testing)
    assert len(settings.DELIVERY_SECRET_KEYS) == 1
    Fernet(settings.DELIVERY_SECRET_KEYS[0].encode())  # a valid key


class TestStoredEncrypted:
    def test_the_column_holds_ciphertext_and_never_the_passcode(self):
        package = _locked_delivery()

        stored = DeliveryPackage.objects.get(pk=package.pk).passcode

        assert passcode.is_encrypted(stored) and SECRET not in stored
        assert passcode.decrypt(stored) == SECRET

    def test_each_write_makes_a_different_ciphertext(self):
        first = _locked_delivery().passcode
        second = _locked_delivery().passcode

        assert first != second

    def test_it_fits_the_column_at_the_longest_passcode(self):
        longest = "x" * 64

        package = make_package(passcode=longest)

        assert DeliveryPackage.objects.get(pk=package.pk).passcode
        assert passcode.decrypt(DeliveryPackage.objects.get(pk=package.pk).passcode) == longest

    def test_changing_and_clearing_it(self):
        package = _locked_delivery()

        DeliveryService.update(actor=None, package=package, data={"passcode": "NEW-ONE"})
        assert passcode.decrypt(DeliveryPackage.objects.get(pk=package.pk).passcode) == "NEW-ONE"

        DeliveryService.update(actor=None, package=package, data={"passcode": ""})
        assert DeliveryPackage.objects.get(pk=package.pk).passcode == ""

    def test_an_edit_that_changes_nothing_else_leaves_a_clear_passcode_alone(self):
        package = make_package()

        DeliveryService.update(actor=None, package=package, data={"passcode": ""})

        assert DeliveryPackage.objects.get(pk=package.pk).passcode == ""


class TestWhoMayRead:
    def test_a_holder_who_is_a_member_reads_it_with_no_store(self):
        package = _locked_delivery()
        client = _reader(package.project, "delivery.view_secret")

        response = client.get(f"{URL}{package.pk}/passcode/")

        assert response.status_code == 200 and response.json() == {"passcode": SECRET}
        assert response["Cache-Control"] == "no-store"

    def test_without_the_code_it_is_a_403(self):
        package = _locked_delivery()
        client = _reader(package.project, "delivery.update", "delivery.approve", "delivery.send")

        response = client.get(f"{URL}{package.pk}/passcode/")

        assert response.status_code == 403 and SECRET not in response.content.decode()

    def test_a_holder_who_is_not_a_member_of_the_project_gets_a_404(self):
        package = _locked_delivery()
        outsider = operator(
            ProjectFactory.create(code="OUT1"), "delivery.view", "delivery.view_secret"
        )

        response = client_for(outsider).get(f"{URL}{package.pk}/passcode/")

        assert response.status_code == 404 and SECRET not in response.content.decode()

    def test_a_platform_superuser_reads_it(self):
        package = _locked_delivery()
        boss = client_for(UserFactory.create(is_superuser=True))

        assert boss.get(f"{URL}{package.pk}/passcode/").json() == {"passcode": SECRET}

    def test_a_delivery_with_none_answers_an_empty_one(self):
        package = make_package()
        client = _reader(package.project, "delivery.view_secret")

        assert client.get(f"{URL}{package.pk}/passcode/").json() == {"passcode": ""}

    def test_anonymous_callers_are_refused(self):
        from rest_framework.test import APIClient

        package = _locked_delivery()

        assert APIClient().get(f"{URL}{package.pk}/passcode/").status_code in (401, 403)

    def test_it_is_in_no_other_response(self):
        package = _locked_delivery()
        client = _reader(package.project, "delivery.view_secret", "delivery.update")

        texts = [
            client.get(URL).content.decode(),
            client.get(f"{URL}{package.pk}/").content.decode(),
            client.get(f"{URL}{package.pk}/history/").content.decode(),
            client.patch(
                f"{URL}{package.pk}/", {"name": "Renamed"}, format="json"
            ).content.decode(),
        ]
        assert all(SECRET not in t and "enc:v1:" not in t for t in texts)


class TestEveryReadIsAudited:
    def test_the_audit_row_names_the_delivery_and_never_the_value(self):
        package = _locked_delivery()
        reader = operator(package.project, "delivery.view", "delivery.view_secret")

        client_for(reader).get(f"{URL}{package.pk}/passcode/")

        rows = AuditLog.objects.filter(
            target_type="delivery",
            target_id=str(package.pk),
            description__contains="passcode viewed",
        )
        assert rows.count() == 1
        row = rows.get()
        assert row.actor_id == reader.pk
        assert SECRET not in f"{row.description} {row.metadata} {row.target_name}"

    def test_a_refused_read_is_not_recorded_as_a_view(self):
        package = _locked_delivery()
        client = _reader(package.project)

        client.get(f"{URL}{package.pk}/passcode/")

        assert not AuditLog.objects.filter(description__contains="passcode viewed").exists()


class TestFailsClosed:
    def test_without_a_key_setting_a_passcode_is_a_503_and_nothing_is_stored(
        self, settings, staff_client
    ):
        settings.DELIVERY_SECRET_KEYS = ()
        project = ProjectFactory.create(code="NOKEY")

        response = staff_client.post(
            URL, {"name": "x", "project_id": str(project.pk), "passcode": SECRET}, format="json"
        )

        assert response.status_code == 503
        assert "secret_storage_unavailable" in response.content.decode()
        assert SECRET not in response.content.decode()
        assert not DeliveryPackage.objects.filter(project=project).exists()

    def test_without_a_key_a_delivery_with_no_passcode_works(self, settings, staff_client):
        settings.DELIVERY_SECRET_KEYS = ()
        project = ProjectFactory.create(code="NOKEY2")

        response = staff_client.post(
            URL, {"name": "x", "project_id": str(project.pk)}, format="json"
        )

        assert response.status_code == 201
        assert staff_client.get(f"{URL}{response.json()['id']}/").json()["has_passcode"] is False

    def test_without_a_key_a_passcode_can_still_be_cleared(self, settings):
        package = _locked_delivery()
        settings.DELIVERY_SECRET_KEYS = ()

        DeliveryService.update(actor=None, package=package, data={"passcode": ""})

        assert DeliveryPackage.objects.get(pk=package.pk).passcode == ""

    def test_without_a_key_reading_is_a_503_not_the_ciphertext(self, settings):
        package = _locked_delivery()
        client = _reader(package.project, "delivery.view_secret")
        settings.DELIVERY_SECRET_KEYS = ()

        response = client.get(f"{URL}{package.pk}/passcode/")

        assert response.status_code == 503
        assert (
            SECRET not in response.content.decode() and "enc:v1:" not in response.content.decode()
        )

    def test_the_detail_still_works_without_the_key(self, settings):
        package = _locked_delivery()
        client = _reader(package.project)
        settings.DELIVERY_SECRET_KEYS = ()

        body = client.get(f"{URL}{package.pk}/").json()

        assert body["has_passcode"] is True

    def test_a_malformed_key_is_a_503(self, settings):
        package = _locked_delivery()
        client = _reader(package.project, "delivery.view_secret")
        settings.DELIVERY_SECRET_KEYS = ("not-a-fernet-key",)

        assert client.get(f"{URL}{package.pk}/passcode/").status_code == 503

    def test_a_tampered_ciphertext_is_refused(self):
        package = _locked_delivery()
        client = _reader(package.project, "delivery.view_secret")
        stored = DeliveryPackage.objects.get(pk=package.pk).passcode
        DeliveryPackage.objects.filter(pk=package.pk).update(passcode=stored[:-4] + "AAAA")

        assert client.get(f"{URL}{package.pk}/passcode/").status_code == 503

    def test_a_plaintext_value_at_rest_is_never_returned(self):
        package = _locked_delivery()
        client = _reader(package.project, "delivery.view_secret")
        DeliveryPackage.objects.filter(pk=package.pk).update(passcode="legacy-plaintext")

        response = client.get(f"{URL}{package.pk}/passcode/")

        assert response.status_code == 503 and "legacy-plaintext" not in response.content.decode()


class TestRotation:
    def test_a_new_first_key_still_reads_what_the_old_key_wrote(self, settings):
        package = _locked_delivery()
        client = _reader(package.project, "delivery.view_secret")
        old = settings.DELIVERY_SECRET_KEYS
        settings.DELIVERY_SECRET_KEYS = (Fernet.generate_key().decode(), *old)

        assert client.get(f"{URL}{package.pk}/passcode/").json() == {"passcode": SECRET}
        DeliveryService.update(actor=None, package=package, data={"passcode": "AFTER-ROTATION"})
        settings.DELIVERY_SECRET_KEYS = settings.DELIVERY_SECRET_KEYS[:1]
        assert client.get(f"{URL}{package.pk}/passcode/").json() == {"passcode": "AFTER-ROTATION"}

    def test_a_key_that_did_not_write_it_cannot_read_it(self, settings):
        package = _locked_delivery()
        client = _reader(package.project, "delivery.view_secret")
        settings.DELIVERY_SECRET_KEYS = (Fernet.generate_key().decode(),)

        assert client.get(f"{URL}{package.pk}/passcode/").status_code == 503


class TestNotFindable:
    @pytest.mark.parametrize("term", [SECRET, "enc:v1", "CLIENT-PASS"])
    def test_search_does_not_match_it(self, staff_client, term):
        _locked_delivery()

        assert staff_client.get(URL, {"search": term}).json()["results"] == []

    def test_it_is_not_an_ordering_field(self):
        from apps.deliveries.api.viewsets.delivery import DeliveryViewSet

        assert "passcode" not in DeliveryViewSet.ordering_fields
        assert "passcode" not in DeliveryViewSet.search_fields
