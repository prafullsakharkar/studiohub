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

from apps.organization.tests.factories import OrganizationFactory
from apps.organization.tests.rbac_helpers import grant_org_admin
from apps.production.models import Shot
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


def _episodic_project(org, code="EPSHOW"):
    return ProjectFactory.create(
        organization=org,
        code=code,
        workflow_type="episodic",
    )


def _setup_episodic(staff_user, *, project_code="EPSHOW", episode_code="EP101"):
    org = OrganizationFactory.create()
    grant_org_admin(staff_user, org)
    project = _episodic_project(org, code=project_code)
    episode = EpisodeFactory.create(
        organization=org, project=project, code=episode_code
    )
    return org, project, episode


class TestShotEpisodeChainCreate:
    def test_episodic_project_requires_episode(self, staff_client, staff_user):
        """Spec line: shot without episode on episodic project must 400."""
        org, project, _episode = _setup_episodic(staff_user)
        payload = {
            "project_id": str(project.id),
            "code": "SH001",
            "name": "No Episode",
        }
        response = staff_client.post(
            _list_url(),
            payload,
            format="json",
            HTTP_X_ORGANIZATION_ID=str(org.id),
        )
        assert response.status_code == 400
        assert "episode_id" in response.json()
        assert not Shot.objects.filter(code="SH001").exists()

    def test_episodic_project_rejects_blank_episode(self, staff_client, staff_user):
        org, project, _episode = _setup_episodic(staff_user)
        response = staff_client.post(
            _list_url(),
            {
                "project_id": str(project.id),
                "episode_id": "",
                "code": "SH002",
            },
            format="json",
            HTTP_X_ORGANIZATION_ID=str(org.id),
        )
        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert "episode_id" in response.json()

    def test_episode_from_other_project_rejected(self, staff_client, staff_user):
        org, project, _episode = _setup_episodic(staff_user)
        other_project = _episodic_project(org, code="OTHER1")
        foreign_episode = EpisodeFactory.create(
            organization=org, project=other_project, code="EP201"
        )
        response = staff_client.post(
            _list_url(),
            {
                "project_id": str(project.id),
                "episode_id": str(foreign_episode.id),
                "code": "SH003",
            },
            format="json",
            HTTP_X_ORGANIZATION_ID=str(org.id),
        )
        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert "episode_id" in response.json()
        assert not Shot.objects.filter(code="SH003").exists()

    def test_unknown_episode_rejected(self, staff_client, staff_user):
        org, project, _episode = _setup_episodic(staff_user)
        response = staff_client.post(
            _list_url(),
            {
                "project_id": str(project.id),
                "episode_id": str(uuid.uuid4()),
                "code": "SH004",
            },
            format="json",
            HTTP_X_ORGANIZATION_ID=str(org.id),
        )
        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert "episode_id" in response.json()

    def test_episodic_create_with_episode_succeeds(self, staff_client, staff_user):
        org, project, episode = _setup_episodic(staff_user)
        response = staff_client.post(
            _list_url(),
            {
                "project_id": str(project.id),
                "episode_id": str(episode.id),
                "code": "SH005",
                "name": "Hooked Up",
            },
            format="json",
            HTTP_X_ORGANIZATION_ID=str(org.id),
        )
        assert response.status_code == status.HTTP_201_CREATED, response.data
        shot = Shot.objects.get(code="SH005", project=project)
        assert shot.episode_id == episode.id
        # Read serializers expose episode_id (write alias is write-only).
        detail = staff_client.get(
            _detail_url(shot), HTTP_X_ORGANIZATION_ID=str(org.id)
        )
        assert detail.data["episode_id"] == str(episode.id)

    def test_episode_code_reference_resolves(self, staff_client, staff_user):
        org, project, episode = _setup_episodic(staff_user)
        response = staff_client.post(
            _list_url(),
            {
                "project_id": project.code,
                "episode_id": episode.code.lower(),
                "code": "SH006",
            },
            format="json",
            HTTP_X_ORGANIZATION_ID=str(org.id),
        )
        assert response.status_code == status.HTTP_201_CREATED, response.data
        assert Shot.objects.get(code="SH006", project=project).episode_id == episode.id

    def test_unknown_sequence_id_rejected(self, staff_client, staff_user):
        org, project, episode = _setup_episodic(staff_user)
        response = staff_client.post(
            _list_url(),
            {
                "project_id": str(project.id),
                "episode_id": str(episode.id),
                "sequence_id": str(uuid.uuid4()),
                "code": "SH007",
            },
            format="json",
            HTTP_X_ORGANIZATION_ID=str(org.id),
        )
        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert "sequence_id" in response.json()
        assert not Shot.objects.filter(code="SH007").exists()

    def test_sequence_from_other_project_rejected(self, staff_client, staff_user):
        org, project, episode = _setup_episodic(staff_user)
        other_project = _episodic_project(org, code="OTHER2")
        foreign_sequence = SequenceFactory.create(
            organization=org, project=other_project, code="SQ201"
        )
        response = staff_client.post(
            _list_url(),
            {
                "project_id": str(project.id),
                "episode_id": str(episode.id),
                "sequence_id": str(foreign_sequence.id),
                "code": "SH008",
            },
            format="json",
            HTTP_X_ORGANIZATION_ID=str(org.id),
        )
        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert "sequence_id" in response.json()

    def test_sequence_id_resolves_and_normalizes_code(self, staff_client, staff_user):
        org, project, episode = _setup_episodic(staff_user)
        sequence = SequenceFactory.create(
            organization=org, project=project, code="SQ010"
        )
        response = staff_client.post(
            _list_url(),
            {
                "project_id": str(project.id),
                "episode_id": str(episode.id),
                "sequence_id": str(sequence.id),
                "code": "SH009",
            },
            format="json",
            HTTP_X_ORGANIZATION_ID=str(org.id),
        )
        assert response.status_code == status.HTTP_201_CREATED, response.data
        shot = Shot.objects.get(code="SH009", project=project)
        assert shot.sequence_code == "SQ010"
        assert response.data["sequence_code"] == "SQ010"

    def test_standard_project_without_episode_still_works(self, staff_client, staff_user):
        """Regression: non-episodic projects keep legacy chain-free behavior."""
        org = OrganizationFactory.create()
        grant_org_admin(staff_user, org)
        project = ProjectFactory.create(
            organization=org, code="STD01", workflow_type="standard"
        )
        response = staff_client.post(
            _list_url(),
            {
                "project_id": str(project.id),
                "sequence_code": "SQ_FREE",
                "code": "SH010",
                "name": "Legacy Free Form",
            },
            format="json",
            HTTP_X_ORGANIZATION_ID=str(org.id),
        )
        assert response.status_code == status.HTTP_201_CREATED, response.data
        shot = Shot.objects.get(code="SH010", project=project)
        assert shot.episode_id is None
        assert shot.sequence_code == "SQ_FREE"


