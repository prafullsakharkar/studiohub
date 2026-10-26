"""
Episodes resolve inside a project (analysis finding F-H6, WP A5).

Every episodic project is bootstrapped with ``EP101``, so an episode code is
only meaningful together with a project. Writes resolve it inside the shot's
project; list filters never resolve it globally.
"""

from __future__ import annotations

import pytest
from django.urls import reverse

from apps.production.models import ProjectMembership, Shot
from apps.production.selectors.episode import EpisodeSelector
from apps.production.tests.factories import EpisodeFactory, ProjectFactory, ShotFactory

pytestmark = pytest.mark.django_db


def _episodic(code, user=None):
    project = ProjectFactory.create(code=code, workflow_type="episodic")
    if user is not None:
        ProjectMembership.objects.create(user=user, project=project, status="active", role="Artist")
    return project, EpisodeFactory.create(project=project, code="EP101")


def _body(resp):
    """Response body without the per-request ``error.request_id`` envelope."""
    return {key: value for key, value in resp.json().items() if key != "error"}


def _create(client, project, **extra):
    return client.post(
        reverse("api:v1:production:shot-list"),
        {"project_id": str(project.id), "code": "SH001", "name": "Shot", **extra},
        format="json",
    )


class TestResolveInProject:
    def test_same_code_resolves_to_each_projects_own_episode(self):
        project_a, episode_a = _episodic("EPRA")
        project_b, episode_b = _episodic("EPRB")

        assert EpisodeSelector.resolve_in_project(project_a, "EP101") == episode_a
        assert EpisodeSelector.resolve_in_project(project_b, "ep101") == episode_b
        assert EpisodeSelector.resolve_in_project(project_b, "ep-101") == episode_b

    def test_foreign_episode_does_not_resolve(self):
        project_a, _ = _episodic("EPRA")
        _, episode_b = _episodic("EPRB")

        assert EpisodeSelector.resolve_in_project(project_a, str(episode_b.id)) is None
        assert EpisodeSelector.resolve_in_project(project_a, episode_b) is None

    def test_soft_deleted_episode_does_not_resolve(self):
        project, episode = _episodic("EPRC")
        episode.delete()

        assert EpisodeSelector.resolve_in_project(project, "EP101") is None


class TestShotCreate:
    def test_code_resolves_in_the_shots_project_not_another_one(self, staff_client, staff_user):
        # Both projects hold EP101; the shot must land on its own project's episode,
        # whichever project's EP101 was created first.
        _episodic("EPSA", staff_user)
        project_b, episode_b = _episodic("EPSB", staff_user)

        resp = _create(staff_client, project_b, episode_id="EP101")

        assert resp.status_code == 201, resp.data
        assert Shot.objects.get(project=project_b, code="SH001").episode_id == episode_b.id

    def test_foreign_episode_id_is_rejected_like_an_unknown_one(self, staff_client, staff_user):
        project_a, _ = _episodic("EPSA", staff_user)
        _, episode_b = _episodic("EPSB", staff_user)

        foreign = _create(staff_client, project_a, episode_id=str(episode_b.id))
        unknown = _create(staff_client, project_a, episode_id="EP999")

        assert foreign.status_code == unknown.status_code == 400
        assert _body(foreign) == _body(unknown)
        assert not Shot.objects.filter(code="SH001").exists()


class TestShotEpisodeFilter:
    def _seed(self, staff_user):
        project_a, episode_a = _episodic("EPFA", staff_user)
        project_b, episode_b = _episodic("EPFB", staff_user)
        project_c, episode_c = _episodic("EPFC")  # staff_user is not a member
        shots = {
            "a": ShotFactory.create(project=project_a, code="SHA", episode=episode_a),
            "b": ShotFactory.create(project=project_b, code="SHB", episode=episode_b),
            "c": ShotFactory.create(project=project_c, code="SHC", episode=episode_c),
        }
        return shots, (episode_a, episode_b)

    def _codes(self, client, **params):
        resp = client.get(reverse("api:v1:production:shot-list"), params)
        assert resp.status_code == 200, resp.data
        return {row["code"] for row in resp.data["results"]}

    def test_code_matches_every_visible_project_and_never_foreign_ones(
        self, staff_client, staff_user
    ):
        self._seed(staff_user)

        assert self._codes(staff_client, episode_id="EP101") == {"SHA", "SHB"}

    def test_project_filter_narrows_the_episode_code(self, staff_client, staff_user):
        shots, _ = self._seed(staff_user)

        found = self._codes(staff_client, episode_id="EP101", project_id=str(shots["b"].project_id))

        assert found == {"SHB"}

    def test_uuid_matches_only_that_episode(self, staff_client, staff_user):
        _, (episode_a, _) = self._seed(staff_user)

        assert self._codes(staff_client, episode_id=str(episode_a.id)) == {"SHA"}

    def test_unknown_value_returns_nothing(self, staff_client, staff_user):
        self._seed(staff_user)

        assert self._codes(staff_client, episode_id="EP999") == set()
