"""
Shot chain-integrity API tests (Task A-4).

Contract under test (mirrors the frontend mock's episodic-hierarchy rules):
  * episodic projects REQUIRE an episode on shot create/update;
  * ``episode_id`` must resolve inside the target project;
  * ``sequence_id`` (when supplied) must resolve to a sequence of the target
    project and normalizes the stored ``sequence_code``;
  * standard (non-episodic) projects keep the legacy free-form behavior;
  * ``episode_id`` + ``sequence_code`` list filters keep working (frontend
    contract: UUID/code/mock-id tolerant, unresolvable -> empty, never 400).

Error contract mirrors the existing DRF shape: a 400 with a field mapping
(``episode_id: [...]`` / ``sequence_id: [...]``), never a new error format.
"""
import uuid

import pytest
from django.urls import reverse
from rest_framework import status

from apps.production.models import ProjectMembership, Shot
from apps.production.tests.factories import (
    EpisodeFactory,
    ProjectFactory,
    SequenceFactory,
    ShotFactory,
)

pytestmark = pytest.mark.django_db


def _list_url():
    return reverse("api:v1:production:shot-list")


def _detail_url(shot):
    return reverse("api:v1:production:shot-detail", args=[shot.id])


def _episodic_project(code="EPSHOW"):
    return ProjectFactory.create(
        code=code,
        workflow_type="episodic",
    )


def _member(user, project):
    return ProjectMembership.objects.create(
        user=user, project=project, status="active", role="Artist"
    )


def _setup_episodic(staff_user, *, project_code="EPSHOW", episode_code="EP101"):
    project = _episodic_project(code=project_code)
    _member(staff_user, project)
    episode = EpisodeFactory.create(project=project, code=episode_code)
    return project, episode


