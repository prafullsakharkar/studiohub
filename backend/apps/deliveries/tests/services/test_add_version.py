# Django adds <fk>_id attributes and reverse accessors at runtime; no type stubs run here.
# pyright: reportAttributeAccessIssue=false
"""
Which versions may join a delivery, and where an item's data comes from (DLV-03, DOM-DLV-03).
"""

from __future__ import annotations

import pytest
from rest_framework.exceptions import ValidationError

from apps.deliveries.exceptions import DeliveryNotEditable, UndeliverableVersion
from apps.deliveries.models import DeliveryItemFile
from apps.deliveries.services.package import DeliveryService
from apps.deliveries.tests.helpers import make_package, published_version
from apps.production.models import Version
from apps.production.tests.factories import ProjectFactory, ShotFactory
from apps.publishing.models import PublishedFile

pytestmark = pytest.mark.django_db


@pytest.fixture
def package():
    return make_package()


def _add(package, version):
    return DeliveryService.add_version(actor=None, package=package, version_id=version.pk)


def _reason(error: UndeliverableVersion) -> str:
    return error.reason


class TestWhichVersionsQualify:
    def test_a_published_version_with_a_registered_file_is_added(self, package):
        version = published_version(package.project)

        ref = _add(package, version)

        assert ref.version_id == version.pk and package.versions.count() == 1

    def test_an_unpublished_version_is_refused(self, package):
        version = published_version(package.project, published=False, files=0)

        with pytest.raises(UndeliverableVersion) as error:
            _add(package, version)

        assert _reason(error.value) == "not_published"

    def test_a_published_version_with_no_registered_file_is_refused(self, package):
        version = published_version(package.project, files=0)

        with pytest.raises(UndeliverableVersion) as error:
            _add(package, version)

        assert _reason(error.value) == "no_registered_files"

    def test_files_that_are_only_deprecated_or_revoked_do_not_count(self, package):
        version = published_version(package.project, files=2)
        main, proxy = PublishedFile.objects.filter(version=version).order_by("role")
        PublishedFile.all_objects.filter(pk=main.pk).update(status="Deprecated")
        PublishedFile.all_objects.filter(pk=proxy.pk).update(status="Revoked", revoke_reason="bad")

        with pytest.raises(UndeliverableVersion) as error:
            _add(package, version)

        assert _reason(error.value) == "no_registered_files"

    @pytest.mark.parametrize("state", ["mismatch", "missing"])
    def test_files_known_to_be_wrong_are_a_checksum_problem(self, package, state):
        version = published_version(package.project)
        PublishedFile.objects.filter(version=version).update(checksum_state=state)

        with pytest.raises(UndeliverableVersion) as error:
            _add(package, version)

        assert _reason(error.value) == "checksum_problem"

    @pytest.mark.parametrize("state", ["declared", "verified"])
    def test_declared_and_verified_files_are_fine(self, package, state):
        version = published_version(package.project)
        PublishedFile.objects.filter(version=version).update(checksum_state=state)

        assert _add(package, version).pk

    def test_one_good_file_is_enough_when_another_is_wrong(self, package):
        version = published_version(package.project, files=2)
        PublishedFile.objects.filter(version=version, role="proxy").update(checksum_state="missing")

        _add(package, version)

        assert [f.role for f in package.versions.get().files.all()] == ["main"]

    def test_a_version_of_another_project_looks_like_an_unknown_one(self, package):
        foreign = published_version(ProjectFactory.create(code="OTHERDP"))
        unknown = Version(pk="00000000-0000-0000-0000-000000000000")

        with pytest.raises(UndeliverableVersion) as foreign_error:
            _add(package, foreign)
        with pytest.raises(UndeliverableVersion) as unknown_error:
            _add(package, unknown)

        assert _reason(foreign_error.value) == _reason(unknown_error.value) == "unknown_version"
        assert foreign_error.value.detail == unknown_error.value.detail

    def test_a_deleted_version_is_unknown(self, package):
        version = published_version(package.project)
        Version.objects.filter(pk=version.pk).update(is_deleted=True)

        with pytest.raises(UndeliverableVersion) as error:
            _add(package, version)

        assert _reason(error.value) == "unknown_version"

    def test_a_delivery_without_a_project_cannot_take_versions(self):
        from apps.deliveries.models import DeliveryPackage

        orphan = DeliveryPackage.objects.create(name="Old", code="OLD-1")
        version = published_version(ProjectFactory.create(code="NOPROJ"))

        with pytest.raises(ValidationError) as error:
            _add(orphan, version)

        assert "project_id" in error.value.detail

    def test_the_same_version_twice_is_refused(self, package):
        version = published_version(package.project)
        _add(package, version)

        with pytest.raises(ValidationError) as error:
            _add(package, version)

        assert "already in the delivery" in str(error.value.detail)
        assert package.versions.count() == 1


