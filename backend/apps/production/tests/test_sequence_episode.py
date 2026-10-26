"""
Sequences belong to an episode on episodic projects; their shots follow (D-12), and a
parent with live children cannot be archived (D-13).
"""

from __future__ import annotations

import pytest
from django.db.models import ProtectedError
from rest_framework.test import APIClient

from apps.identity.tests.factories import UserFactory
from apps.identity.tests.rbac_helpers import grant_permissions
from apps.production.models import Episode, ProjectMembership, Sequence, Shot
from apps.production.tests.factories import (
    EpisodeFactory,
    ProjectFactory,
    SequenceFactory,
    ShotFactory,
)

pytestmark = pytest.mark.django_db

CODES = (
    "shot.view", "shot.create", "shot.update", "shot.delete",
    "sequence.view", "sequence.create", "sequence.update", "sequence.delete",
    "episode.view", "episode.create", "episode.update", "episode.delete",
)  # fmt: skip


def _client(*projects):
    user = UserFactory.create()
    grant_permissions(user, *CODES)
    for project in projects:
        ProjectMembership.objects.create(user=user, project=project, status="active", role="Artist")
    api = APIClient()
    api.force_authenticate(user=user)
    return api


@pytest.fixture
def show():
    return ProjectFactory.create(code="EPIS1", workflow_type="episodic")


@pytest.fixture
def flat():
    return ProjectFactory.create(code="FLAT1", workflow_type="standard")


@pytest.fixture
def ep1(show):
    return EpisodeFactory.create(project=show, code="EP101")


@pytest.fixture
def ep2(show):
    return EpisodeFactory.create(project=show, code="EP102")


class TestSequenceEpisodeRule:
    def test_an_episodic_sequence_needs_an_episode(self, show, ep1):
        client = _client(show)

        missing = client.post(
            "/api/v1/sequences/", {"project_id": str(show.id), "code": "SQ1"}, format="json"
        )
        blank = client.post(
            "/api/v1/sequences/",
            {"project_id": str(show.id), "code": "SQ1", "episode_id": ""},
            format="json",
        )
        ok = client.post(
            "/api/v1/sequences/",
            {"project_id": str(show.id), "code": "SQ1", "episode_id": "ep101"},
            format="json",
        )

        assert missing.status_code == blank.status_code == 400
        assert "episode_id" in missing.json() or "episode_id" in str(missing.json())
        assert ok.status_code == 201, ok.json()
        assert Sequence.objects.get(code="SQ1").episode_id == ep1.id

    def test_the_episode_must_belong_to_the_project(self, show, flat):
        other = EpisodeFactory.create(project=flat, code="EPX")
        client = _client(show, flat)

        for ref in (str(other.id), "EPX", "no-such-episode"):
            resp = client.post(
                "/api/v1/sequences/",
                {"project_id": str(show.id), "code": "SQ1", "episode_id": ref},
                format="json",
            )
            assert resp.status_code == 400
            assert "Unknown episode." in str(resp.json())

    def test_a_standard_project_takes_no_episode(self, flat):
        episode = EpisodeFactory.create(project=flat, code="EPY")
        client = _client(flat)

        refused = client.post(
            "/api/v1/sequences/",
            {"project_id": str(flat.id), "code": "SQ1", "episode_id": str(episode.id)},
            format="json",
        )
        plain = client.post(
            "/api/v1/sequences/", {"project_id": str(flat.id), "code": "SQ2"}, format="json"
        )
        empty = client.post(
            "/api/v1/sequences/",
            {"project_id": str(flat.id), "code": "SQ3", "episode_id": ""},
            format="json",
        )

        assert refused.status_code == 400
        assert "not used on standard projects" in str(refused.json())
        assert plain.status_code == empty.status_code == 201

    def test_an_older_sequence_without_an_episode_can_still_be_edited_but_not_cleared(
        self, show, ep1
    ):
        legacy = SequenceFactory.create(project=show, code="OLD")
        client = _client(show)

        rename = client.patch(f"/api/v1/sequences/{legacy.id}/", {"name": "renamed"}, format="json")
        clear = client.patch(f"/api/v1/sequences/{legacy.id}/", {"episode_id": ""}, format="json")
        assign = client.patch(
            f"/api/v1/sequences/{legacy.id}/", {"episode_id": "EP101"}, format="json"
        )

        assert rename.status_code == 200, rename.json()
        assert clear.status_code == 400
        assert assign.status_code == 200
        legacy.refresh_from_db()
        assert legacy.episode_id == ep1.id

    def test_responses_and_the_filter_carry_the_episode(self, show, ep1, ep2):
        a = SequenceFactory.create(project=show, code="A", episode=ep1)
        SequenceFactory.create(project=show, code="B", episode=ep2)
        client = _client(show)

        detail = client.get(f"/api/v1/sequences/{a.id}/").json()
        by_id = client.get("/api/v1/sequences/", {"episode_id": str(ep1.id)}).json()["results"]
        by_code = client.get("/api/v1/sequences/", {"episode_id": "ep102"}).json()["results"]

        assert detail["episode_id"] == str(ep1.id)
        assert [r["code"] for r in by_id] == ["A"]
        assert [r["code"] for r in by_code] == ["B"]

    def test_bulk_create_applies_the_same_rule(self, show, ep1):
        client = _client(show)

        resp = client.post(
            "/api/v1/sequences/bulk-create/",
            {
                "items": [
                    {"project_id": str(show.id), "code": "BQ1", "episode_id": "EP101"},
                    {"project_id": str(show.id), "code": "BQ2"},
                ]
            },
            format="json",
        )

        assert [row["status"] for row in resp.json()["results"]] == ["created", "invalid"]
        assert Sequence.objects.filter(code="BQ1", episode=ep1).exists()
        assert not Sequence.objects.filter(code="BQ2").exists()


