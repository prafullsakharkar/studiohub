"""
Shots belong to a sequence by foreign key (WP B1; DECISIONS D-11).

``sequence_code`` stays in the API as a text copy that follows the sequence; writing it
directly is a 400, ``sequence_id`` (an id or a code of the shot's project) is how a shot is
placed. A shot may have no sequence.
"""

from __future__ import annotations

import pytest
from django.db.models import ProtectedError
from rest_framework.test import APIClient

from apps.identity.tests.factories import UserFactory
from apps.identity.tests.rbac_helpers import grant_permissions
from apps.production.models import ProjectMembership, Shot
from apps.production.tests.factories import ProjectFactory, SequenceFactory, ShotFactory

pytestmark = pytest.mark.django_db

CODES = ("shot.view", "shot.create", "shot.update", "sequence.view", "sequence.update")


@pytest.fixture
def project():
    return ProjectFactory.create(code="SEQ01P")


@pytest.fixture
def client(project):
    user = UserFactory.create()
    grant_permissions(user, *CODES)
    ProjectMembership.objects.create(user=user, project=project, status="active", role="Artist")
    api = APIClient()
    api.force_authenticate(user=user)
    return api


class TestPlacement:
    def test_create_with_a_sequence_id_or_code(self, client, project):
        sequence = SequenceFactory.create(project=project, code="SQ010")

        by_id = client.post(
            "/api/v1/shots/",
            {"project_id": str(project.id), "code": "S1", "sequence_id": str(sequence.id)},
            format="json",
        )
        by_code = client.post(
            "/api/v1/shots/",
            {"project_id": str(project.id), "code": "S2", "sequence_id": "sq010"},
            format="json",
        )

        assert by_id.status_code == by_code.status_code == 201, (by_id.json(), by_code.json())
        for shot in Shot.objects.filter(project=project):
            assert (shot.sequence_id, shot.sequence_code) == (sequence.id, "SQ010")
        assert by_id.json()["sequence_code"] == "SQ010"
        detail = client.get(f"/api/v1/shots/{by_id.json()['id']}/").json()
        assert (detail["sequence_id"], detail["sequence_code"]) == (str(sequence.id), "SQ010")

    def test_a_shot_may_have_no_sequence(self, client, project):
        resp = client.post(
            "/api/v1/shots/", {"project_id": str(project.id), "code": "S1"}, format="json"
        )

        assert resp.status_code == 201, resp.json()
        shot = Shot.objects.get(id=resp.json()["id"])
        assert (shot.sequence_id, shot.sequence_code) == (None, "")

    def test_a_sequence_of_another_project_reads_like_an_unknown_one(self, client, project):
        foreign = SequenceFactory.create(project=ProjectFactory.create(code="SEQ02P"), code="SQ010")

        foreign_id = client.post(
            "/api/v1/shots/",
            {"project_id": str(project.id), "code": "S1", "sequence_id": str(foreign.id)},
            format="json",
        )
        unknown = client.post(
            "/api/v1/shots/",
            {"project_id": str(project.id), "code": "S2", "sequence_id": "NOPE"},
            format="json",
        )

        assert foreign_id.status_code == unknown.status_code == 400
        assert "sequence_id" in foreign_id.json() and "sequence_id" in unknown.json()
        assert not Shot.objects.filter(project=project).exists()

    def test_moving_and_clearing(self, client, project):
        first = SequenceFactory.create(project=project, code="SQ010")
        second = SequenceFactory.create(project=project, code="SQ020")
        shot = ShotFactory.create(project=project, code="S1", sequence=first)

        moved = client.patch(f"/api/v1/shots/{shot.id}/", {"sequence_id": "SQ020"}, format="json")
        cleared = client.patch(f"/api/v1/shots/{shot.id}/", {"sequence_id": ""}, format="json")

        assert moved.status_code == cleared.status_code == 200
        shot.refresh_from_db()
        assert (shot.sequence_id, shot.sequence_code) == (None, "")
        assert second.shots.count() == 0

    def test_writing_sequence_code_directly_is_a_400(self, client, project):
        sequence = SequenceFactory.create(project=project, code="SQ010")
        shot = ShotFactory.create(project=project, code="S1", sequence=sequence)

        changed = client.patch(
            f"/api/v1/shots/{shot.id}/", {"sequence_code": "SQ999"}, format="json"
        )
        echoed = client.patch(
            f"/api/v1/shots/{shot.id}/", {"sequence_code": "SQ010", "name": "x"}, format="json"
        )
        created = client.post(
            "/api/v1/shots/",
            {"project_id": str(project.id), "code": "S2", "sequence_code": "SQ010"},
            format="json",
        )

        assert changed.status_code == 400 and "sequence_code" in changed.json()
        assert echoed.status_code == 200
        assert created.status_code == 400

    def test_bulk_create_places_shots_by_sequence_id(self, client, project):
        sequence = SequenceFactory.create(project=project, code="SQ010")

        resp = client.post(
            "/api/v1/shots/bulk-create/",
            {
                "items": [
                    {"project_id": str(project.id), "code": "B1", "sequence_id": "SQ010"},
                    {"project_id": str(project.id), "code": "B2", "sequence_id": "NOPE"},
                ]
            },
            format="json",
        )

        assert [row["status"] for row in resp.json()["results"]] == ["created", "invalid"]
        assert Shot.objects.get(project=project, code="B1").sequence_id == sequence.id