class TestTheSnapshotIsTheServers:
    def test_everything_comes_from_the_version_and_its_files(self, package):
        shot = ShotFactory.create(project=package.project, code="SH020", name="Opening")
        version = published_version(package.project, files=2, shot=shot)

        ref = _add(package, version)

        assert ref.version_number == version.version_number
        assert (ref.entity_type, ref.entity_code, ref.entity_name) == ("Shot", "SH020", "Opening")
        assert ref.file_size_bytes == 3000  # 1000 + 2000
        assert ref.frame_count == 0
        assert ref.file_path == f"PROJECTS:show/{version.code}/plate_0.exr"
        assert ref.checksum_sha256 == "1" * 64 and ref.checksum_md5 == ""
        files = {f.role: f for f in ref.files.all()}
        assert set(files) == {"main", "proxy"}
        assert files["proxy"].sha256 == "2" * 64 and files["proxy"].frozen_at is None

    def test_sequence_frames_are_counted(self, package, root=None):
        version = published_version(package.project, files=0)
        from apps.deliveries.tests.helpers import _Request, storage_root
        from apps.identity.tests.factories import UserFactory
        from apps.publishing.services.files import PublishedFileService

        admin = UserFactory.create(is_superuser=True)
        PublishedFileService.register(
            actor=admin,
            request=_Request(admin),
            version_id=version.pk,
            data={
                "version_id": str(version.pk),
                "storage_root": storage_root().code,
                "relative_path": "seq/plate.%04d.exr",
                "size_bytes": 5,
                "sha256": "c" * 64,
                "frame_start": 1001,
                "frame_end": 1100,
            },
        )

        ref = _add(package, version)

        assert ref.frame_count == 100

    def test_adding_a_version_drops_the_stale_qc_run(self, package):
        package.qc_run_id = __import__("uuid").uuid4()
        package.save()

        _add(package, published_version(package.project))

        package.refresh_from_db()
        assert package.qc_run_id is None

    def test_the_item_is_recorded_with_who_added_it(self, package):
        from apps.identity.tests.factories import UserFactory

        user = UserFactory.create()
        ref = DeliveryService.add_version(
            actor=user, package=package, version_id=published_version(package.project).pk
        )

        assert ref.added_by == user and ref.uid


class TestOnlyBeforeItIsSent:
    @pytest.mark.parametrize(
        "state", ["Signed Off", "Submitted", "Approved", "Rejected", "Complete", "Cancelled"]
    )
    def test_a_delivery_past_sign_off_takes_no_changes(self, package, state):
        version = published_version(package.project)
        extra = published_version(package.project)
        ref = _add(package, version)
        type(package).objects.filter(pk=package.pk).update(status=state)

        with pytest.raises(DeliveryNotEditable):
            _add(package, extra)
        with pytest.raises(DeliveryNotEditable):
            DeliveryService.remove_version(actor=None, package=package, item_key=ref.uid)
        assert package.versions.count() == 1

    @pytest.mark.parametrize("state", ["Draft", "Validating", "Prepared"])
    def test_working_states_do_(self, package, state):
        type(package).objects.filter(pk=package.pk).update(status=state)

        assert _add(package, published_version(package.project)).pk

    def test_a_delivery_that_was_sent_stays_closed_even_if_its_status_is_moved_back(self, package):
        """A forced status change (the admin, an override) leaves ``sent_at``: it still went out."""
        from django.utils import timezone

        _add(package, published_version(package.project))
        type(package).objects.filter(pk=package.pk).update(
            status="Prepared", sent_at=timezone.now()
        )

        with pytest.raises(DeliveryNotEditable):
            _add(package, published_version(package.project))


class TestRemoving:
    def test_by_uid_or_by_the_older_integer_id(self, package):
        first = _add(package, published_version(package.project))
        second = _add(package, published_version(package.project))

        DeliveryService.remove_version(actor=None, package=package, item_key=first.uid)
        DeliveryService.remove_version(actor=None, package=package, item_key=second.pk)

        assert package.versions.count() == 0 and DeliveryItemFile.objects.count() == 0

    def test_an_unknown_item_is_a_400(self, package):
        with pytest.raises(ValidationError):
            DeliveryService.remove_version(actor=None, package=package, item_key="nope")
        with pytest.raises(ValidationError):
            DeliveryService.remove_version(
                actor=None, package=package, item_key="00000000-0000-0000-0000-000000000000"
            )

    def test_an_item_of_another_delivery_cannot_be_removed(self, package):
        other = make_package()
        ref = _add(other, published_version(other.project))

        with pytest.raises(ValidationError):
            DeliveryService.remove_version(actor=None, package=package, item_key=ref.uid)
        assert other.versions.count() == 1