class TestShotEpisodeChainCreate:
    def test_episodic_project_requires_episode(self, staff_client, staff_user):
        """Spec line: shot without episode on episodic project must 400."""
        project, _episode = _setup_episodic(staff_user)
        payload = {
            "project_id": str(project.id),
            "code": "EPSHOW_SH001",
            "name": "No Episode",
        }
        response = staff_client.post(
            _list_url(),
            payload,
            format="json",
        )
        assert response.status_code == 400
        assert "episode_id" in response.json()
        assert not Shot.objects.filter(code="EPSHOW_SH001").exists()

    def test_episodic_project_rejects_blank_episode(self, staff_client, staff_user):
        project, _episode = _setup_episodic(staff_user)
        response = staff_client.post(
            _list_url(),
            {
                "project_id": str(project.id),
                "episode_id": "",
                "code": "EPSHOW_SH002",
            },
            format="json",
        )
        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert "episode_id" in response.json()

    def test_episode_from_other_project_rejected(self, staff_client, staff_user):
        project, _episode = _setup_episodic(staff_user)
        other_project = _episodic_project(code="OTHER1")
        foreign_episode = EpisodeFactory.create(
            project=other_project, code="EP201"
        )
        response = staff_client.post(
            _list_url(),
            {
                "project_id": str(project.id),
                "episode_id": str(foreign_episode.id),
                "code": "EPSHOW_SH003",
            },
            format="json",
        )
        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert "episode_id" in response.json()
        assert not Shot.objects.filter(code="EPSHOW_SH003").exists()

    def test_unknown_episode_rejected(self, staff_client, staff_user):
        project, _episode = _setup_episodic(staff_user)
        response = staff_client.post(
            _list_url(),
            {
                "project_id": str(project.id),
                "episode_id": str(uuid.uuid4()),
                "code": "EPSHOW_SH004",
            },
            format="json",
        )
        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert "episode_id" in response.json()

    def test_episodic_create_with_episode_succeeds(self, staff_client, staff_user):
        project, episode = _setup_episodic(staff_user)
        sequence = SequenceFactory.create(project=project, episode=episode, code="EPSHOW_SQ010")
        response = staff_client.post(
            _list_url(),
            {
                "project_id": str(project.id),
                "episode_id": str(episode.id),
                "sequence_id": str(sequence.id),
                "code": "EPSHOW_SH005",
                "name": "Hooked Up",
            },
            format="json",
        )
        assert response.status_code == status.HTTP_201_CREATED, response.data
        shot = Shot.objects.get(code="EPSHOW_SH005", project=project)
        assert shot.episode_id == episode.id
        # Read serializers expose episode_id (write alias is write-only).
        detail = staff_client.get(_detail_url(shot))
        assert detail.data["episode_id"] == str(episode.id)

    def test_episode_code_reference_resolves(self, staff_client, staff_user):
        project, episode = _setup_episodic(staff_user)
        SequenceFactory.create(project=project, episode=episode, code="EPSHOW_SQ020")
        response = staff_client.post(
            _list_url(),
            {
                "project_id": project.code,
                "episode_id": episode.code.lower(),
                "sequence_id": "epshow_sq020",
                "code": "EPSHOW_SH006",
            },
            format="json",
        )
        assert response.status_code == status.HTTP_201_CREATED, response.data
        assert Shot.objects.get(code="EPSHOW_SH006", project=project).episode_id == episode.id

    def test_unknown_sequence_id_rejected(self, staff_client, staff_user):
        project, episode = _setup_episodic(staff_user)
        response = staff_client.post(
            _list_url(),
            {
                "project_id": str(project.id),
                "episode_id": str(episode.id),
                "sequence_id": str(uuid.uuid4()),
                "code": "EPSHOW_SH007",
            },
            format="json",
        )
        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert "sequence_id" in response.json()
        assert not Shot.objects.filter(code="EPSHOW_SH007").exists()

    def test_sequence_from_other_project_rejected(self, staff_client, staff_user):
        project, episode = _setup_episodic(staff_user)
        other_project = _episodic_project(code="OTHER2")
        foreign_sequence = SequenceFactory.create(
            project=other_project, code="SQ201"
        )
        response = staff_client.post(
            _list_url(),
            {
                "project_id": str(project.id),
                "episode_id": str(episode.id),
                "sequence_id": str(foreign_sequence.id),
                "code": "EPSHOW_SH008",
            },
            format="json",
        )
        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert "sequence_id" in response.json()

    def test_sequence_id_resolves_and_normalizes_code(self, staff_client, staff_user):
        project, episode = _setup_episodic(staff_user)
        sequence = SequenceFactory.create(
            project=project, code="SQ010"
        )
        response = staff_client.post(
            _list_url(),
            {
                "project_id": str(project.id),
                "episode_id": str(episode.id),
                "sequence_id": str(sequence.id),
                "code": "EPSHOW_SH009",
            },
            format="json",
        )
        assert response.status_code == status.HTTP_201_CREATED, response.data
        shot = Shot.objects.get(code="EPSHOW_SH009", project=project)
        assert shot.sequence_code == "SQ010"
        assert response.data["sequence_code"] == "SQ010"

    def test_standard_project_without_episode_still_works(self, staff_client, staff_user):
        """Regression: non-episodic projects keep legacy chain-free behavior."""
        project = ProjectFactory.create(
            code="STD01", workflow_type="standard"
        )
        _member(staff_user, project)
        sequence = SequenceFactory.create(project=project, code="STD01_SQ010")
        response = staff_client.post(
            _list_url(),
            {
                "project_id": str(project.id),
                "sequence_id": str(sequence.id),
                "code": "STD01_SH010",
                "name": "Legacy Free Form",
            },
            format="json",
        )
        assert response.status_code == status.HTTP_201_CREATED, response.data
        shot = Shot.objects.get(code="STD01_SH010", project=project)
        assert shot.episode_id is None
        assert shot.sequence_id == sequence.id and shot.sequence_code == "STD01_SQ010"

    def test_a_new_shot_needs_a_sequence(self, staff_client, staff_user):
        """CR-49: a new shot belongs to a sequence of its project, on a standard project too."""
        project = ProjectFactory.create(code="STD02", workflow_type="standard")
        _member(staff_user, project)
        for body in ({}, {"sequence_id": ""}, {"sequence_id": "  "}):
            response = staff_client.post(
                _list_url(),
                {"project_id": str(project.id), "code": "STD02_SH010", **body},
                format="json",
            )
            assert response.status_code == status.HTTP_400_BAD_REQUEST, body
            assert response.json()["sequence_id"] == ["A shot needs a sequence."], body
        assert not Shot.objects.filter(project=project).exists()

    def test_the_missing_sequence_is_reported_with_the_missing_episode(self, staff_client, staff_user):
        project, _episode = _setup_episodic(staff_user)
        response = staff_client.post(
            _list_url(),
            {"project_id": str(project.id), "code": "EPSHOW_SH011"},
            format="json",
        )
        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert {"episode_id", "sequence_id"} <= set(response.json())

    def test_a_sequence_that_does_not_exist_is_a_400_on_sequence_id_only(self, staff_client, staff_user):
        project = ProjectFactory.create(code="STD03", workflow_type="standard")
        _member(staff_user, project)
        response = staff_client.post(
            _list_url(),
            {"project_id": str(project.id), "code": "STD03_SH010", "sequence_id": "NOPE"},
            format="json",
        )
        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert response.json()["sequence_id"] == ["Unknown sequence for the selected project."]

    def test_a_shot_that_has_no_sequence_can_still_be_edited(self, staff_client, staff_user):
        project = ProjectFactory.create(code="STD04", workflow_type="standard")
        _member(staff_user, project)
        shot = ShotFactory.create(project=project, code="LEGACY1", sequence=None)
        response = staff_client.patch(_detail_url(shot), {"name": "Renamed"}, format="json")
        assert response.status_code == status.HTTP_200_OK, response.data