class TestRenameKeepsShots:
    def test_renaming_a_sequence_keeps_its_shots(self, client, project):
        sequence = SequenceFactory.create(project=project, code="SQ010")
        shots = [
            ShotFactory.create(project=project, code=f"S{i}", sequence=sequence) for i in range(3)
        ]

        resp = client.patch(f"/api/v1/sequences/{sequence.id}/", {"code": "SQ020"}, format="json")

        assert resp.status_code == 200, resp.json()
        for shot in shots:
            shot.refresh_from_db()
            assert (shot.sequence_id, shot.sequence_code) == (sequence.id, "SQ020")
        listed = client.get("/api/v1/shots/", {"sequence_code": "sq020"}).json()["results"]
        assert len(listed) == 3

    def test_the_sequence_count_follows_the_foreign_key(self, client, project):
        sequence = SequenceFactory.create(project=project, code="SQ010")
        other = SequenceFactory.create(project=project, code="SQ020")
        ShotFactory.create(project=project, code="S1", sequence=sequence)
        ShotFactory.create(project=project, code="S2", sequence=sequence)
        gone = ShotFactory.create(project=project, code="S3", sequence=sequence)
        gone.delete()
        ShotFactory.create(project=project, code="S4", sequence=other)

        rows = {
            row["code"]: row["shots_count"]
            for row in client.get("/api/v1/sequences/").json()["results"]
        }

        assert rows == {"SQ010": 2, "SQ020": 1}

    def test_the_count_does_not_query_per_row(self, client, project, django_assert_max_num_queries):
        for index in range(5):
            sequence = SequenceFactory.create(project=project, code=f"SQ{index}")
            ShotFactory.create(project=project, code=f"S{index}", sequence=sequence)

        with django_assert_max_num_queries(25):
            assert client.get("/api/v1/sequences/").status_code == 200


class TestFilter:
    def test_sequence_id_filter_takes_an_id_or_a_code(self, client, project):
        sequence = SequenceFactory.create(project=project, code="SQ010")
        ShotFactory.create(project=project, code="S1", sequence=sequence)
        ShotFactory.create(project=project, code="S2")

        by_id = client.get("/api/v1/shots/", {"sequence_id": str(sequence.id)}).json()["results"]
        by_code = client.get("/api/v1/shots/", {"sequence_id": "sq010"}).json()["results"]
        nothing = client.get("/api/v1/shots/", {"sequence_id": "NOPE"}).json()["results"]

        assert [row["code"] for row in by_id] == [row["code"] for row in by_code] == ["S1"]
        assert nothing == []


def test_a_sequence_with_shots_cannot_be_hard_deleted(project):
    sequence = SequenceFactory.create(project=project, code="SQ010")
    ShotFactory.create(project=project, code="S1", sequence=sequence)

    with pytest.raises(ProtectedError):
        sequence.hard_delete()