class TestShotEpisodeChainUpdate:
    def test_move_to_episode_of_other_project_rejected(self, staff_client, staff_user):
        org, project, episode = _setup_episodic(staff_user)
        shot = ShotFactory.create(
            organization=org, project=project, episode=episode, code="SHU01"
        )
        other_project = _episodic_project(org, code="OTHER3")
        foreign_episode = EpisodeFactory.create(
            organization=org, project=other_project, code="EP301"
        )
        response = staff_client.patch(
            _detail_url(shot),
            {"episode_id": str(foreign_episode.id)},
            format="json",
            HTTP_X_ORGANIZATION_ID=str(org.id),
        )
        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert "episode_id" in response.json()
        shot.refresh_from_db()
        assert shot.episode_id == episode.id

    def test_clearing_episode_on_episodic_shot_rejected(self, staff_client, staff_user):
        org, project, episode = _setup_episodic(staff_user)
        shot = ShotFactory.create(
            organization=org, project=project, episode=episode, code="SHU02"
        )
        response = staff_client.patch(
            _detail_url(shot),
            {"episode_id": ""},
            format="json",
            HTTP_X_ORGANIZATION_ID=str(org.id),
        )
        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert "episode_id" in response.json()
        shot.refresh_from_db()
        assert shot.episode_id == episode.id

    def test_update_with_valid_episode_and_sequence_succeeds(
        self, staff_client, staff_user
    ):
        org, project, episode_a = _setup_episodic(staff_user, episode_code="EP101")
        episode_b = EpisodeFactory.create(
            organization=org, project=project, code="EP102", season_number=1
        )
        sequence = SequenceFactory.create(
            organization=org, project=project, code="SQ020"
        )
        shot = ShotFactory.create(
            organization=org, project=project, episode=episode_a, code="SHU03"
        )
        response = staff_client.patch(
            _detail_url(shot),
            {"episode_id": str(episode_b.id), "sequence_id": str(sequence.id)},
            format="json",
            HTTP_X_ORGANIZATION_ID=str(org.id),
        )
        assert response.status_code == status.HTTP_200_OK, response.data
        shot.refresh_from_db()
        assert shot.episode_id == episode_b.id
        assert shot.sequence_code == "SQ020"

    def test_update_without_episode_change_keeps_existing(self, staff_client, staff_user):
        org, project, episode = _setup_episodic(staff_user)
        shot = ShotFactory.create(
            organization=org, project=project, episode=episode, code="SHU04"
        )
        response = staff_client.patch(
            _detail_url(shot),
            {"name": "Renamed"},
            format="json",
            HTTP_X_ORGANIZATION_ID=str(org.id),
        )
        assert response.status_code == status.HTTP_200_OK, response.data
        shot.refresh_from_db()
        assert shot.episode_id == episode.id

    def test_unknown_sequence_id_on_update_rejected(self, staff_client, staff_user):
        org, project, episode = _setup_episodic(staff_user)
        shot = ShotFactory.create(
            organization=org, project=project, episode=episode, code="SHU05"
        )
        response = staff_client.patch(
            _detail_url(shot),
            {"sequence_id": "seq-does-not-exist"},
            format="json",
            HTTP_X_ORGANIZATION_ID=str(org.id),
        )
        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert "sequence_id" in response.json()


