# Django adds <fk>_id attributes and reverse accessors at runtime; no type stubs run here.
# pyright: reportAttributeAccessIssue=false
"""
Prepare and send (DLV-05 to DLV-07, DOM-DLV-05): QC gates both, the manifest checksum is real,
sending happens once and freezes what was sent.
"""

from __future__ import annotations

import hashlib
import json
from datetime import UTC, datetime
from typing import Any

import pytest
from django.utils import timezone

from apps.audit.models import AuditLog
from apps.deliveries.exceptions import DeliveryNotEditable, InvalidTransition, QCFailed
from apps.deliveries.models import DeliveryItemFile, DeliveryQCCheck, DeliveryVersionRef
from apps.deliveries.models.item_file import FrozenSnapshotError
from apps.deliveries.services.package import DeliveryService
from apps.deliveries.tests.helpers import (
    _Request,
    make_package,
    package_with_items,
    prepared_package,
    signed_off_package,
    storage_root,
)
from apps.identity.tests.factories import UserFactory
from apps.production.models import Version
from apps.publishing.models import PublishedFile
from apps.publishing.services.files import PublishedFileService

pytestmark = pytest.mark.django_db

NOW = datetime(2026, 11, 2, 9, 30, tzinfo=UTC)


def _send(package, **kwargs):
    return DeliveryService.send(actor=None, package=package, **kwargs)


def _register_file(version, path, sha="e" * 64):
    admin = UserFactory.create(is_superuser=True)
    PublishedFileService.register(
        actor=admin,
        request=_Request(admin),
        version_id=version.pk,
        data={
            "version_id": str(version.pk),
            "storage_root": storage_root().code,
            "relative_path": path,
            "size_bytes": 7,
            "sha256": sha,
        },
    )


class TestPrepare:
    def test_a_delivery_that_fails_qc_is_a_409_naming_the_checks_and_stays_as_it_was(self):
        package = make_package()

        with pytest.raises(QCFailed) as error:
            DeliveryService.prepare(actor=None, package=package)

        detail: Any = error.value.detail
        assert detail["code"] == "qc_failed"
        assert [c["check"] for c in detail["checks"]] == ["has_items"]
        package.refresh_from_db()
        assert package.status == "Draft" and package.manifest_data == {}

    def test_a_failed_prepare_keeps_the_record_of_the_run(self):
        package = make_package()

        with pytest.raises(QCFailed):
            DeliveryService.prepare(actor=None, package=package)

        rows = DeliveryQCCheck.objects.filter(delivery=package)
        assert [(r.check_name, r.outcome) for r in rows] == [("has_items", "fail")]

    def test_a_good_delivery_gets_a_manifest_and_becomes_prepared(self):
        package = package_with_items(items=2)

        prepared, _ = DeliveryService.prepare(actor=None, package=package)

        assert prepared.status == "Prepared"
        assert [v["version_number"] for v in prepared.manifest_data["versions"]] == sorted(
            v["version_number"] for v in prepared.manifest_data["versions"]
        )
        assert len(prepared.manifest_data["versions"]) == 2
        assert prepared.manifest_data["versions"][0]["files"][0]["root"] == "PROJECTS"

    def test_the_manifest_checksum_is_the_sha256_of_its_canonical_json(self):
        package = prepared_package()

        canonical = json.dumps(package.manifest_data, sort_keys=True, separators=(",", ":"))
        expected = hashlib.sha256(canonical.encode()).hexdigest()

        assert package.checksums["manifest_sha256"] == expected
        assert "manifest_md5" not in package.checksums
        assert "placeholder" not in json.dumps(package.checksums)
        assert package.checksums["version_count"] == 1
        assert package.checksums["total_size_bytes"] == 1000

    def test_preparing_twice_gives_the_same_checksum(self):
        package = prepared_package()
        first = package.checksums["manifest_sha256"]

        again, _ = DeliveryService.prepare(actor=None, package=package)

        assert again.checksums["manifest_sha256"] == first

    def test_prepare_refreshes_the_preview_from_the_registry(self):
        package = package_with_items()
        version = Version.objects.get(delivery_references__delivery=package)
        _register_file(version, "late/extra.exr")

        prepared, _ = DeliveryService.prepare(actor=None, package=package)

        assert prepared.versions.get().files.count() == 2
        assert prepared.checksums["total_size_bytes"] == 1007

    def test_a_revoked_file_drops_out_of_the_preview_but_a_lone_one_blocks_prepare(self):
        package = package_with_items()
        PublishedFile.all_objects.update(status="Revoked", revoke_reason="bad")

        with pytest.raises(QCFailed):
            DeliveryService.prepare(actor=None, package=package)

    def test_no_prepare_after_the_delivery_was_sent(self):
        package = signed_off_package()
        _send(package)

        with pytest.raises(DeliveryNotEditable):
            DeliveryService.prepare(actor=None, package=package)