class TestShotsFollowTheirSequence:
    def test_a_new_shot_takes_the_episode_of_its_sequence(self, show, ep1):
        sequence = SequenceFactory.create(project=show, code="SQ1", episode=ep1)
        client = _client(show)

        resp = client.post(
            "/api/v1/shots/",
            {"project_id": str(show.id), "code": "S1", "sequence_id": str(sequence.id)},
            format="json",
        )

        assert resp.status_code == 201, resp.json()
        assert Shot.objects.get(code="S1").episode_id == ep1.id

    def test_an_episode_that_differs_from_the_sequences_is_a_400(self, show, ep1, ep2):
        sequence = SequenceFactory.create(project=show, code="SQ1", episode=ep1)
        client = _client(show)

        resp = client.post(
            "/api/v1/shots/",
            {
                "project_id": str(show.id),
                "code": "S1",
                "sequence_id": "SQ1",
                "episode_id": str(ep2.id),
            },
            format="json",
        )
        same = client.post(
            "/api/v1/shots/",
            {
                "project_id": str(show.id),
                "code": "S2",
                "sequence_id": "SQ1",
                "episode_id": str(ep1.id),
            },
            format="json",
        )

        assert resp.status_code == 400
        assert "episode of the sequence" in str(resp.json())
        assert same.status_code == 201
        assert not Shot.objects.filter(code="S1").exists()
        assert sequence.episode_id == ep1.id

    def test_moving_a_shot_to_another_sequence_moves_its_episode(self, show, ep1, ep2):
        SequenceFactory.create(project=show, code="SQ1", episode=ep1)
        SequenceFactory.create(project=show, code="SQ2", episode=ep2)
        client = _client(show)
        created = client.post(
            "/api/v1/shots/",
            {"project_id": str(show.id), "code": "S1", "sequence_id": "SQ1"},
            format="json",
        ).json()

        moved = client.patch(
            f"/api/v1/shots/{created['id']}/", {"sequence_id": "SQ2"}, format="json"
        )

        assert moved.status_code == 200, moved.json()
        shot = Shot.objects.get(code="S1")
        assert (shot.sequence.code, shot.episode_id) == ("SQ2", ep2.id)

    def test_a_shot_without_a_sequence_still_needs_its_own_episode(self, show, ep1):
        client = _client(show)

        bare = client.post(
            "/api/v1/shots/", {"project_id": str(show.id), "code": "S1"}, format="json"
        )
        own = client.post(
            "/api/v1/shots/",
            {"project_id": str(show.id), "code": "S2", "episode_id": "EP101"},
            format="json",
        )

        assert bare.status_code == 400
        assert own.status_code == 201

    def test_a_sequence_without_an_episode_leaves_the_shots_episode_alone(self, show, ep1):
        SequenceFactory.create(project=show, code="OLD")
        client = _client(show)

        resp = client.post(
            "/api/v1/shots/",
            {"project_id": str(show.id), "code": "S1", "sequence_id": "OLD", "episode_id": "EP101"},
            format="json",
        )

        assert resp.status_code == 201, resp.json()
        assert Shot.objects.get(code="S1").episode_id == ep1.id

    def test_moving_a_sequence_to_another_episode_takes_its_shots(self, show, ep1, ep2):
        sequence = SequenceFactory.create(project=show, code="SQ1", episode=ep1)
        ShotFactory.create(project=show, code="S1", sequence=sequence, episode=ep1)
        ShotFactory.create(project=show, code="S2", sequence=sequence, episode=ep1, is_deleted=True)
        client = _client(show)

        resp = client.patch(
            f"/api/v1/sequences/{sequence.id}/", {"episode_id": "EP102"}, format="json"
        )

        assert resp.status_code == 200, resp.json()
        assert set(
            Shot.all_objects.filter(sequence=sequence).values_list("episode_id", flat=True)
        ) == {ep2.id}

    def test_an_episode_with_sequences_cannot_be_hard_deleted(self, show, ep1):
        SequenceFactory.create(project=show, code="SQ1", episode=ep1)

        with pytest.raises(ProtectedError):
            ep1.hard_delete()