class TestShotEpisodeFilters:
    def test_episode_id_filter_scopes_list(self, staff_client, staff_user):
        org, project, episode_a = _setup_episodic(staff_user, episode_code="EP101")
        episode_b = EpisodeFactory.create(
            organization=org, project=project, code="EP102", season_number=1
        )
        ShotFactory.create(
            organization=org, project=project, episode=episode_a, code="SHF01"
        )
        ShotFactory.create(
            organization=org, project=project, episode=episode_b, code="SHF02"
        )
        response = staff_client.get(
            _list_url(),
            {"episode_id": str(episode_a.id)},
            HTTP_X_ORGANIZATION_ID=str(org.id),
        )
        assert response.status_code == status.HTTP_200_OK
        codes = {row["code"] for row in response.data["results"]}
        assert codes == {"SHF01"}

    def test_episode_id_filter_accepts_code(self, staff_client, staff_user):
        org, project, episode = _setup_episodic(staff_user, episode_code="EP101")
        ShotFactory.create(
            organization=org, project=project, episode=episode, code="SHF03"
        )
        response = staff_client.get(
            _list_url(),
            {"episode_id": "EP101"},
            HTTP_X_ORGANIZATION_ID=str(org.id),
        )
        assert response.status_code == status.HTTP_200_OK
        codes = {row["code"] for row in response.data["results"]}
        assert "SHF03" in codes

    def test_episode_id_filter_unresolvable_returns_empty(
        self, staff_client, staff_user
    ):
        org, project, episode = _setup_episodic(staff_user)
        ShotFactory.create(
            organization=org, project=project, episode=episode, code="SHF04"
        )
        response = staff_client.get(
            _list_url(),
            {"episode_id": "ep-nope-999"},
            HTTP_X_ORGANIZATION_ID=str(org.id),
        )
        assert response.status_code == status.HTTP_200_OK
        assert response.data["results"] == []

    def test_sequence_code_filter_still_works(self, staff_client, staff_user):
        org = OrganizationFactory.create()
        grant_org_admin(staff_user, org)
        project = ProjectFactory.create(organization=org, code="FLT01")
        ShotFactory.create(
            organization=org, project=project, code="SHF05", sequence_code="SQ_A"
        )
        ShotFactory.create(
            organization=org, project=project, code="SHF06", sequence_code="SQ_B"
        )
        response = staff_client.get(
            _list_url(),
            {"sequence_code": "sq_a"},
            HTTP_X_ORGANIZATION_ID=str(org.id),
        )
        assert response.status_code == status.HTTP_200_OK
        codes = {row["code"] for row in response.data["results"]}
        assert codes == {"SHF05"}
