"""
CR-13: ``archive`` and ``check-existence`` on projects and shows were missing from the viewsets'
``permission_map``, so ``HasPermission`` failed closed for everyone, superusers included. They are
mapped like the episode and sequence viewsets: archive needs ``<resource>.delete`` (DELETE already
archives). The existence checks stay unmapped: the viewsets do not implement them, and mapping them
would turn the fail-closed 403 into a 500 (``_existence_items_from_request`` is missing).
"""

from __future__ import annotations

import pytest
from rest_framework.test import APIClient

from apps.identity.tests.factories import UserFactory
from apps.identity.tests.rbac_helpers import grant_permissions
from apps.production.models import Project, ProjectMembership, Show
from apps.production.tests.factories import ProjectFactory, ShowFactory

pytestmark = pytest.mark.django_db


@pytest.fixture
def project():
    return ProjectFactory.create(code="ARCH1")


@pytest.fixture
def show(project):
    return ShowFactory.create(project=project, code="S1")


def _client(user, project=None):
    if project is not None:
        ProjectMembership.objects.create(user=user, project=project, status="active", role="Artist")
    client = APIClient()
    client.force_authenticate(user=user)
    return client


def _holder(project, *codes):
    user = UserFactory.create()
    grant_permissions(user, *codes)
    return _client(user, project)


class TestProjects:
    def test_a_holder_of_project_delete_archives_it(self, project):
        resp = _holder(project, "project.view", "project.delete").post(
            f"/api/v1/projects/{project.id}/archive/"
        )

        assert resp.status_code == 200, resp.json()
        assert Project.all_objects.get(pk=project.pk).is_deleted is True

    def test_without_project_delete_archive_is_refused_and_nothing_changes(self, project):
        resp = _holder(project, "project.view", "project.update", "project.create").post(
            f"/api/v1/projects/{project.id}/archive/"
        )

        assert resp.status_code == 403
        assert Project.all_objects.get(pk=project.pk).is_deleted is False

    def test_a_superuser_is_no_longer_locked_out(self, project):
        admin = UserFactory.create(is_superuser=True, is_staff=True)

        assert _client(admin).post(f"/api/v1/projects/{project.id}/archive/").status_code == 200

    @pytest.mark.parametrize("route", ["check-existence", "existence-check"])
    def test_the_existence_checks_are_not_implemented_and_fail_closed(self, project, route):
        """Pins the current limit: a 403 for everyone, never a 500. Delete this when they are implemented."""
        url = f"/api/v1/projects/{route}/"
        admin = UserFactory.create(is_superuser=True, is_staff=True)

        assert _client(admin).post(url, {"codes": [project.code]}, format="json").status_code == 403
        assert (
            _holder(project, "project.view", "project.create")
            .post(url, {"codes": [project.code]}, format="json")
            .status_code
            == 403
        )


class TestShows:
    def test_a_holder_of_show_delete_archives_it(self, project, show):
        resp = _holder(project, "show.view", "show.delete").post(
            f"/api/v1/shows/{show.id}/archive/"
        )

        assert resp.status_code == 200, resp.json()
        assert Show.all_objects.get(pk=show.pk).is_deleted is True

    def test_without_show_delete_archive_is_refused(self, project, show):
        resp = _holder(project, "show.view", "show.update", "show.create").post(
            f"/api/v1/shows/{show.id}/archive/"
        )

        assert resp.status_code == 403
        assert Show.all_objects.get(pk=show.pk).is_deleted is False

    @pytest.mark.parametrize("route", ["check-existence", "existence-check"])
    def test_the_existence_checks_are_not_implemented_and_fail_closed(self, project, show, route):
        body = {"project_id": str(project.id), "codes": [show.code]}

        assert (
            _holder(project, "show.view", "show.create")
            .post(f"/api/v1/shows/{route}/", body, format="json")
            .status_code
            == 403
        )
