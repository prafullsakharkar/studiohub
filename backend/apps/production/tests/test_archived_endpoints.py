"""
Shared soft-delete contract tests for production entities.

Every organization-owned production entity supports:

  * ``GET /archived/`` — list soft-deleted records of the active organization
    (requires the entity VIEW permission; deny-by-default without one);
  * ``POST /<id>/restore/`` — restore a soft-deleted record of the active
    organization (requires the entity UPDATE permission).

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
from apps.organization.tests.factories import OrganizationFactory
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


@pytest.mark.django_db
@pytest.mark.parametrize("basename,factory_cls", ARCHIVED_CASES)
def test_archived_lists_only_soft_deleted_scoped_to_org(
    staff_client, basename, factory_cls
):
    org = OrganizationFactory.create()
    other_org = OrganizationFactory.create()
    active = factory_cls.create(organization=org)
    archived = factory_cls.create(organization=org)
    SoftDeleteService.delete(archived)
    active.refresh_from_db()
    assert active.is_deleted is False

    resp = staff_client.get(
        reverse(f"api:v1:production:{basename}-archived"),
        HTTP_X_ORGANIZATION_ID=str(org.id),
    )
    assert resp.status_code == status.HTTP_200_OK, resp.data
    # Most entities paginate ({"results": [...]}); media is unpaginated.
    results = resp.data["results"] if isinstance(resp.data, dict) else resp.data
    ids = {item["id"] for item in results}
    assert str(archived.id) in ids
    assert str(active.id) not in ids

    other_resp = staff_client.get(
        reverse(f"api:v1:production:{basename}-archived"),
        HTTP_X_ORGANIZATION_ID=str(other_org.id),
    )
    assert other_resp.status_code == status.HTTP_200_OK
    other_results = (
        other_resp.data["results"]
        if isinstance(other_resp.data, dict)
        else other_resp.data
    )
    other_ids = {item["id"] for item in other_results}
    assert str(archived.id) not in other_ids


@pytest.mark.django_db
@pytest.mark.parametrize("basename,factory_cls", ARCHIVED_CASES)
def test_archived_without_org_context_fails_closed(staff_client, basename, factory_cls):
    resp = staff_client.get(reverse(f"api:v1:production:{basename}-archived"))
    assert resp.status_code == status.HTTP_400_BAD_REQUEST


@pytest.mark.django_db
@pytest.mark.parametrize("basename,factory_cls", RESTORE_CASES)
def test_restore_restores_soft_deleted(staff_client, basename, factory_cls):
    org = OrganizationFactory.create()
    instance = factory_cls.create(organization=org)
    SoftDeleteService.delete(instance)
    instance.refresh_from_db()
    assert instance.is_deleted is True

    resp = staff_client.post(
        reverse(f"api:v1:production:{basename}-restore", args=[instance.id]),
        HTTP_X_ORGANIZATION_ID=str(org.id),
    )
    assert resp.status_code == status.HTTP_200_OK, resp.data
    instance.refresh_from_db()
    assert instance.is_deleted is False


@pytest.mark.django_db
@pytest.mark.parametrize("basename,factory_cls", RESTORE_CASES)
def test_restore_is_scoped_to_organization(staff_client, basename, factory_cls):
    org = OrganizationFactory.create()
    other_org = OrganizationFactory.create()
    instance = factory_cls.create(organization=other_org)
    SoftDeleteService.delete(instance)

    resp = staff_client.post(
        reverse(f"api:v1:production:{basename}-restore", args=[instance.id]),
        HTTP_X_ORGANIZATION_ID=str(org.id),
    )
    assert resp.status_code == status.HTTP_404_NOT_FOUND
    instance.refresh_from_db()
    assert instance.is_deleted is True


@pytest.mark.django_db
@pytest.mark.parametrize("basename,factory_cls", RESTORE_CASES)
def test_restore_rejects_non_deleted(staff_client, basename, factory_cls):
    org = OrganizationFactory.create()
    instance = factory_cls.create(organization=org)

    resp = staff_client.post(
        reverse(f"api:v1:production:{basename}-restore", args=[instance.id]),
        HTTP_X_ORGANIZATION_ID=str(org.id),
    )
    assert resp.status_code == status.HTTP_404_NOT_FOUND
