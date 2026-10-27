# Django adds <fk>_id attributes and reverse accessors at runtime; no type stubs run here.
# pyright: reportAttributeAccessIssue=false
"""
A published file is revoked (DOM-DLV-08): unsent deliveries lose their QC, signed-off ones go back
to Prepared, sent ones are left alone and say so.
"""

from __future__ import annotations

import pytest

from apps.audit.models import AuditLog
from apps.deliveries.models import DeliveryPackage, DeliveryStatusChange
from apps.deliveries.services import revocation
from apps.deliveries.services.package import DeliveryService
from apps.deliveries.tests.helpers import (
    _Request,
    client_for,
    package_with_items,
    prepared_package,
    signed_off_package,
)
from apps.identity.tests.factories import UserFactory
from apps.publishing.models import PublishedFile
from apps.publishing.services.files import PublishedFileService

pytestmark = pytest.mark.django_db


def _file_of(package):
    return PublishedFile.objects.get(version__delivery_references__delivery=package)


def _revoke(package, callbacks=None):
    admin = UserFactory.create(is_superuser=True)
    file = _file_of(package)
    PublishedFileService.revoke(
        actor=admin, request=_Request(admin), file=file, reason="Wrong grade"
    )
    return file


def _handle(package):
    file = _file_of(package)
    return revocation.on_file_revoked(file_id=file.pk, version_id=file.version_id)


class TestUnsent:
    def test_a_working_delivery_loses_its_qc_run(self):
        package = prepared_package()
        assert DeliveryPackage.objects.get(pk=package.pk).qc_run_id is not None

        counts = _handle(package)

        fresh = DeliveryPackage.objects.get(pk=package.pk)
        assert counts["qc_invalidated"] == 1 and fresh.qc_run_id is None
        assert fresh.status == "Prepared"

    def test_a_signed_off_delivery_goes_back_to_prepared_by_the_system(self):
        package = signed_off_package()

        counts = _handle(package)

        fresh = DeliveryPackage.objects.get(pk=package.pk)
        assert counts["reopened"] == 1
        assert fresh.status == "Prepared" and fresh.signed_off_by_id is None
        assert fresh.signed_off_at is None and fresh.qc_run_id is None
        row = DeliveryStatusChange.objects.filter(delivery=package, to_status="Prepared").latest(
            "at", "id"
        )
        assert (row.from_status, row.override_kind, row.reason) == (
            "Signed Off",
            "system",
            "content revoked",
        )
        assert row.actor_id is None

    def test_a_reopened_delivery_cannot_be_sent_until_it_is_prepared_and_signed_again(self):
        from apps.deliveries.exceptions import InvalidTransition

        package = signed_off_package()
        _handle(package)

        with pytest.raises(InvalidTransition):
            DeliveryService.send(actor=UserFactory.create(), package=package)

    def test_it_is_safe_to_handle_twice(self):
        package = signed_off_package()

        _handle(package)
        again = _handle(package)

        assert again == {"qc_invalidated": 0, "reopened": 0, "sent_noted": 0}
        assert (
            DeliveryStatusChange.objects.filter(delivery=package, override_kind="system").count()
            == 1
        )

    def test_a_delivery_without_the_version_is_untouched(self):
        mine, other = signed_off_package(), signed_off_package()

        _handle(other)

        assert DeliveryPackage.objects.get(pk=mine.pk).status == "Signed Off"


class TestSent:
    def _sent(self):
        return DeliveryService.send(actor=UserFactory.create(), package=signed_off_package())

    def test_nothing_that_was_sent_changes_but_the_detail_says_so(self):
        sent = self._sent()
        before = (sent.status, sent.checksums, sent.manifest_data, sent.sent_at)

        counts = _handle(sent)
        _revoke(sent)

        fresh = DeliveryPackage.objects.get(pk=sent.pk)
        assert counts["sent_noted"] == 1
        assert (fresh.status, fresh.checksums, fresh.manifest_data, fresh.sent_at) == before
        user = client_for(UserFactory.create(is_superuser=True))
        assert user.get(f"/api/v1/deliveries/{sent.pk}/").json()["has_revoked_content"] is True

    def test_it_is_noted_once_in_the_audit_log(self):
        sent = self._sent()

        _handle(sent)
        _handle(sent)

        rows = AuditLog.objects.filter(
            target_type="delivery", target_id=str(sent.pk), description__contains="revoked"
        )
        assert rows.count() == 1 and rows.get().severity == AuditLog.SEVERITY_WARNING

    def test_a_clean_delivery_does_not_claim_revoked_content(self):
        package = package_with_items()
        user = client_for(UserFactory.create(is_superuser=True))

        assert user.get(f"/api/v1/deliveries/{package.pk}/").json()["has_revoked_content"] is False


class TestThroughTheEventBus:
    def test_revoking_a_file_reopens_the_signed_off_delivery_after_commit(
        self, django_capture_on_commit_callbacks
    ):
        package = signed_off_package()

        with django_capture_on_commit_callbacks(execute=True):
            _revoke(package)

        assert DeliveryPackage.objects.get(pk=package.pk).status == "Prepared"
