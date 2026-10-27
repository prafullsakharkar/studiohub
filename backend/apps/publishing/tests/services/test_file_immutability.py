"""A registered file never changes except its lifecycle fields (DOM-PUB-02 invariant 2, Q26)."""

from __future__ import annotations

import pytest

from apps.publishing.constants.permissions import PublishPermissions as P
from apps.publishing.models import PublishedFile, PublishedFileEvent
from apps.publishing.models.file import ImmutableRecordError
from apps.publishing.services.files import PublishedFileService
from apps.publishing.tests.helpers import (
    OTHER_SHA,
    member,
    published_version,
    registration,
    request_for,
    storage_root,
)

pytestmark = pytest.mark.django_db

IDENTITY_CHANGES = {
    "relative_path": "elsewhere/plate.exr",
    "sha256": OTHER_SHA,
    "size_bytes": 1,
    "role": "proxy",
    "frame_start": 1,
    "frame_end": 2,
}


@pytest.fixture
def file(project, root):
    user = member(project, P.CREATE)
    created, _ = PublishedFileService.register(
        actor=user,
        request=request_for(user),
        version_id=(version := published_version(project)).pk,
        data=registration(version, root),
    )
    return PublishedFile.objects.get(pk=created.pk)


@pytest.mark.parametrize("field", sorted(IDENTITY_CHANGES))
def test_save_refuses_a_change_to_what_was_registered(file, field):
    setattr(file, field, IDENTITY_CHANGES[field])

    with pytest.raises(ImmutableRecordError, match=field):
        file.save()
    assert PublishedFile.objects.get(pk=file.pk).relative_path == "shot/v001/plate.exr"


def test_the_object_register_returns_is_guarded_too(project, root):
    """A row created in this process has no database load to snapshot: it is guarded from its first save."""
    user = member(project, P.CREATE)
    version = published_version(project)
    created, _ = PublishedFileService.register(
        actor=user,
        request=request_for(user),
        version_id=version.pk,
        data=registration(version, root),
    )
    created.sha256 = OTHER_SHA

    with pytest.raises(ImmutableRecordError, match="sha256"):
        created.save()
    assert PublishedFile.objects.get(pk=created.pk).sha256 == "a" * 64


def test_a_lifecycle_save_does_not_trip_the_guard_and_keeps_guarding(file):
    file.checksum_state = "verified"
    file.save()
    file.size_bytes = 5

    with pytest.raises(ImmutableRecordError, match="size_bytes"):
        file.save()


def test_save_refuses_moving_a_file_to_another_version_root_or_project(file, project):
    for name, value in (
        ("version_id", published_version(project).pk),
        ("storage_root_id", storage_root("OTHER").pk),
    ):
        loaded = PublishedFile.objects.get(pk=file.pk)
        setattr(loaded, name, value)
        with pytest.raises(ImmutableRecordError, match=name):
            loaded.save()


def test_update_with_update_fields_cannot_smuggle_a_change(file):
    file.sha256 = OTHER_SHA

    with pytest.raises(ImmutableRecordError):
        file.save(update_fields=["sha256"])


def test_queryset_update_is_refused_for_identity_fields(file):
    with pytest.raises(ImmutableRecordError, match="sha256"):
        PublishedFile.objects.filter(pk=file.pk).update(sha256=OTHER_SHA)
    with pytest.raises(ImmutableRecordError):
        PublishedFile.all_objects.filter(pk=file.pk).update(relative_path="x", size_bytes=2)


def test_queryset_update_is_allowed_for_lifecycle_fields(file):
    assert PublishedFile.objects.filter(pk=file.pk).update(checksum_state="verified") == 1


def test_a_registered_file_cannot_be_deleted(file):
    with pytest.raises(ImmutableRecordError):
        file.delete()
    with pytest.raises(ImmutableRecordError):
        PublishedFile.objects.filter(pk=file.pk).delete()
    with pytest.raises(ImmutableRecordError):
        PublishedFile.all_objects.all().delete()
    assert PublishedFile.objects.filter(pk=file.pk).exists()


def test_it_cannot_be_soft_deleted_either(file):
    file.is_deleted = True

    with pytest.raises(ImmutableRecordError, match="is_deleted"):
        file.save()


def test_the_database_holds_the_format_rules_too(file):
    from django.db import IntegrityError, transaction

    for update in ({"sha256": "NOT-A-HASH"}, {"size_bytes": -1}, {"frame_start": 5}):
        with pytest.raises(IntegrityError), transaction.atomic():
            # raw SQL path: bypasses the model guard on purpose
            from django.db import connection

            column, value = next(iter(update.items()))
            with connection.cursor() as cursor:
                cursor.execute(
                    f"UPDATE publishing_file SET {column} = %s WHERE id = %s", [value, file.pk]
                )


def test_a_revoked_row_needs_a_reason_in_the_database(file):
    from django.db import IntegrityError, connection, transaction

    with pytest.raises(IntegrityError), transaction.atomic(), connection.cursor() as cursor:
        cursor.execute("UPDATE publishing_file SET status = 'Revoked' WHERE id = %s", [file.pk])


def test_the_attribution_columns_may_be_nulled_when_a_user_is_removed(file):
    """Django's SET_NULL on a hard-deleted user must not trip the guard."""
    assert PublishedFile.all_objects.filter(pk=file.pk).update(created_by=None) == 1
    loaded = PublishedFile.objects.get(pk=file.pk)
    loaded.created_by = None
    loaded.save()


class TestEventsAreAppendOnly:
    def test_an_event_cannot_be_changed_or_deleted(self, file):
        event = PublishedFileEvent.objects.get(file=file)

        event.reason = "edited"
        with pytest.raises(TypeError):
            event.save()
        with pytest.raises(TypeError):
            event.delete()
        with pytest.raises(TypeError):
            PublishedFileEvent.objects.filter(pk=event.pk).update(reason="x")
        with pytest.raises(TypeError):
            PublishedFileEvent.objects.filter(pk=event.pk).delete()
