"""
CR-47: episodes exist only on episodic projects.

A standard project's episodes (left by seeds, the admin or older data) are outside every episode
route: list, detail, update, archive, restore and the bulk routes treat them as missing, and
creating one stays a 400. On a standard project a sequence or a shot cannot be given an episode, by
a single write or a bulk one; on an episodic project both need one. Nothing is deleted:
``report_production_data`` lists what is left.
"""

from __future__ import annotations

from io import StringIO

import pytest
from django.core.management import call_command
from rest_framework.test import APIClient

from apps.production.models import Episode, Sequence, Shot
from apps.production.tests.factories import (
    EpisodeFactory,
    ProjectFactory,
    SequenceFactory,
    ShotFactory,
)

pytestmark = pytest.mark.django_db

API = "/api/v1"


@pytest.fixture
def client(admin_user):
    api = APIClient()
    api.force_authenticate(user=admin_user)
    return api


@pytest.fixture
def standard():
    return ProjectFactory(code="C47S", workflow_type="standard")  # new codes start with it (CR-49)


@pytest.fixture
def episodic():
    return ProjectFactory(code="C47E", workflow_type="episodic")


@pytest.fixture
def stranded(standard):
    """An episode of a standard project, as older data or the admin can leave behind."""
    return EpisodeFactory(project=standard, code="EPOLD", name="Old")


class TestEpisodeRoutesOnAStandardProject:
    def test_the_list_leaves_its_episodes_out(self, client, standard, stranded, episodic):
        kept = EpisodeFactory(project=episodic, code="EPNEW")
        assert client.get(f"{API}/episodes/?project_id={standard.pk}").json()["count"] == 0
        codes = {row["code"] for row in client.get(f"{API}/episodes/").json()["results"]}
        assert kept.code in codes
        assert stranded.code not in codes

    def test_detail_is_404(self, client, stranded):
        assert client.get(f"{API}/episodes/{stranded.pk}/").status_code == 404

    def test_detail_by_code_is_404(self, client, stranded):
        assert client.get(f"{API}/episodes/{stranded.code}/").status_code == 404

    def test_update_is_404_and_changes_nothing(self, client, stranded):
        response = client.patch(f"{API}/episodes/{stranded.pk}/", {"name": "x"}, format="json")
        assert response.status_code == 404
        assert Episode.objects.get(pk=stranded.pk).name == "Old"

    def test_archive_and_restore_are_404(self, client, stranded):
        assert client.post(f"{API}/episodes/{stranded.pk}/archive/").status_code == 404
        stranded.delete()
        assert client.post(f"{API}/episodes/{stranded.pk}/restore/").status_code == 404
        assert Episode.all_objects.get(pk=stranded.pk).is_deleted

    def test_bulk_routes_report_not_found(self, client, stranded):
        updated = client.post(
            f"{API}/episodes/bulk-update/",
            {"items": [{"id": str(stranded.pk), "name": "x"}]},
            format="json",
        ).json()
        archived = client.post(
            f"{API}/episodes/bulk-archive/", {"ids": [str(stranded.pk)]}, format="json"
        ).json()
        assert updated["results"][0]["status"] == "not_found"
        assert archived["results"][0]["status"] == "not_found"
        assert Episode.objects.filter(pk=stranded.pk, name="Old").exists()

    def test_the_archived_list_leaves_them_out(self, client, standard, stranded):
        stranded.delete()
        body = client.get(f"{API}/episodes/archived/?project_id={standard.pk}").json()
        rows = body["results"] if isinstance(body, dict) else body
        assert rows == []

    def test_create_stays_a_400_on_project(self, client, standard):
        response = client.post(
            f"{API}/episodes/", {"project_id": str(standard.pk), "code": "C47S_EP900"}, format="json"
        )
        assert response.status_code == 400
        assert "project" in response.json()

    def test_bulk_create_is_refused_per_row(self, client, standard):
        body = client.post(
            f"{API}/episodes/bulk-create/",
            {"items": [{"project_id": str(standard.pk), "code": "C47S_EP901"}]},
            format="json",
        ).json()
        assert body["results"][0]["status"] == "invalid"
        assert not Episode.all_objects.filter(code="C47S_EP901").exists()


