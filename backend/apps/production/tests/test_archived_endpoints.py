"""
Shared soft-delete contract tests for production entities.

Every project-scoped production entity supports:

  * ``GET /archived/`` — list soft-deleted records of the caller's member
    projects (requires the entity VIEW permission; empty without
    membership);
  * ``POST /<id>/restore/`` — restore a soft-deleted record of a member
    project (requires the entity UPDATE permission).

Task and Playlist define custom restore actions (business-flag semantics
combined with soft-delete for Task) and are exercised by their own tests;
Sequence, Shot, Asset and Task keep their detailed bulk coverage in their
own test modules. The parametrized cases below lock the shared contract for
every remaining entity.
"""
import pytest
from django.urls import reverse
from rest_framework import status

from apps.core.services.soft_delete import SoftDeleteService
from apps.production.models import ProjectMembership
from apps.production.tests.factories import (
    EditorialTrackFactory,
    MediaFactory,
    PlaylistFactory,
    ProjectFactory,
    ReviewFactory,
    ShowFactory,
    TimelogFactory,
    VersionFactory,
    WorkflowFactory,
)

ARCHIVED_CASES = [
    ("project", ProjectFactory),
    ("show", ShowFactory),
    ("editorial-track", EditorialTrackFactory),
    ("version", VersionFactory),
    ("review", ReviewFactory),
    ("playlist", PlaylistFactory),
    ("media", MediaFactory),
    ("timelog", TimelogFactory),
    ("workflow", WorkflowFactory),
]

# Entities whose restore action is the shared base implementation
# (Task and Playlist override it with custom business-flag semantics).
RESTORE_CASES = [
    ("project", ProjectFactory),
    ("show", ShowFactory),
    ("editorial-track", EditorialTrackFactory),
    ("version", VersionFactory),
    ("review", ReviewFactory),
    ("media", MediaFactory),
    ("timelog", TimelogFactory),
    ("workflow", WorkflowFactory),
]


def _member(user, project):
    return ProjectMembership.objects.create(
        user=user, project=project, status="active", role="Artist"
    )


def _project_of(instance):
    project = getattr(instance, "project", None)
    if project is None:
        # Project itself and Timelog (project derived from its task).
        task = getattr(instance, "task", None)
        if task is not None:
            return task.project
        return instance
    return project


@pytest.mark.django_db
@pytest.mark.parametrize("basename,factory_cls", ARCHIVED_CASES)
def test_archived_lists_only_soft_deleted_scoped_to_membership(
    staff_client, staff_user, basename, factory_cls
):
    if basename == "project":
        # Projects scope to themselves: memberships go on the archived rows.
        active = ProjectFactory.create()
        archived = ProjectFactory.create()
        other_archived = ProjectFactory.create()
        _member(staff_user, archived)
        _member(staff_user, other_archived)
        in_project, out_project = archived, other_archived
    else:
        in_project = _project_of(factory_cls.create())
        out_project = ProjectFactory.create()
        _member(staff_user, in_project)
        _member(staff_user, out_project)
        active = factory_cls.create(project=in_project)
        archived = factory_cls.create(project=in_project)
        other_archived = factory_cls.create(project=out_project)
    SoftDeleteService.delete(archived)
    SoftDeleteService.delete(other_archived)
    active.refresh_from_db()
    assert active.is_deleted is False

    resp = staff_client.get(reverse(f"api:v1:production:{basename}-archived"))
    assert resp.status_code == status.HTTP_200_OK, resp.data
    # Most entities paginate ({"results": [...]}); media is unpaginated.
    results = resp.data["results"] if isinstance(resp.data, dict) else resp.data
    ids = {item["id"] for item in results}
    assert str(archived.id) in ids
    assert str(other_archived.id) in ids
    assert str(active.id) not in ids

    # Revoke membership on the second project: its rows disappear.
    ProjectMembership.objects.filter(
        user=staff_user, project=out_project
    ).delete()
    other_resp = staff_client.get(
        reverse(f"api:v1:production:{basename}-archived")
    )
    assert other_resp.status_code == status.HTTP_200_OK
    other_results = (
        other_resp.data["results"]
        if isinstance(other_resp.data, dict)
        else other_resp.data
    )
    other_ids = {item["id"] for item in other_results}
    assert str(archived.id) in other_ids
    assert str(other_archived.id) not in other_ids


@pytest.mark.django_db
@pytest.mark.parametrize("basename,factory_cls", ARCHIVED_CASES)
def test_archived_without_membership_returns_empty(
    staff_client, basename, factory_cls
):
    resp = staff_client.get(reverse(f"api:v1:production:{basename}-archived"))
    assert resp.status_code == status.HTTP_200_OK
    results = resp.data["results"] if isinstance(resp.data, dict) else resp.data
    assert results == []


@pytest.mark.django_db
@pytest.mark.parametrize("basename,factory_cls", RESTORE_CASES)
def test_restore_restores_soft_deleted(staff_client, staff_user, basename, factory_cls):
    instance = factory_cls.create()
    _member(staff_user, _project_of(instance))
    SoftDeleteService.delete(instance)
    instance.refresh_from_db()
    assert instance.is_deleted is True

    resp = staff_client.post(
        reverse(f"api:v1:production:{basename}-restore", args=[instance.id]),
    )
    assert resp.status_code == status.HTTP_200_OK, resp.data
    instance.refresh_from_db()
    assert instance.is_deleted is False


@pytest.mark.django_db
@pytest.mark.parametrize("basename,factory_cls", RESTORE_CASES)
def test_restore_is_scoped_to_membership(staff_client, staff_user, basename, factory_cls):
    in_project = ProjectFactory.create()
    out_project = ProjectFactory.create()
    _member(staff_user, in_project)
    if basename == "project":
        instance = ProjectFactory.create()
    else:
        instance = factory_cls.create(project=out_project)
    SoftDeleteService.delete(instance)

    resp = staff_client.post(
        reverse(f"api:v1:production:{basename}-restore", args=[instance.id]),
    )
    assert resp.status_code == status.HTTP_404_NOT_FOUND
    instance.refresh_from_db()
    assert instance.is_deleted is True


@pytest.mark.django_db
@pytest.mark.parametrize("basename,factory_cls", RESTORE_CASES)
def test_restore_rejects_non_deleted(staff_client, staff_user, basename, factory_cls):
    instance = factory_cls.create()
    _member(staff_user, _project_of(instance))

    resp = staff_client.post(
        reverse(f"api:v1:production:{basename}-restore", args=[instance.id]),
    )
    assert resp.status_code == status.HTTP_404_NOT_FOUND
