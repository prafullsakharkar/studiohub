"""
Contract tests for the flat shows endpoint.

Shows subdivide projects into distributable cuts (main cut, trailer).
The frontend show switcher and ``show_id`` scoping resolve against
these rows; without them the UI falls back to synthetic ids.
"""

import pytest
from django.urls import reverse
from rest_framework import status

from apps.organization.tests.factories import (
    OrganizationFactory,
    OrganizationMembershipFactory,
)
from apps.organization.tests.rbac_helpers import grant_org_admin
from apps.production.models import Show
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
class TestShowEndpoints:
    def _list_url(self):
        return reverse("api:v1:production:show-list")

    def test_crud_lifecycle(self, staff_client, staff_user):
        org = _seed_org()
        grant_org_admin(staff_user, org)
        project = ProjectFactory.create(organization=org)

        create = staff_client.post(
            self._list_url(),
            {
                "project": str(project.id),
                "name": "Main Cut",
                "code": "MAIN",
                "type": "Feature Film",
                "is_primary": True,
            },
            format="json",
            **_org_header(org),
        )
        assert create.status_code == status.HTTP_201_CREATED, create.data
        show_id = create.data["id"]
        assert create.data["project_code"] == project.code
        assert create.data["type"] == "Feature Film"

        listing = staff_client.get(
            self._list_url() + f"?project_id={project.id}", **_org_header(org)
        )
        assert listing.status_code == status.HTTP_200_OK
        assert listing.data["count"] == 1

        detail_url = reverse(
            "api:v1:production:show-detail", kwargs={"uuid": show_id}
        )
        by_code = reverse(
            "api:v1:production:show-detail", kwargs={"uuid": "MAIN"}
        )
        assert (
            staff_client.get(by_code, **_org_header(org)).status_code
            == status.HTTP_200_OK
        )

        deleted = staff_client.delete(detail_url, **_org_header(org))
        assert deleted.status_code == status.HTTP_204_NO_CONTENT
        assert Show.objects.filter(pk=show_id).count() == 0

    def test_org_isolation(self, staff_client):
        org_a = _seed_org()
        org_b = _seed_org()
        project_b = ProjectFactory.create(organization=org_b)
        show = Show.objects.create(
            organization=org_b, project=project_b, name="Foreign", code="F1"
        )
        url = reverse(
            "api:v1:production:show-detail", kwargs={"uuid": str(show.id)}
        )
        assert (
            staff_client.get(url, **_org_header(org_a)).status_code
            == status.HTTP_404_NOT_FOUND
        )
        listing = staff_client.get(self._list_url(), **_org_header(org_a))
        assert listing.data["count"] == 0