class TestSend:
    def test_a_signed_off_delivery_is_sent_with_the_real_time_and_the_sender(self, monkeypatch):
        package = signed_off_package()
        sender = UserFactory.create()
        monkeypatch.setattr(timezone, "now", lambda: NOW)

        sent = DeliveryService.send(
            actor=sender, package=package, transfer_reference="  ASP-1234  "
        )

        assert sent.status == "Submitted"
        assert sent.sent_at == NOW  # not the last edit time
        assert sent.sent_by == sender
        assert sent.transfer_reference == "ASP-1234"

    @pytest.mark.parametrize(
        "state",
        [
            "Draft",
            "Validating",
            "Prepared",
            "Submitted",
            "Approved",
            "Rejected",
            "Complete",
            "Cancelled",
        ],
    )
    def test_only_a_signed_off_delivery_can_be_sent(self, state):
        package = package_with_items()
        type(package).objects.filter(pk=package.pk).update(status=state)

        with pytest.raises(InvalidTransition):
            _send(package)

        package.refresh_from_db()
        assert package.status == state and package.sent_at is None

    def test_sending_twice_is_refused(self):
        package = signed_off_package()
        _send(package)

        with pytest.raises(InvalidTransition):
            _send(package)

    def test_a_sent_delivery_cannot_be_sent_again_even_if_its_status_is_forced_back(self):
        package = signed_off_package()
        _send(package)
        type(package).objects.filter(pk=package.pk).update(status="Signed Off")

        with pytest.raises(InvalidTransition):
            _send(package)

    def test_a_delivery_that_no_longer_passes_qc_is_not_sent(self):
        package = signed_off_package()
        version = Version.objects.get(delivery_references__delivery=package)
        Version.objects.filter(pk=version.pk).update(is_published=False)

        with pytest.raises(QCFailed):
            _send(package)

        package.refresh_from_db()
        assert package.status == "Signed Off" and package.sent_at is None
        assert not DeliveryItemFile.objects.filter(frozen_at__isnull=False).exists()

    def test_a_failed_send_keeps_the_record_of_the_run(self):
        package = signed_off_package()
        before = DeliveryQCCheck.objects.filter(delivery=package).count()
        version = Version.objects.get(delivery_references__delivery=package)
        Version.objects.filter(pk=version.pk).update(is_published=False)

        with pytest.raises(QCFailed):
            _send(package)

        failed = DeliveryQCCheck.objects.filter(delivery=package, outcome="fail")
        assert DeliveryQCCheck.objects.filter(delivery=package).count() > before
        assert "version_published" in {row.check_name for row in failed}

    def test_a_file_registered_after_sign_off_stops_the_send_and_changes_nothing(self):
        package = signed_off_package()
        version = Version.objects.get(delivery_references__delivery=package)
        _register_file(version, "late/extra.exr")

        with pytest.raises(QCFailed) as error:
            _send(package)

        detail: Any = error.value.detail
        assert "snapshot_current" in {c["check"] for c in detail["checks"]}
        package.refresh_from_db()
        assert package.status == "Signed Off" and package.sent_at is None
        assert package.versions.get().files.count() == 1
        assert not DeliveryItemFile.objects.filter(frozen_at__isnull=False).exists()

    def test_it_is_audited_without_paths_or_the_reference(self):
        package = signed_off_package()
        _send(package, transfer_reference="SECRET-REF")

        row = AuditLog.objects.filter(target_id=str(package.pk), target_type="delivery").latest(
            "created_at"
        )
        assert row.metadata["transfer_reference_given"] is True
        assert "SECRET-REF" not in f"{row.description} {row.metadata}"
        assert "plate_0" not in f"{row.description} {row.metadata}"


