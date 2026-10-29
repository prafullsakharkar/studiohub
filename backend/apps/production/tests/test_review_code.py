"""
Review code auto-generation tests.

The frontend review form omits ``code``: the create serializer generates
it from the title so creates do not fail validation. Regression coverage
for the reported ``POST /api/v1/reviews/ -> 400 errors={'code': [...]}``
failure.
"""

import pytest
from django.urls import reverse
from rest_framework import status

from apps.production.models import ProjectMembership, Review
from apps.production.tests.factories import ProjectFactory


@pytest.mark.django_db
class TestReviewCodeAutoGeneration:
    def _list_url(self):
        return reverse("api:v1:production:review-list")

    def _project(self, staff_user):
        project = ProjectFactory.create()
        ProjectMembership.objects.create(
            user=staff_user, project=project, status="active", role="Artist"
        )
        return project

    def test_create_without_code_generates_from_title(
        self, staff_client, staff_user
    ):
        project = self._project(staff_user)
        resp = staff_client.post(
            self._list_url(),
            data={"project": str(project.id), "title": "Compositing Review Round 2"},
            format="json",
        )
        assert resp.status_code == status.HTTP_201_CREATED, resp.data
        assert resp.data["code"] == "compositing-review-round-2"

        review = Review.objects.get(id=resp.data["id"])
        assert review.code == "compositing-review-round-2"

    def test_create_with_explicit_code_preserves_it(self, staff_client, staff_user):
        project = self._project(staff_user)
        resp = staff_client.post(
            self._list_url(),
            data={
                "project": str(project.id),
                "title": "Anything",
                "code": "CUSTOM-01",
            },
            format="json",
        )
        assert resp.status_code == status.HTTP_201_CREATED, resp.data
        assert resp.data["code"] == "CUSTOM-01"
