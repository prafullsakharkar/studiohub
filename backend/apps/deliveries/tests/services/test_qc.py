# Django adds <fk>_id attributes and reverse accessors at runtime; no type stubs run here.
# pyright: reportAttributeAccessIssue=false
"""QC (DLV-05, DOM-DLV-06): real checks against the registry, recorded and append-only."""

from __future__ import annotations

import pytest

from apps.audit.models import AuditLog
from apps.deliveries.models import DeliveryQCCheck
from apps.deliveries.services.package import DeliveryService
from apps.deliveries.tests.helpers import make_package, package_with_items
from apps.production.models import Version
from apps.publishing.models import PublishedFile

pytestmark = pytest.mark.django_db


def _run(package):
    return DeliveryService.validate(actor=None, package=package)[1]


def _outcomes(result):
    """``{(item uid or '', check): outcome}`` of a run."""
    out = {("", c["check"]): c["outcome"] for c in result["package_checks"]}
    for entry in result["items"]:
        for name, outcome, _ in entry["checks"]:
            out[(str(entry["ref"].uid), name)] = outcome
    return out


def test_an_empty_delivery_fails_qc_and_says_why():
    package = make_package()

    result = _run(package)

    assert result["passed"] is False
    assert _outcomes(result) == {("", "has_items"): "fail"}


def test_a_good_delivery_passes_every_check_for_every_item():
    package = package_with_items(items=2)

    result = _run(package)

    assert result["passed"] is True
    outcomes = _outcomes(result)
    assert outcomes[("", "has_items")] == "pass"
    for entry in result["items"]:
        uid = str(entry["ref"].uid)
        assert {name: outcomes[(uid, name)] for name in ("version_published", "same_project", "files_present", "snapshot_current")} == {
            "version_published": "pass", "same_project": "pass", "files_present": "pass", "snapshot_current": "pass",
        }  # fmt: skip
        # the files were registered with a declared checksum only: not checked, which does not fail
        assert outcomes[(uid, "checksum_ok")] == "not_checked"
        assert entry["ref"].is_validated is True


def test_every_check_is_recorded_with_who_and_when_and_the_run_id():
    package = package_with_items()
    from apps.identity.tests.factories import UserFactory

    user = UserFactory.create()
    _, result = DeliveryService.validate(actor=user, package=package)

    rows = DeliveryQCCheck.objects.filter(delivery=package)
    assert rows.count() == 1 + 5  # has_items + five per item
    assert {row.run_id for row in rows} == {result["run_id"]}
    assert {row.checked_by_id for row in rows} == {user.pk}
    assert all(row.checked_at for row in rows)
    package.refresh_from_db()
    assert package.qc_run_id == result["run_id"]


def test_each_run_adds_rows_and_keeps_the_earlier_ones():
    package = package_with_items()

    first = _run(package)
    second = _run(package)

    assert first["run_id"] != second["run_id"]
    assert DeliveryQCCheck.objects.filter(delivery=package, run_id=first["run_id"]).count() == 6
    assert DeliveryQCCheck.objects.filter(delivery=package, run_id=second["run_id"]).count() == 6


def test_qc_records_cannot_be_changed_or_deleted():
    _run(package_with_items())
    row = DeliveryQCCheck.objects.first()
    assert row is not None

    row.detail = "edited"
    with pytest.raises(TypeError):
        row.save()
    with pytest.raises(TypeError):
        row.delete()
    with pytest.raises(TypeError):
        DeliveryQCCheck.objects.update(detail="x")
    with pytest.raises(TypeError):
        DeliveryQCCheck.objects.all().delete()


