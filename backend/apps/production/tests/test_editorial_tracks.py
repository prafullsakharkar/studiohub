"""
Contract tests for the flat editorial-tracks endpoint.

The TracksPage (editorial tab) speaks ``/api/v1/editorial/tracks`` with
full CRUD in both modes; the backend previously had no flat route here
(only nested project-scoped editorial cuts), so rest mode 404'd.
"""

import pytest
from django.urls import reverse
from rest_framework import status

from apps.organization.tests.factories import (
    OrganizationFactory,
    OrganizationMembershipFactory,
)
from apps.organization.tests.rbac_helpers import grant_org_admin
from apps.production.models import EditorialTrack
from apps.production.tests.factories import ProjectFactory


def _org_header(org):
    return {"HTTP_X_ORGANIZATION_ID": str(org.id)}


def _seed_org():
    from apps.identity.tests.factories import UserFactory

    org = OrganizationFactory.create()
    user = UserFactory.create()
    OrganizationMembershipFactory.create(organization=org, user=user)
    return org


@pytest.mark.django_db
class TestEditorialTrackEndpoints:
    def _list_url(self):
        return reverse("api:v1:production:editorial-track-list")

    def test_crud_lifecycle(self, staff_client, staff_user):
        org = _seed_org()
        grant_org_admin(staff_user, org)
        project = ProjectFactory.create(organization=org)

        create = staff_client.post(
            self._list_url(),
            {
                "project": str(project.id),
                "name": "V1 - Main Plates",
                "track_type": "Video",
                "track_number": 1,
            },
            format="json",
            **_org_header(org),
        )
        assert create.status_code == status.HTTP_201_CREATED, create.data
        track_id = create.data["id"]
        assert create.data["project_code"] == project.code

        listing = staff_client.get(self._list_url(), **_org_header(org))
        assert listing.status_code == status.HTTP_200_OK
        assert listing.data["count"] == 1
        assert listing.data["results"][0]["name"] == "V1 - Main Plates"

        detail_url = reverse(
            "api:v1:production:editorial-track-detail",
            kwargs={"uuid": track_id},
        )
        patched = staff_client.patch(
            detail_url, {"is_locked": True}, format="json", **_org_header(org)
        )
        assert patched.status_code == status.HTTP_200_OK
        assert patched.data["is_locked"] is True

        deleted = staff_client.delete(detail_url, **_org_header(org))
        assert deleted.status_code == status.HTTP_204_NO_CONTENT
        assert EditorialTrack.objects.filter(pk=track_id).count() == 0

    def test_org_isolation(self, staff_client):
        org_a = _seed_org()
        org_b = _seed_org()
        project_b = ProjectFactory.create(organization=org_b)
        track = EditorialTrack.objects.create(
            organization=org_b,
            project=project_b,
            name="Foreign track",
            track_number=1,
        )
        # Cross-org id resolves to 404, never leaks.
        url = reverse(
            "api:v1:production:editorial-track-detail",
            kwargs={"uuid": str(track.id)},
        )
        response = staff_client.get(url, **_org_header(org_a))
        assert response.status_code == status.HTTP_404_NOT_FOUND
        # And the list only shows the caller's org.
        listing = staff_client.get(self._list_url(), **_org_header(org_a))
        assert listing.data["count"] == 0
