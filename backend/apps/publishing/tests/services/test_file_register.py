# Django adds <fk>_id attributes and reverse accessors at runtime; no type stubs run here.
# pyright: reportAttributeAccessIssue=false
"""Registering files of published versions (DOM-PUB-02, DOM-PUB-04) and the bulk contract."""

from __future__ import annotations

import pytest
from rest_framework.exceptions import ValidationError

from apps.audit.models import AuditLog
from apps.masterdata.models import MasterFileType
from apps.production.tests.factories import ProjectFactory
from apps.publishing.constants.permissions import PublishPermissions as P
from apps.publishing.exceptions import PathAlreadyRegistered
from apps.publishing.models import PublishedFile, PublishedFileEvent
from apps.publishing.services.files import BULK_LIMIT, PublishedFileService, UnknownVersion
from apps.publishing.tests.helpers import (
    OTHER_SHA,
    SHA,
    member,
    outsider,
    published_version,
    registration,
    request_for,
    storage_root,
    unpublished_version,
)

pytestmark = pytest.mark.django_db


def _register(user, version, root, path="shot/v001/plate.exr", **over):
    return PublishedFileService.register(
        actor=user,
        request=request_for(user),
        version_id=version.pk,
        data=registration(version, root, path, **over),
    )


@pytest.fixture
def user(project):
    return member(project, P.CREATE, P.VIEW)


@pytest.fixture
def version(project):
    return published_version(project)


