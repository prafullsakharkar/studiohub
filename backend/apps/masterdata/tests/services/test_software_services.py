"""Software and version service rules (CONTRACTS §3.4)."""

from __future__ import annotations

import datetime

import pytest
from django.core.exceptions import ValidationError

from apps.audit.models import AuditLog
from apps.identity.tests.factories import UserFactory
from apps.masterdata.exceptions import MasterdataConflict
from apps.masterdata.models import CatalogStatus, Software, SoftwareVersion
from apps.masterdata.services.software import SoftwareService, SoftwareVersionService
from apps.masterdata.tests.factories import SoftwareFactory, SoftwareVersionFactory

pytestmark = pytest.mark.django_db


@pytest.fixture
def actor():
    return UserFactory.create()


def D(y, m=1, d=1):
    return datetime.date(y, m, d)


def _errors(exc):
    return exc.value.message_dict


class TestSoftwareCrud:
    def test_create_normalizes_and_audits_the_actor(self, actor):
        row = SoftwareService.create(
            actor=actor,
            data={"code": " maya ", "name": " Maya ", "website": "https://autodesk.com/maya"},
        )
        assert (row.code, row.name, row.website) == ("maya", "Maya", "https://autodesk.com/maya")
        assert row.created_by == actor

    @pytest.mark.parametrize("website", ["ftp://x.com", "not a url", "javascript:alert(1)"])
    def test_website_must_be_http_or_https(self, actor, website):
        with pytest.raises(ValidationError) as caught:
            SoftwareService.create(actor=actor, data={"code": "x", "name": "X", "website": website})
        assert "website" in caught.value.message_dict

    def test_duplicates_are_validation_errors(self, actor):
        SoftwareFactory(code="maya", name="Maya")
        with pytest.raises(ValidationError) as caught:
            SoftwareService.create(actor=actor, data={"code": "MAYA", "name": "maya"})
        assert set(caught.value.message_dict) == {"code", "name"}

    def test_a_system_software_cannot_change_code_or_be_removed(self, actor):
        row = SoftwareService.create(
            actor=actor, data={"code": "maya", "name": "Maya"}, system=True
        )
        for operation in (SoftwareService.archive, SoftwareService.soft_delete):
            with pytest.raises(MasterdataConflict) as caught:
                operation(actor=actor, instance=row)
            assert caught.value.code == "system_row_protected"
        with pytest.raises(MasterdataConflict):
            SoftwareService.update(actor=actor, instance=row, data={"code": "other"})


class TestVersionCreate:
    def test_name_and_code_are_derived_from_software_and_version(self, actor):
        software = SoftwareFactory(code="maya", name="Maya")
        row = SoftwareVersionService.create(actor=actor, parent=software, data={"version": "2025"})
        assert (row.code, row.name, row.software.pk) == ("maya-2025", "Maya 2025", software.pk)
        assert row.version_key == "000000002025"

    def test_explicit_name_and_code_win(self, actor):
        software = SoftwareFactory()
        row = SoftwareVersionService.create(
            actor=actor,
            parent=software,
            data={"version": "1", "code": "custom", "name": "Custom name"},
        )
        assert (row.code, row.name) == ("custom", "Custom name")

    def test_a_version_needs_its_software(self, actor):
        with pytest.raises(ValueError):
            SoftwareVersionService.create(actor=actor, data={"version": "1"})

    def test_a_version_string_is_required(self, actor):
        with pytest.raises(ValidationError) as caught:
            SoftwareVersionService.create(actor=actor, parent=SoftwareFactory(), data={"name": "x"})
        assert "version" in caught.value.message_dict

    def test_the_software_cannot_be_chosen_through_the_data(self, actor):
        with pytest.raises(ValueError):
            SoftwareVersionService.create(
                actor=actor,
                parent=SoftwareFactory(),
                data={"version": "1", "software": SoftwareFactory()},
            )

    def test_duplicate_version_is_rejected_case_insensitively_within_a_software(self, actor):
        software = SoftwareFactory()
        SoftwareVersionService.create(actor=actor, parent=software, data={"version": "2025A"})
        with pytest.raises(ValidationError) as caught:
            SoftwareVersionService.create(actor=actor, parent=software, data={"version": "2025a"})
        assert "version" in caught.value.message_dict

    def test_the_same_version_is_fine_under_another_software(self, actor):
        for _ in range(2):
            SoftwareVersionService.create(
                actor=actor, parent=SoftwareFactory(), data={"version": "2025"}
            )
        assert SoftwareVersion.objects.filter(version="2025").count() == 2

    def test_end_of_support_before_release_is_a_field_error(self, actor):
        with pytest.raises(ValidationError) as caught:
            SoftwareVersionService.create(
                actor=actor,
                parent=SoftwareFactory(),
                data={"version": "1", "release_date": D(2025), "end_of_support": D(2024)},
            )
        assert "end_of_support" in caught.value.message_dict
        assert SoftwareVersion.objects.count() == 0

    @pytest.mark.parametrize("value", ["2025-01-01", 20250101, datetime.datetime(2025, 1, 1)])
    def test_dates_must_be_real_dates(self, actor, value):
        with pytest.raises(ValidationError):
            SoftwareVersionService.create(
                actor=actor, parent=SoftwareFactory(), data={"version": "1", "release_date": value}
            )


