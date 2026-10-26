"""Frame ranges must not run backwards (WP B7): the serializers say 400, the database says no."""

from __future__ import annotations

import pytest
from django.db import IntegrityError, transaction
from rest_framework.test import APIClient

from apps.identity.tests.factories import UserFactory
from apps.identity.tests.rbac_helpers import grant_permissions
from apps.production.models import Episode, ProjectMembership, Sequence, Shot, Version
from apps.production.tests.factories import ProjectFactory, ShotFactory

pytestmark = pytest.mark.django_db


@pytest.fixture
def project():
    return ProjectFactory.create(code="FRM01")


def _client(project, *codes):
    user = UserFactory.create()
    grant_permissions(user, *codes)
    ProjectMembership.objects.create(user=user, project=project, status="active", role="Artist")
    client = APIClient()
    client.force_authenticate(user=user)
    return client


@pytest.mark.parametrize(
    ("model", "extra", "low", "high"),
    [
        (Shot, {"name": "n"}, "frame_in", "frame_out"),
        (Sequence, {"name": "n"}, "frame_in", "frame_out"),
        (Episode, {"name": "n", "season_number": 1, "episode_number": 1}, "frame_in", "frame_out"),
        (Version, {}, "start_frame", "end_frame"),
    ],
)
class TestDatabase:
    def test_a_backwards_range_is_refused(self, project, model, extra, low, high):
        with pytest.raises(IntegrityError, match="frame_range_ck"), transaction.atomic():
            model.objects.create(project=project, code="BAD1", **extra, **{low: 100, high: 99})

    def test_equal_and_forward_ranges_are_fine(self, project, model, extra, low, high):
        model.objects.create(project=project, code="OK1", **extra, **{low: 100, high: 100})
        model.objects.create(project=project, code="OK2", **extra, **{low: 100, high: 200})


def test_a_version_without_frames_is_fine(project):
    Version.objects.create(project=project, code="V1", start_frame=None, end_frame=None)
    Version.objects.create(project=project, code="V2", start_frame=10, end_frame=None)


class TestApi:
    def test_create_with_a_backwards_range_is_400(self, project):
        client = _client(project, "shot.view", "shot.create")

        resp = client.post(
            "/api/v1/shots/",
            {
                "project_id": str(project.id),
                "code": "S1",
                "name": "n",
                "frame_in": 1100,
                "frame_out": 1001,
            },
            format="json",
        )

        assert resp.status_code == 400
        assert "frame_out" in resp.json()

    def test_update_is_checked_against_the_stored_other_end(self, project):
        shot = ShotFactory.create(project=project, code="S1", frame_in=1001, frame_out=1100)
        client = _client(project, "shot.view", "shot.update")

        low = client.patch(f"/api/v1/shots/{shot.id}/", {"frame_in": 2000}, format="json")
        ok = client.patch(f"/api/v1/shots/{shot.id}/", {"frame_out": 1500}, format="json")

        assert low.status_code == 400
        assert ok.status_code == 200, ok.json()

    def test_a_bulk_update_item_with_a_backwards_range_is_invalid(self, project):
        shot = ShotFactory.create(project=project, code="S1", frame_in=1001, frame_out=1100)
        client = _client(project, "shot.view", "shot.update")

        resp = client.post(
            "/api/v1/shots/bulk-update/", [{"id": str(shot.id), "frame_out": 5}], format="json"
        )

        assert resp.status_code == 200
        shot.refresh_from_db()
        assert shot.frame_out == 1100