class TestRegister:
    def test_a_file_of_a_published_version_is_registered(self, user, version, root):
        file, created = _register(user, version, root)

        assert created is True
        assert file.status == "Registered"
        assert file.checksum_state == "declared"
        assert file.project_id == version.project_id
        assert file.sha256 == SHA
        assert file.created_by == user
        assert list(file.events.values_list("kind", "to_status")) == [("registered", "Registered")]

    def test_the_project_comes_from_the_version_not_the_body(self, user, version, root):
        other = ProjectFactory.create(code="OTHERP")
        data = registration(version, root)
        data["project_id"] = str(other.pk)

        with pytest.raises(ValidationError) as error:
            PublishedFileService.register(
                actor=user, request=request_for(user), version_id=version.pk, data=data
            )

        assert "project_id" in error.value.detail

    def test_a_checksum_is_stored_lower_case(self, user, version, root):
        file, _ = _register(user, version, root, sha256="A" * 64)

        assert file.sha256 == "a" * 64

    def test_an_audit_row_is_written_under_the_publishing_target(self, user, version, root):
        file, _ = _register(user, version, root)

        row = AuditLog.objects.get(target_id=str(file.pk))
        assert row.target_type == "publishing"
        assert row.actor_id == user.pk
        assert "plate" not in row.description  # no paths in audit text

    @pytest.mark.parametrize(
        "kind", ["unpublished", "unknown", "malformed", "other_project", "outsider"]
    )
    def test_an_unusable_version_gives_one_answer(self, user, version, root, kind, project):
        if kind == "unpublished":
            target, actor = unpublished_version(project), user
        elif kind == "unknown":
            target, actor = version, user
            target.pk = "00000000-0000-0000-0000-000000000000"
        elif kind == "malformed":
            target, actor = version, user
            target.pk = "not-a-uuid"
        elif kind == "other_project":
            target, actor = published_version(ProjectFactory.create(code="FOREIGN")), user
        else:
            target, actor = version, outsider(P.CREATE)

        with pytest.raises(UnknownVersion) as error:
            PublishedFileService.register(
                actor=actor,
                request=request_for(actor),
                version_id=target.pk,
                data={**registration(version, root), "version_id": str(target.pk)},
            )

        assert error.value.detail == {"version_id": ["Unknown or unpublished version."]}
        assert PublishedFile.objects.count() == 0

    def test_a_deleted_version_is_unknown_too(self, user, version, root):
        type(version).objects.filter(pk=version.pk).update(is_deleted=True)

        with pytest.raises(UnknownVersion):
            _register(user, version, root)

    def test_a_superuser_registers_for_any_project(self, version, root):
        admin = outsider()
        admin.is_superuser = True
        admin.save()

        file, created = _register(admin, version, root)

        assert created and file.project_id == version.project_id

    def test_an_inactive_or_unknown_root_is_refused(self, user, version, root):
        root.is_active = False
        root.save()

        with pytest.raises(ValidationError) as error:
            _register(user, version, root)
        assert "storage_root" in error.value.detail
        with pytest.raises(ValidationError):
            _register(user, version, root, storage_root="NOPE")

    def test_a_root_can_be_named_by_code_in_any_case_or_by_id(self, user, version, root):
        a, _ = _register(user, version, root, "a.exr", storage_root=root.code.lower())
        b, _ = _register(user, version, root, "b.exr", storage_root=str(root.pk))

        assert a.storage_root_id == b.storage_root_id == root.pk

    @pytest.mark.parametrize("sha", ["", "abc", "g" * 64, "a" * 63, "a" * 65, None])
    def test_a_malformed_checksum_is_refused(self, user, version, root, sha):
        with pytest.raises(ValidationError) as error:
            _register(user, version, root, sha256=sha)
        assert "sha256" in error.value.detail

    @pytest.mark.parametrize("size", [-1, "12", 1.5, True, None])
    def test_a_bad_size_is_refused(self, user, version, root, size):
        with pytest.raises(ValidationError) as error:
            _register(user, version, root, size_bytes=size)
        assert "size_bytes" in error.value.detail

    def test_a_zero_size_is_allowed(self, user, version, root):
        file, _ = _register(user, version, root, size_bytes=0)
        assert file.size_bytes == 0

    @pytest.mark.parametrize(
        "path", ["../x.exr", "/abs.exr", "a\\b.exr", "a//b.exr", "%2e%2e/x.exr", "a/b/"]
    )
    def test_a_path_that_breaks_a_rule_is_refused(self, user, version, root, path):
        with pytest.raises(ValidationError) as error:
            _register(user, version, root, path)
        assert "relative_path" in error.value.detail
        assert PublishedFile.objects.count() == 0

    def test_unknown_keys_are_refused(self, user, version, root):
        with pytest.raises(ValidationError) as error:
            _register(user, version, root, status="Revoked", checksum_state="verified")
        assert set(error.value.detail) == {"status", "checksum_state"}

    def test_an_unknown_role_is_refused(self, user, version, root):
        with pytest.raises(ValidationError) as error:
            _register(user, version, root, role="hero")
        assert "role" in error.value.detail

    def test_a_file_type_is_resolved_by_code_or_id_and_must_be_active(self, user, version, root):
        kind = MasterFileType.objects.create(code="EXR", name="OpenEXR", extension="exr")
        by_code, _ = _register(user, version, root, "a.exr", file_type="exr")
        by_id, _ = _register(user, version, root, "b.exr", file_type=str(kind.pk))
        kind.status = "archived"
        kind.save()

        assert by_code.file_type_id == by_id.file_type_id == kind.pk
        with pytest.raises(ValidationError) as error:
            _register(user, version, root, "c.exr", file_type="EXR")
        assert "file_type" in error.value.detail
        with pytest.raises(ValidationError):
            _register(user, version, root, "d.exr", file_type="nope")


class TestSequences:
    def test_a_sequence_needs_a_pattern_and_both_frames(self, user, version, root):
        file, _ = _register(
            user, version, root, "s/plate.%04d.exr", frame_start=1001, frame_end=1100
        )
        assert (file.frame_start, file.frame_end) == (1001, 1100)

    def test_frames_without_a_pattern_are_refused(self, user, version, root):
        with pytest.raises(ValidationError) as error:
            _register(user, version, root, "s/plate.exr", frame_start=1, frame_end=2)
        assert "relative_path" in error.value.detail

    def test_a_pattern_without_frames_is_refused(self, user, version, root):
        with pytest.raises(ValidationError) as error:
            _register(user, version, root, "s/plate.####.exr")
        assert "frame_start" in error.value.detail

    @pytest.mark.parametrize(
        "frames", [{"frame_start": 5}, {"frame_end": 5}, {"frame_start": 9, "frame_end": 1}]
    )
    def test_incomplete_or_backwards_frames_are_refused(self, user, version, root, frames):
        with pytest.raises(ValidationError):
            _register(user, version, root, "s/plate.%04d.exr", **frames)


