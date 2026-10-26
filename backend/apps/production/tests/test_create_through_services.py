"""
Creates and bulk creates go through the services (analysis findings F-H5,
F-M6, F-M9, WP A4, A6).
"""

from __future__ import annotations

from unittest import mock

import pytest
from django.db import IntegrityError
from rest_framework import status
from rest_framework.test import APIClient

from apps.identity.tests.factories import UserFactory
from apps.identity.tests.rbac_helpers import grant_permissions
from apps.production.models import Episode, Project, ProjectMembership, Shot
from apps.production.tests.factories import EpisodeFactory, ProjectFactory, ShotFactory

pytestmark = pytest.mark.django_db


def _user(*codes, project=None, admin=False):
    user = UserFactory.create(is_superuser=admin)
    if codes:
        grant_permissions(user, *codes)
    if project is not None:
        ProjectMembership.objects.create(user=user, project=project, status="active", role="Artist")
    return user


def _client(user):
    client = APIClient()
    client.force_authenticate(user=user)
    return client


class TestAuditFields:
    def test_single_create_and_update_record_the_user(self):
        project = ProjectFactory.create(code="SVC1")
        user = _user("shot.view", "shot.create", "shot.update", project=project)
        client = _client(user)

        created = client.post(
            "/api/v1/shots/",
            {"project_id": str(project.id), "code": "S1", "name": "n"},
            format="json",
        )
        assert created.status_code == 201, created.json()
        shot = Shot.objects.get(id=created.json()["id"])
        assert (shot.created_by_id, shot.updated_by_id) == (user.id, user.id)

        other = _user("shot.view", "shot.update", project=project)
        _client(other).patch(f"/api/v1/shots/{shot.id}/", {"name": "renamed"}, format="json")
        shot.refresh_from_db()
        assert (shot.created_by_id, shot.updated_by_id) == (user.id, other.id)


class TestProjectCreate:
    BODY = {"code": "NEWP", "name": "New", "workflow_type": "episodic"}

    def test_creator_becomes_a_member_and_sees_the_project(self):
        user = _user("project.view", "project.create")
        client = _client(user)

        created = client.post("/api/v1/projects/", self.BODY, format="json")

        assert created.status_code == 201, created.json()
        assert ProjectMembership.objects.filter(
            project_id=created.json()["id"], user=user, status="active", role="Production Admin"
        ).exists()
        listed = client.get("/api/v1/projects/")
        assert [row["code"] for row in listed.json()["results"]] == ["NEWP"]
        assert Project.objects.get(code="NEWP").created_by_id == user.id

    def test_platform_admin_gets_no_membership(self):
        admin = _user(admin=True)

        created = _client(admin).post("/api/v1/projects/", self.BODY, format="json")

        assert created.status_code == 201, created.json()
        assert not ProjectMembership.objects.filter(user=admin).exists()

    def test_a_failure_after_the_insert_leaves_nothing_behind(self):
        user = _user("project.view", "project.create")

        with mock.patch(
            "apps.production.api.viewsets.project.Episode.objects.create",
            side_effect=IntegrityError,
        ):
            resp = _client(user).post("/api/v1/projects/", self.BODY, format="json")

        assert resp.status_code == status.HTTP_409_CONFLICT
        assert not Project.objects.filter(code="NEWP").exists()
        assert not ProjectMembership.objects.filter(user=user).exists()
        assert not Episode.objects.exists()