class TestWhatWasSentNeverChanges:
    def test_every_file_is_frozen_at_the_send(self, monkeypatch):
        package = signed_off_package()
        monkeypatch.setattr(timezone, "now", lambda: NOW)

        _send(package)

        assert set(DeliveryItemFile.objects.values_list("frozen_at", flat=True)) == {NOW}

    def test_unpublishing_or_revoking_afterwards_changes_nothing_that_was_sent(self):
        package = signed_off_package()
        sent = _send(package)
        before_manifest = json.dumps(sent.manifest_data, sort_keys=True)
        before_checksum = sent.checksums["manifest_sha256"]
        before_files = list(
            DeliveryItemFile.objects.order_by("pk").values(
                "relative_path", "sha256", "size_bytes", "frozen_at"
            )
        )
        version = Version.objects.get(delivery_references__delivery=package)
        Version.objects.filter(pk=version.pk).update(is_published=False)
        PublishedFile.all_objects.update(status="Revoked", revoke_reason="bad")

        sent.refresh_from_db()

        assert json.dumps(sent.manifest_data, sort_keys=True) == before_manifest
        assert sent.checksums["manifest_sha256"] == before_checksum
        assert (
            list(
                DeliveryItemFile.objects.order_by("pk").values(
                    "relative_path", "sha256", "size_bytes", "frozen_at"
                )
            )
            == before_files
        )

    def test_frozen_files_refuse_to_change_or_go(self):
        _send(signed_off_package())
        frozen = DeliveryItemFile.objects.get()

        frozen.sha256 = "f" * 64
        with pytest.raises(FrozenSnapshotError):
            frozen.save()
        with pytest.raises(FrozenSnapshotError):
            frozen.delete()
        with pytest.raises(FrozenSnapshotError):
            DeliveryItemFile.objects.filter(pk=frozen.pk).update(sha256="f" * 64)
        with pytest.raises(FrozenSnapshotError):
            DeliveryItemFile.objects.all().delete()
        assert DeliveryItemFile.objects.get().sha256 == "1" * 64

    def test_the_item_of_a_sent_delivery_refuses_to_change_or_go(self):
        sent = _send(signed_off_package())
        item = DeliveryVersionRef.objects.get(delivery=sent)

        item.file_size_bytes = 1
        with pytest.raises(FrozenSnapshotError):
            item.save()
        with pytest.raises(FrozenSnapshotError):
            item.delete()
        assert DeliveryVersionRef.objects.get(pk=item.pk).file_size_bytes == 1000

    def test_items_cannot_be_added_or_removed_after_the_send(self):
        sent = _send(signed_off_package())
        item = DeliveryVersionRef.objects.get(delivery=sent)

        with pytest.raises(DeliveryNotEditable):
            DeliveryService.remove_version(actor=None, package=sent, item_key=item.uid)

    def test_the_database_keeps_the_history(self):
        from django.db.models import ProtectedError

        sent = _send(signed_off_package())
        version = Version.objects.get(delivery_references__delivery=sent)

        with pytest.raises(ProtectedError):
            Version.all_objects.filter(pk=version.pk).delete()
        with pytest.raises(ProtectedError):
            type(sent).all_objects.filter(pk=sent.pk).delete()
