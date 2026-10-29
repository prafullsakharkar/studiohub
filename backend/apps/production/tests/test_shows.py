"""
Contract tests for the flat shows endpoint.

Shows subdivide projects into distributable cuts (main cut, trailer).
The frontend show switcher and ``show_id`` scoping resolve against
these rows; without them the UI falls back to synthetic ids.
"""

import pytest
from django.urls import reverse
from rest_framework import status

from apps.production.models import ProjectMembership, Show
from apps.production.tests.factories import ProjectFactory


@pytest.mark.django_db
class TestShowEndpoints:
    def _list_url(self):
        return reverse("api:v1:production:show-list")

    def test_crud_lifecycle(self, staff_client, staff_user):
        project = ProjectFactory.create()
        ProjectMembership.objects.create(
            user=staff_user, project=project, status="active", role="Artist"
        )

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
        )
        assert create.status_code == status.HTTP_201_CREATED, create.data
        show_id = create.data["id"]
        assert create.data["project_code"] == project.code
        assert create.data["type"] == "Feature Film"

        listing = staff_client.get(
            self._list_url() + f"?project_id={project.id}"
        )
        assert listing.status_code == status.HTTP_200_OK
        assert listing.data["count"] == 1

        detail_url = reverse(
            "api:v1:production:show-detail", kwargs={"uuid": show_id}
        )
        by_code = reverse(
            "api:v1:production:show-detail", kwargs={"uuid": "MAIN"}
        )
        assert staff_client.get(by_code).status_code == status.HTTP_200_OK

        deleted = staff_client.delete(detail_url)
        assert deleted.status_code == status.HTTP_204_NO_CONTENT
        assert Show.objects.filter(pk=show_id).count() == 0

    def test_cross_project_isolation(self, staff_client, staff_user):
        project_a = ProjectFactory.create()
        project_b = ProjectFactory.create()
        ProjectMembership.objects.create(
            user=staff_user, project=project_a, status="active", role="Artist"
        )
        show = Show.objects.create(
            project=project_b, name="Foreign", code="F1"
        )
        url = reverse(
            "api:v1:production:show-detail", kwargs={"uuid": str(show.id)}
        )
        assert staff_client.get(url).status_code == status.HTTP_404_NOT_FOUND
        listing = staff_client.get(self._list_url())
        assert listing.data["count"] == 0