class TestWhatFailsIt:
    def test_a_version_unpublished_after_it_was_added(self):
        package = package_with_items()
        version = Version.objects.get(delivery_references__delivery=package)
        Version.objects.filter(pk=version.pk).update(is_published=False)

        result = _run(package)

        entry = result["items"][0]
        assert result["passed"] is False and entry["passed"] is False
        assert dict((n, o) for n, o, _ in entry["checks"])["version_published"] == "fail"
        assert entry["ref"].is_validated is False
        assert "version_published" in entry["ref"].validation_notes

    @pytest.mark.parametrize("state", ["mismatch", "missing"])
    def test_a_file_found_wrong_on_disk(self, state):
        package = package_with_items()
        PublishedFile.objects.update(checksum_state=state)

        entry = _run(package)["items"][0]

        assert dict((n, o) for n, o, _ in entry["checks"])["checksum_ok"] == "fail"
        assert entry["ref"].is_validated is False

    def test_a_verified_checksum_passes(self):
        package = package_with_items()
        PublishedFile.objects.update(checksum_state="verified")

        entry = _run(package)["items"][0]

        assert dict((n, o) for n, o, _ in entry["checks"])["checksum_ok"] == "pass"

    def test_a_file_registered_after_the_snapshot_was_taken(self):
        """The preview is stale until prepare refreshes it."""
        package = package_with_items()
        version = Version.objects.get(delivery_references__delivery=package)
        from apps.deliveries.tests.helpers import _Request, storage_root
        from apps.identity.tests.factories import UserFactory
        from apps.publishing.services.files import PublishedFileService

        admin = UserFactory.create(is_superuser=True)
        PublishedFileService.register(
            actor=admin, request=_Request(admin), version_id=version.pk,
            data={"version_id": str(version.pk), "storage_root": storage_root().code,
                  "relative_path": "late/extra.exr", "size_bytes": 1, "sha256": "e" * 64},
        )  # fmt: skip

        entry = _run(package)["items"][0]

        assert dict((n, o) for n, o, _ in entry["checks"])["snapshot_current"] == "fail"

    def test_a_file_revoked_after_the_snapshot_was_taken(self):
        package = package_with_items()
        PublishedFile.all_objects.update(status="Revoked", revoke_reason="bad")

        entry = _run(package)["items"][0]
        checks = dict((n, o) for n, o, _ in entry["checks"])

        assert checks["snapshot_current"] == "fail"

    def test_the_item_check_for_a_version_that_is_gone(self):
        package = package_with_items()
        version = Version.objects.get(delivery_references__delivery=package)
        Version.objects.filter(pk=version.pk).update(is_deleted=True)

        checks = dict((n, o) for n, o, _ in _run(package)["items"][0]["checks"])

        assert checks["same_project"] == "fail" and checks["version_published"] == "fail"


class TestValidateAsAnAction:
    def test_a_draft_becomes_validating_and_the_others_keep_their_status(self):
        draft = package_with_items()
        prepared = package_with_items()
        type(prepared).objects.filter(pk=prepared.pk).update(status="Prepared")

        DeliveryService.validate(actor=None, package=draft)
        DeliveryService.validate(actor=None, package=prepared)

        draft.refresh_from_db()
        prepared.refresh_from_db()
        assert (draft.status, prepared.status) == ("Validating", "Prepared")

    def test_it_is_audited_with_the_run_id_and_the_outcome(self):
        package = package_with_items()
        _, result = DeliveryService.validate(actor=None, package=package)

        row = AuditLog.objects.filter(target_id=str(package.pk), target_type="delivery").latest(
            "created_at"
        )
        assert row.metadata == {"run_id": str(result["run_id"]), "passed": True}

    @pytest.mark.parametrize(
        "state", ["Submitted", "Approved", "Rejected", "Complete", "Cancelled"]
    )
    def test_a_sent_delivery_is_not_revalidated(self, state):
        from apps.deliveries.exceptions import DeliveryNotEditable

        package = package_with_items()
        type(package).objects.filter(pk=package.pk).update(status=state)

        with pytest.raises(DeliveryNotEditable):
            DeliveryService.validate(actor=None, package=package)