class TestParentsWithLiveChildrenCannotBeArchived:
    @pytest.fixture
    def tree(self, show, ep1):
        sequence = SequenceFactory.create(project=show, code="SQ1", episode=ep1)
        shot = ShotFactory.create(project=show, code="S1", sequence=sequence, episode=ep1)
        return sequence, shot

    def test_a_sequence_with_a_live_shot_is_refused_every_way(self, show, tree):
        sequence, _ = tree
        client = _client(show)

        destroy = client.delete(f"/api/v1/sequences/{sequence.id}/")
        archive = client.post(f"/api/v1/sequences/{sequence.id}/archive/")
        bulk = client.post(
            "/api/v1/sequences/bulk-archive/", {"ids": [str(sequence.id)]}, format="json"
        )

        assert destroy.status_code == archive.status_code == 400
        assert "1 shot" in str(destroy.json()) and "Archive or move them first" in str(
            archive.json()
        )
        assert bulk.json()["failed"] == 1
        assert bulk.json()["results"][0]["status"] == "has_children"
        sequence.refresh_from_db()
        assert sequence.is_deleted is False
        assert (
            sequence.status == "Not Started"
        )  # the refused archive did not leave "Archived" behind

    def test_it_works_once_the_children_are_archived_and_restores_with_them(self, show, tree):
        sequence, shot = tree
        client = _client(show)

        assert client.post(f"/api/v1/shots/{shot.id}/archive/").status_code == 200
        assert client.post(f"/api/v1/sequences/{sequence.id}/archive/").status_code == 200
        assert Sequence.all_objects.get(pk=sequence.pk).is_deleted

        assert client.post(f"/api/v1/sequences/{sequence.id}/restore/").status_code == 200
        assert Shot.all_objects.get(pk=shot.pk).is_deleted  # only what was archived comes back

    def test_an_episode_with_live_sequences_or_shots_is_refused(self, show, ep1, tree):
        client = _client(show)

        resp = client.post(f"/api/v1/episodes/{ep1.id}/archive/")

        assert resp.status_code == 400
        assert "1 sequence and 1 shot" in str(resp.json())
        assert Episode.objects.filter(pk=ep1.pk).exists()

    def test_bulk_archive_carries_on_past_a_refused_item(self, show, tree):
        sequence, shot = tree
        empty = SequenceFactory.create(project=show, code="SQ2", episode=sequence.episode)
        client = _client(show)

        resp = client.post(
            "/api/v1/sequences/bulk-archive/",
            {"ids": [str(sequence.id), str(empty.id)]},
            format="json",
        ).json()

        assert [r["status"] for r in resp["results"]] == ["has_children", "archived"]
        assert resp["partial_success"] is True
        assert Sequence.all_objects.get(pk=empty.pk).is_deleted
        assert not Sequence.all_objects.get(pk=sequence.pk).is_deleted
        assert shot.pk

    def test_archived_children_do_not_count(self, show, ep1):
        sequence = SequenceFactory.create(project=show, code="SQ1", episode=ep1)
        ShotFactory.create(project=show, code="S1", sequence=sequence, episode=ep1, is_deleted=True)
        client = _client(show)

        assert client.post(f"/api/v1/sequences/{sequence.id}/archive/").status_code == 200