class TestShotEpisodeChainUpdate:
    def test_move_to_episode_of_other_project_rejected(self, staff_client, staff_user):
        project, episode = _setup_episodic(staff_user)
        shot = ShotFactory.create(
            project=project, episode=episode, code="SHU01"
        )
        other_project = _episodic_project(code="OTHER3")
        foreign_episode = EpisodeFactory.create(
            project=other_project, code="EP301"
        )
        response = staff_client.patch(
            _detail_url(shot),
            {"episode_id": str(foreign_episode.id)},
            format="json",
        )
        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert "episode_id" in response.json()
        shot.refresh_from_db()
        assert shot.episode_id == episode.id

    def test_clearing_episode_on_episodic_shot_rejected(self, staff_client, staff_user):
        project, episode = _setup_episodic(staff_user)
        shot = ShotFactory.create(
            project=project, episode=episode, code="SHU02"
        )
        response = staff_client.patch(
            _detail_url(shot),
            {"episode_id": ""},
            format="json",
        )
        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert "episode_id" in response.json()
        shot.refresh_from_db()
        assert shot.episode_id == episode.id

    def test_update_with_valid_episode_and_sequence_succeeds(
        self, staff_client, staff_user
    ):
        project, episode_a = _setup_episodic(staff_user, episode_code="EP101")
        episode_b = EpisodeFactory.create(
            project=project, code="EP102", season_number=1
        )
        sequence = SequenceFactory.create(
            project=project, code="SQ020"
        )
        shot = ShotFactory.create(
            project=project, episode=episode_a, code="SHU03"
        )
        response = staff_client.patch(
            _detail_url(shot),
            {"episode_id": str(episode_b.id), "sequence_id": str(sequence.id)},
            format="json",
        )
        assert response.status_code == status.HTTP_200_OK, response.data
        shot.refresh_from_db()
        assert shot.episode_id == episode_b.id
        assert shot.sequence_code == "SQ020"

    def test_update_without_episode_change_keeps_existing(self, staff_client, staff_user):
        project, episode = _setup_episodic(staff_user)
        shot = ShotFactory.create(
            project=project, episode=episode, code="SHU04"
        )
        response = staff_client.patch(
            _detail_url(shot),
            {"name": "Renamed"},
            format="json",
        )
        assert response.status_code == status.HTTP_200_OK, response.data
        shot.refresh_from_db()
        assert shot.episode_id == episode.id

    def test_unknown_sequence_id_on_update_rejected(self, staff_client, staff_user):
        project, episode = _setup_episodic(staff_user)
        shot = ShotFactory.create(
            project=project, episode=episode, code="SHU05"
        )
        response = staff_client.patch(
            _detail_url(shot),
            {"sequence_id": "seq-does-not-exist"},
            format="json",
        )
        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert "sequence_id" in response.json()


class TestShotEpisodeFilters:
    def test_episode_id_filter_scopes_list(self, staff_client, staff_user):
        project, episode_a = _setup_episodic(staff_user, episode_code="EP101")
        episode_b = EpisodeFactory.create(
            project=project, code="EP102", season_number=1
        )
        ShotFactory.create(
            project=project, episode=episode_a, code="SHF01"
        )
        ShotFactory.create(
            project=project, episode=episode_b, code="SHF02"
        )
        response = staff_client.get(
            _list_url(),
            {"episode_id": str(episode_a.id)},
        )
        assert response.status_code == status.HTTP_200_OK
        codes = {row["code"] for row in response.data["results"]}
        assert codes == {"SHF01"}

    def test_episode_id_filter_accepts_code(self, staff_client, staff_user):
        project, episode = _setup_episodic(staff_user, episode_code="EP101")
        ShotFactory.create(
            project=project, episode=episode, code="SHF03"
        )
        response = staff_client.get(
            _list_url(),
            {"episode_id": "EP101"},
        )
        assert response.status_code == status.HTTP_200_OK
        codes = {row["code"] for row in response.data["results"]}
        assert "SHF03" in codes

    def test_episode_id_filter_unresolvable_returns_empty(
        self, staff_client, staff_user
    ):
        project, episode = _setup_episodic(staff_user)
        ShotFactory.create(
            project=project, episode=episode, code="SHF04"
        )
        response = staff_client.get(
            _list_url(),
            {"episode_id": "ep-nope-999"},
        )
        assert response.status_code == status.HTTP_200_OK
        assert response.data["results"] == []

    def test_sequence_code_filter_still_works(self, staff_client, staff_user):
        project = ProjectFactory.create(code="FLT01")
        _member(staff_user, project)
        ShotFactory.create(
            project=project, code="SHF05", sequence_code="SQ_A"
        )
        ShotFactory.create(
            project=project, code="SHF06", sequence_code="SQ_B"
        )
        response = staff_client.get(
            _list_url(),
            {"sequence_code": "sq_a"},
        )
        assert response.status_code == status.HTTP_200_OK
        codes = {row["code"] for row in response.data["results"]}
        assert codes == {"SHF05"}