class TestVersionUpdate:
    def test_changing_the_version_updates_the_sort_key_and_rechecks_uniqueness(self, actor):
        software = SoftwareFactory()
        SoftwareVersionFactory(software=software, version="9")
        row = SoftwareVersionFactory(software=software, version="8")
        with pytest.raises(ValidationError):
            SoftwareVersionService.update(actor=actor, instance=row, data={"version": "9"})
        SoftwareVersionService.update(actor=actor, instance=row, data={"version": "10"})
        row.refresh_from_db()
        assert row.version_key == "000000000010"

    def test_moving_the_end_date_before_the_release_is_refused_and_changes_nothing(self, actor):
        row = SoftwareVersionFactory(release_date=D(2025), end_of_support=D(2027))
        with pytest.raises(ValidationError):
            SoftwareVersionService.update(
                actor=actor, instance=row, data={"end_of_support": D(2020)}
            )
        row.refresh_from_db()
        assert row.end_of_support == D(2027)


class TestArchiveCascade:
    def test_archiving_a_software_archives_its_active_versions(self, actor):
        software = SoftwareFactory()
        a, b = (SoftwareVersionFactory(software=software) for _ in range(2))
        already = SoftwareVersionFactory(software=software, status="archived")

        result = SoftwareService.archive(actor=actor, instance=software)

        assert result.status == CatalogStatus.ARCHIVED
        assert sorted(result.versions_archived) == sorted([str(a.pk), str(b.pk)])  # pyright: ignore[reportAttributeAccessIssue]
        assert SoftwareVersion.objects.filter(software=software, status="archived").count() == 3
        already.refresh_from_db()
        assert already.status == "archived"

    def test_cascade_false_refuses_while_versions_are_active_and_changes_nothing(self, actor):
        software = SoftwareFactory()
        version = SoftwareVersionFactory(software=software)
        with pytest.raises(MasterdataConflict) as caught:
            SoftwareService.archive(actor=actor, instance=software, cascade=False)
        assert caught.value.code == "has_dependants"
        software.refresh_from_db(), version.refresh_from_db()
        assert (software.status, version.status) == ("active", "active")

    def test_cascade_false_is_fine_when_no_version_is_active(self, actor):
        software = SoftwareFactory()
        SoftwareVersionFactory(software=software, status="archived")
        assert (
            SoftwareService.archive(actor=actor, instance=software, cascade=False).status
            == "archived"
        )

    def test_archiving_twice_is_idempotent(self, actor):
        software = SoftwareFactory()
        SoftwareService.archive(actor=actor, instance=software)
        assert SoftwareService.archive(actor=actor, instance=software).versions_archived == []  # pyright: ignore[reportAttributeAccessIssue]

    def test_restoring_the_software_does_not_unarchive_its_versions(self, actor):
        software = SoftwareFactory()
        version = SoftwareVersionFactory(software=software)
        SoftwareService.archive(actor=actor, instance=software)
        SoftwareService.restore(actor=actor, instance=software)
        version.refresh_from_db()
        assert version.status == "archived"