class TestEpisodeRoutesOnAnEpisodicProject:
    def test_detail_update_and_archive_work(self, client, episodic):
        episode = EpisodeFactory(project=episodic, code="EP200")
        assert client.get(f"{API}/episodes/{episode.pk}/").status_code == 200
        response = client.patch(f"{API}/episodes/{episode.pk}/", {"name": "New"}, format="json")
        assert response.status_code == 200
        assert client.post(f"{API}/episodes/{episode.pk}/archive/").status_code == 200

    def test_create_works(self, client, episodic):
        response = client.post(
            f"{API}/episodes/", {"project_id": str(episodic.pk), "code": "C47E_EP300"}, format="json"
        )
        assert response.status_code == 201, response.content


class TestShotEpisodeRule:
    def test_a_standard_shot_cannot_be_given_an_episode(self, client, standard, stranded):
        sequence = SequenceFactory(project=standard, code="SQ1")
        response = client.post(
            f"{API}/shots/",
            {
                "project_id": str(standard.pk),
                "code": "C47S_SH010",
                "sequence_id": str(sequence.pk),
                "episode_id": str(stranded.pk),
            },
            format="json",
        )
        assert response.status_code == 400
        assert "episode_id" in response.json()

    def test_a_standard_shot_with_an_empty_episode_is_fine(self, client, standard):
        sequence = SequenceFactory(project=standard, code="SQ1")
        response = client.post(
            f"{API}/shots/",
            {
                "project_id": str(standard.pk),
                "code": "C47S_SH011",
                "sequence_id": str(sequence.pk),
                "episode_id": "",
            },
            format="json",
        )
        assert response.status_code == 201, response.content

    def test_bulk_update_gives_a_standard_shot_no_episode(self, client, standard, stranded):
        shot = ShotFactory(project=standard)
        body = client.post(
            f"{API}/shots/bulk-update/",
            {"items": [{"id": str(shot.pk), "episode_id": str(stranded.pk)}]},
            format="json",
        ).json()
        assert body["results"][0]["status"] == "invalid"
        assert Shot.objects.get(pk=shot.pk).episode_id is None

    def test_an_episodic_shot_needs_an_episode_in_bulk_create(self, client, episodic):
        EpisodeFactory(project=episodic, code="EPA")
        # An older sequence with no episode of its own: the shot has to name one.
        sequence = SequenceFactory(project=episodic, code="SQN")
        in_it = {"project_id": str(episodic.pk), "sequence_id": str(sequence.pk)}
        body = client.post(
            f"{API}/shots/bulk-create/",
            {
                "items": [
                    {**in_it, "code": "C47E_SHX"},
                    {**in_it, "code": "C47E_SHY", "episode_id": "epa"},
                ]
            },
            format="json",
        ).json()
        assert [row["status"] for row in body["results"]] == ["invalid", "created"]
        assert Shot.objects.get(code="C47E_SHY").episode.code == "EPA"


class TestSequenceEpisodeRule:
    def test_bulk_create_on_a_standard_project_refuses_an_episode(self, client, standard, stranded):
        body = client.post(
            f"{API}/sequences/bulk-create/",
            {
                "items": [
                    {"project_id": str(standard.pk), "code": "C47S_SQ1", "episode_id": str(stranded.pk)}
                ]
            },
            format="json",
        ).json()
        assert body["results"][0]["status"] == "invalid"
        assert not Sequence.all_objects.filter(code="C47S_SQ1").exists()

    def test_bulk_create_on_an_episodic_project_needs_one(self, client, episodic):
        body = client.post(
            f"{API}/sequences/bulk-create/",
            {"items": [{"project_id": str(episodic.pk), "code": "C47E_SQ2"}]},
            format="json",
        ).json()
        assert body["results"][0]["status"] == "invalid"
        assert "episode_id" in body["results"][0]["error"]


class TestReport:
    def test_lists_what_a_standard_project_still_holds(self, standard, stranded):
        sequence = SequenceFactory(project=standard, code="SQOLD")
        Sequence.objects.filter(pk=sequence.pk).update(episode=stranded)
        out = StringIO()
        call_command("report_production_data", stdout=out)
        text = out.getvalue()
        assert "Episodes of standard projects (not served by the API): 1" in text
        assert "episode EPOLD" in text
        assert "Sequences and shots of standard projects with an episode: 1" in text
        assert "sequence SQOLD" in text