class TestBulkCreate:
    CODES = ("shot.view", "shot.create")

    def post(self, user, items, **extra):
        return _client(user).post(
            "/api/v1/shots/bulk-create/", {"items": items, **extra}, format="json"
        )

    def test_items_are_stored_like_a_single_create(self):
        project = ProjectFactory.create(code="BULK1")
        user = _user(*self.CODES, project=project)

        resp = self.post(user, [{"project_id": str(project.id), "code": "b1", "name": "One"}])

        assert resp.status_code == 200, resp.json()
        shot = Shot.objects.get(project=project, code="B1")
        assert (shot.name, shot.created_by_id) == ("One", user.id)

    def test_fields_a_single_create_cannot_set_are_ignored(self):
        project = ProjectFactory.create(code="BULK1")
        forger = UserFactory.create()
        user = _user(*self.CODES, project=project)

        resp = self.post(
            user,
            [
                {
                    "project_id": str(project.id),
                    "code": "B1",
                    "is_deleted": True,
                    "created_by_id": str(forger.id),
                }
            ],
        )

        assert resp.status_code == 200, resp.json()
        shot = Shot.objects.get(project=project, code="B1")
        assert shot.created_by_id == user.id and shot.is_deleted is False

    def test_locked_fields_make_the_item_invalid(self):
        project = ProjectFactory.create(code="BULK1")
        user = _user(*self.CODES, project=project)

        resp = self.post(
            user, [{"project_id": str(project.id), "code": "B1", "supervisor_approved": True}]
        )

        assert resp.json()["results"][0]["status"] == "invalid"
        assert not Shot.objects.filter(project=project, code="B1").exists()

    def test_form_path_only_takes_serializer_fields(self):
        project = ProjectFactory.create(code="BULK1")
        forger = UserFactory.create()
        user = _user(*self.CODES, project=project)

        resp = self.post(
            user,
            [
                {
                    "data": {
                        "code": "B1",
                        "name": "One",
                        "is_deleted": True,
                        "created_by_id": str(forger.id),
                    }
                }
            ],
            project_id=str(project.id),
        )

        assert resp.status_code == 200, resp.json()
        shot = Shot.objects.get(project=project, code="B1")
        assert shot.is_deleted is False and shot.created_by_id == user.id

    def test_episodic_project_requires_an_episode_per_item(self):
        project = ProjectFactory.create(code="BULK2", workflow_type="episodic")
        episode = EpisodeFactory.create(project=project, code="EP101")
        user = _user(*self.CODES, project=project)

        resp = self.post(
            user,
            [
                {"project_id": str(project.id), "code": "B1"},
                {"project_id": str(project.id), "code": "B2", "episode_id": "EP101"},
            ],
        )

        statuses = [row["status"] for row in resp.json()["results"]]
        assert statuses == ["invalid", "created"]
        assert Shot.objects.get(project=project, code="B2").episode_id == episode.id
        assert not Shot.objects.filter(project=project, code="B1").exists()

    def test_foreign_episode_is_invalid(self):
        project = ProjectFactory.create(code="BULK2", workflow_type="episodic")
        other = ProjectFactory.create(code="BULK3", workflow_type="episodic")
        foreign = EpisodeFactory.create(project=other, code="EP101")
        user = _user(*self.CODES, project=project)

        resp = self.post(
            user, [{"project_id": str(project.id), "code": "B1", "episode_id": str(foreign.id)}]
        )

        assert resp.json()["results"][0]["status"] == "invalid"
        assert not Shot.objects.filter(project=project).exists()

    def test_locked_and_guarded_values_make_the_item_invalid(self):
        project = ProjectFactory.create(code="BULK1")
        user = _user(*self.CODES, project=project)

        resp = self.post(
            user,
            [
                {"project_id": str(project.id), "code": "B1", "status": "Approved"},
                {"project_id": str(project.id), "code": "B2", "status": "In Progress"},
            ],
        )

        assert [row["status"] for row in resp.json()["results"]] == ["invalid", "created"]

    def test_database_errors_are_not_sent_to_the_client(self):
        project = ProjectFactory.create(code="BULK1")
        user = _user(*self.CODES, project=project)

        with mock.patch(
            "apps.production.services.shot.ShotService.create",
            side_effect=IntegrityError(
                'duplicate key value violates unique constraint "secret_idx"'
            ),
        ):
            resp = self.post(user, [{"project_id": str(project.id), "code": "B1"}])

        row = resp.json()["results"][0]
        assert row["status"] == "invalid"
        assert "secret_idx" not in str(resp.json())

    def test_a_bad_item_does_not_roll_back_the_others(self):
        project = ProjectFactory.create(code="BULK1")
        ShotFactory.create(project=project, code="TAKEN")
        user = _user(*self.CODES, project=project)

        resp = self.post(
            user,
            [
                {"project_id": str(project.id), "code": "OK1"},
                {"project_id": str(project.id), "code": "TAKEN"},
                {"project_id": str(project.id), "code": "OK2", "frame_in": "x"},
            ],
        )

        assert [row["status"] for row in resp.json()["results"]] == ["created", "exists", "invalid"]
        assert Shot.objects.filter(project=project, code__in=["OK1", "TAKEN"]).count() == 2
        assert resp.status_code == status.HTTP_200_OK