class TestDeleteCascade:
    def test_soft_delete_takes_the_live_versions_along_with_one_timestamp(self, actor):
        software = SoftwareFactory()
        a, b = (SoftwareVersionFactory(software=software) for _ in range(2))

        SoftwareService.soft_delete(actor=actor, instance=software)

        deleted = Software.all_objects.get(pk=software.pk)
        rows = SoftwareVersion.all_objects.filter(software=software)
        assert deleted.is_deleted and deleted.deleted_by == actor
        assert {r.is_deleted for r in rows} == {True}
        assert {r.deleted_at for r in rows} == {deleted.deleted_at}
        assert not SoftwareVersion.objects.filter(pk__in=[a.pk, b.pk]).exists()

    def test_restore_brings_back_only_the_versions_deleted_with_it(self, actor):
        software = SoftwareFactory()
        together = SoftwareVersionFactory(software=software)
        earlier = SoftwareVersionFactory(software=software)
        earlier.delete()  # deleted on its own, before the software
        SoftwareService.soft_delete(actor=actor, instance=software)

        SoftwareService.restore(actor=actor, instance=Software.all_objects.get(pk=software.pk))

        assert SoftwareVersion.objects.filter(pk=together.pk).exists()
        assert not SoftwareVersion.objects.filter(pk=earlier.pk).exists()
        assert Software.objects.filter(pk=software.pk).exists()

    def test_restore_is_refused_when_a_live_software_took_the_code(self, actor):
        old = SoftwareFactory(code="maya", name="Maya")
        SoftwareService.soft_delete(actor=actor, instance=old)
        SoftwareService.create(actor=actor, data={"code": "maya", "name": "Maya"})
        with pytest.raises(ValidationError):
            SoftwareService.restore(actor=actor, instance=Software.all_objects.get(pk=old.pk))

    def test_a_software_with_version_rows_cannot_be_hard_deleted(self, actor):
        software = SoftwareFactory()
        version = SoftwareVersionFactory(software=software)
        SoftwareService.soft_delete(actor=actor, instance=software)
        with pytest.raises(MasterdataConflict) as caught:
            SoftwareService.hard_delete(
                actor=actor, instance=Software.all_objects.get(pk=software.pk)
            )
        assert caught.value.code == "has_dependants"

        SoftwareVersionService.hard_delete(
            actor=actor, instance=SoftwareVersion.all_objects.get(pk=version.pk)
        )
        SoftwareService.hard_delete(actor=actor, instance=Software.all_objects.get(pk=software.pk))
        assert not Software.all_objects.filter(pk=software.pk).exists()


class TestAuditCascade:
    def test_events_list_the_cascaded_versions(self, actor, django_capture_on_commit_callbacks):
        software = SoftwareFactory()
        version = SoftwareVersionFactory(software=software)
        with django_capture_on_commit_callbacks(execute=True):
            SoftwareService.archive(actor=actor, instance=software)
            SoftwareService.soft_delete(actor=actor, instance=software)
            SoftwareService.restore(actor=actor, instance=Software.all_objects.get(pk=software.pk))

        logs = {
            log.metadata["event"]: log.metadata
            for log in AuditLog.objects.filter(target_type="masterdata", target_id=str(software.pk))
        }
        assert logs["MasterdataRecordArchived"]["cascade"] == [str(version.pk)]
        assert logs["MasterdataRecordDeleted"]["cascade"] == [str(version.pk)]
        assert logs["MasterdataRecordRestored"]["cascade"] == [str(version.pk)]