class TestIdempotentRetry:
    def test_the_same_registration_again_is_the_same_file(self, user, version, root):
        first, created_first = _register(user, version, root)
        again, created_again = _register(user, version, root)

        assert (created_first, created_again) == (True, False)
        assert first.pk == again.pk
        assert PublishedFile.objects.count() == 1
        assert PublishedFileEvent.objects.filter(file=first).count() == 1

    @pytest.mark.parametrize(
        "change",
        [{"sha256": OTHER_SHA}, {"size_bytes": 2048}, {"role": "proxy"}],
    )
    def test_different_content_at_a_registered_path_is_a_conflict(
        self, user, version, root, change
    ):
        _register(user, version, root)

        with pytest.raises(PathAlreadyRegistered):
            _register(user, version, root, **change)
        assert PublishedFile.objects.count() == 1

    def test_the_same_path_for_another_version_is_a_conflict(self, user, version, root, project):
        _register(user, version, root)

        with pytest.raises(PathAlreadyRegistered):
            _register(user, published_version(project), root)

    def test_a_revoked_path_is_never_reused_even_with_identical_content(self, user, version, root):
        file, _ = _register(user, version, root)
        PublishedFile.all_objects.filter(pk=file.pk).update(
            status="Revoked", revoke_reason="bad render"
        )

        with pytest.raises(PathAlreadyRegistered):
            _register(user, version, root)

    def test_the_same_path_under_another_root_is_a_different_file(self, user, version, root):
        other = storage_root("ARCHIVE")
        a, _ = _register(user, version, root)
        b, created = _register(user, version, other)

        assert created and a.pk != b.pk


class TestBulk:
    def _items(self, version, root, count):
        return [registration(version, root, f"s/f{i}.exr") for i in range(count)]

    def test_every_item_is_registered_on_its_own(self, user, version, root):
        results = PublishedFileService.register_many(
            actor=user, request=request_for(user), items=self._items(version, root, 3)
        )

        assert [r["ok"] for r in results] == [True, True, True]
        assert [r["index"] for r in results] == [0, 1, 2]
        assert PublishedFile.objects.count() == 3

    def test_one_bad_item_does_not_undo_the_others(self, user, version, root, project):
        items = self._items(version, root, 4)
        items[1]["sha256"] = "nope"
        items[2]["version_id"] = str(unpublished_version(project).pk)
        PublishedFileService.register(
            actor=user,
            request=request_for(user),
            version_id=version.pk,
            data=registration(version, root, "s/f3.exr", sha256=OTHER_SHA),
        )

        results = PublishedFileService.register_many(
            actor=user, request=request_for(user), items=items
        )

        assert [r["error"] for r in results] == [
            None,
            "invalid",
            "unknown_version",
            "path_already_registered",
        ]
        assert "sha256" in results[1]["fields"]
        assert results[0]["id"] and not results[1]["id"]
        assert PublishedFile.objects.count() == 2  # f3 from before, f0 now

    def test_a_non_object_item_is_reported_not_raised(self, user, version, root):
        results = PublishedFileService.register_many(
            actor=user,
            request=request_for(user),
            items=["nope"],  # pyright: ignore[reportArgumentType]
        )
        assert results[0]["error"] == "invalid"

    def test_the_batch_size_is_limited(self, user, version, root):
        with pytest.raises(ValidationError):
            PublishedFileService.register_many(actor=user, request=request_for(user), items=[])
        with pytest.raises(ValidationError):
            PublishedFileService.register_many(
                actor=user,
                request=request_for(user),
                items=self._items(version, root, BULK_LIMIT + 1),
            )

    def test_a_forbidden_version_and_an_unknown_one_look_the_same(self, user, version, root):
        stranger = published_version(ProjectFactory.create(code="STRANGER"))
        items = [
            registration(stranger, root, "s/a.exr"),
            {
                **registration(version, root, "s/b.exr"),
                "version_id": "00000000-0000-0000-0000-000000000000",
            },
        ]

        results = PublishedFileService.register_many(
            actor=user, request=request_for(user), items=items
        )

        assert [r["error"] for r in results] == ["unknown_version", "unknown_version"]
        assert results[0] == {**results[1], "index": 0}
