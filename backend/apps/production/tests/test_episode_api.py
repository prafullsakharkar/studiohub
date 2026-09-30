"""
Episode API + selector tests.

Contract under test (mirrors the frontend mock-router surface):
  * create + project-scoped list at ``/api/v1/episodes/``;
  * strict organization scoping (fail closed);
  * ``EpisodeSelector`` filtered reads for project-mapped callers.

Auth note: the canonical RBAC model (ADR-0033) is fail closed, so API
tests run through ``staff_client`` with an active organization context
instead of an anonymous client.
"""
import pytest
from django.urls import reverse
from rest_framework import status

from apps.organization.tests.factories import OrganizationFactory
from apps.organization.tests.rbac_helpers import grant_org_admin
from apps.production.models import Episode
from apps.production.selectors.episode import EpisodeSelector
from apps.production.tests.factories import EpisodeFactory, ProjectFactory

pytestmark = pytest.mark.django_db


def _list_url():
    return reverse("api:v1:production:episode-list")


def _project_list_url():
    return reverse("api:v1:production:project-list")


def _detail_url(ep):
    return reverse("api:v1:production:episode-detail", args=[ep.id])


class TestEpisodeCreateAndScopedList:
    def test_episode_create_and_scoped_list(self, staff_client, staff_user):
        org = OrganizationFactory.create()
        grant_org_admin(staff_user, org)
        project = ProjectFactory.create(
            organization=org,
            name="MyShow",
            code="MS1",
            workflow_type="episodic",
        )

        r = staff_client.post(
            _list_url(),
            {
                "project": str(project.id),
                "name": "Pilot",
                "season_number": 1,
                "episode_number": 1,
            },
            format="json",
            HTTP_X_ORGANIZATION_ID=str(org.id),
        )
        assert r.status_code == status.HTTP_201_CREATED, r.data
        assert r.data["name"] == "Pilot"
        assert r.data["code"] == "EP101"

        list_r = staff_client.get(
            f"{_list_url()}?project_id={project.id}",
            HTTP_X_ORGANIZATION_ID=str(org.id),
        )
        assert list_r.status_code == status.HTTP_200_OK
        assert any(e["name"] == "Pilot" for e in list_r.data["results"])

    def test_create_without_code_and_numbers_returns_400(self, staff_client, staff_user):
        org = OrganizationFactory.create()
        grant_org_admin(staff_user, org)
        project = ProjectFactory.create(organization=org, workflow_type="episodic")

        r = staff_client.post(
            _list_url(),
            {"project": str(project.id), "name": "No Code"},
            format="json",
            HTTP_X_ORGANIZATION_ID=str(org.id),
        )
        assert r.status_code == status.HTTP_400_BAD_REQUEST
        assert "code" in r.data
        assert not Episode.objects.filter(project=project).exists()

    def test_create_derives_season_number_with_code(self, staff_client, staff_user):
        org = OrganizationFactory.create()
        grant_org_admin(staff_user, org)
        project = ProjectFactory.create(organization=org, workflow_type="episodic")

        r = staff_client.post(
            _list_url(),
            {"project": str(project.id), "name": "Derived", "episode_number": 3},
            format="json",
            HTTP_X_ORGANIZATION_ID=str(org.id),
        )
        assert r.status_code == status.HTTP_201_CREATED, r.data
        assert r.data["code"] == "EP103"
        assert r.data["season_number"] == 1

    def test_list_filter_by_project_id_excludes_other_projects(
        self, staff_client, staff_user
    ):
        org = OrganizationFactory.create()
        grant_org_admin(staff_user, org)
        project_a = ProjectFactory.create(organization=org)
        project_b = ProjectFactory.create(organization=org)
        EpisodeFactory.create(organization=org, project=project_a, code="EP101")
        EpisodeFactory.create(organization=org, project=project_b, code="EP101")

        resp = staff_client.get(
            f"{_list_url()}?project_id={project_a.id}",
            HTTP_X_ORGANIZATION_ID=str(org.id),
        )
        assert resp.status_code == status.HTTP_200_OK
        project_ids = {e["project_id"] for e in resp.data["results"]}
        assert project_ids == {str(project_a.id)}

    def test_list_is_scoped_to_organization(self, staff_client, staff_user):
        org_a = OrganizationFactory.create()
        org_b = OrganizationFactory.create()
        grant_org_admin(staff_user, org_a)
        EpisodeFactory.create(organization=org_a, code="EPA01")
        EpisodeFactory.create(organization=org_b, code="EPB01")

        resp = staff_client.get(_list_url(), HTTP_X_ORGANIZATION_ID=str(org_a.id))
        assert resp.status_code == status.HTTP_200_OK
        codes = {e["code"] for e in resp.data["results"]}
        assert "EPA01" in codes
        assert "EPB01" not in codes

    def test_detail_is_scoped_to_organization(self, staff_client):
        org_a = OrganizationFactory.create()
        org_b = OrganizationFactory.create()
        ep = EpisodeFactory.create(organization=org_a, code="EPD01")
        resp = staff_client.get(
            _detail_url(ep),
            HTTP_X_ORGANIZATION_ID=str(org_b.id),
        )
        assert resp.status_code == status.HTTP_404_NOT_FOUND

    def test_partial_update(self, staff_client, staff_user):
        org = OrganizationFactory.create()
        grant_org_admin(staff_user, org)
        ep = EpisodeFactory.create(organization=org, code="EPU01", name="Old")
        resp = staff_client.patch(
            _detail_url(ep),
            {"name": "New"},
            format="json",
            HTTP_X_ORGANIZATION_ID=str(org.id),
        )
        assert resp.status_code == status.HTTP_200_OK, resp.data
        ep.refresh_from_db()
        assert ep.name == "New"

    def test_destroy_soft_deletes(self, staff_client, staff_user):
        org = OrganizationFactory.create()
        grant_org_admin(staff_user, org)
        ep = EpisodeFactory.create(organization=org, code="EPX01")
        resp = staff_client.delete(
            _detail_url(ep),
            HTTP_X_ORGANIZATION_ID=str(org.id),
        )
        assert resp.status_code == status.HTTP_204_NO_CONTENT
        ep.refresh_from_db()
        assert ep.is_deleted is True


class TestEpisodeSelector:
    def test_selector_filter_by_project(self, staff_user):
        org = OrganizationFactory.create()
        project_a = ProjectFactory.create(organization=org)
        project_b = ProjectFactory.create(organization=org)
        EpisodeFactory.create(organization=org, project=project_a, code="EP201")
        EpisodeFactory.create(organization=org, project=project_b, code="EP201")

        qs = EpisodeSelector.filter(project_id=project_a.id)
        assert qs.count() == 1
        assert qs.first().project_id == project_a.id


class TestProjectWorkflowTypeGating:
    """Project ``workflow_type`` gates episode flows.

    Frontend contract: project payload carries ``workflow_type``; creating an
    ``episodic`` project bootstraps an initial Episode (visible in the
    project-scoped listing), while a ``standard`` project rejects episode
    creation with 400.
    """

    @pytest.mark.parametrize(
        "workflow_type,bootstrap_episode",
        [
            ("episodic", True),
            ("standard", False),
        ],
    )
    def test_project_create_carries_workflow_type(
        self, staff_client, staff_user, workflow_type, bootstrap_episode
    ):
        org = OrganizationFactory.create()
        grant_org_admin(staff_user, org)

        r = staff_client.post(
            _project_list_url(),
            {
                "code": f"WF{workflow_type[:3].upper()}",
                "name": "MyShow" if workflow_type == "episodic" else "Another",
                "workflow_type": workflow_type,
            },
            format="json",
            HTTP_X_ORGANIZATION_ID=str(org.id),
        )
        assert r.status_code == status.HTTP_201_CREATED, r.data
        assert r.data["workflow_type"] == workflow_type

        episodes = Episode.objects.filter(project_id=r.data["id"])
        if bootstrap_episode:
            assert episodes.count() == 1
            episode = episodes.first()
            assert episode.code == "EP101"
            assert episode.season_number == 1
            assert episode.episode_number == 1
            assert episode.organization_id == org.id
        else:
            assert not episodes.exists()

        # Scoped list reflects the bootstrap for episodic projects.
        list_r = staff_client.get(
            f"{_list_url()}?project_id={r.data['id']}",
            HTTP_X_ORGANIZATION_ID=str(org.id),
        )
        assert list_r.status_code == status.HTTP_200_OK
        listed = [e["code"] for e in list_r.data["results"]]
        assert ("EP101" in listed) is bootstrap_episode

    def test_episode_create_rejected_on_standard_project(
        self, staff_client, staff_user
    ):
        org = OrganizationFactory.create()
        grant_org_admin(staff_user, org)
        project = ProjectFactory.create(organization=org, workflow_type="standard")

        r = staff_client.post(
            _list_url(),
            {
                "project": str(project.id),
                "name": "Pilot",
                "season_number": 1,
                "episode_number": 1,
            },
            format="json",
            HTTP_X_ORGANIZATION_ID=str(org.id),
        )
        assert r.status_code == status.HTTP_400_BAD_REQUEST
        assert not Episode.objects.filter(project=project).exists()

    def test_episode_create_allowed_on_episodic_project(
        self, staff_client, staff_user
    ):
        org = OrganizationFactory.create()
        grant_org_admin(staff_user, org)
        project = ProjectFactory.create(organization=org, workflow_type="episodic")

        r = staff_client.post(
            _list_url(),
            {
                "project": str(project.id),
                "name": "Second",
                "season_number": 1,
                "episode_number": 2,
            },
            format="json",
            HTTP_X_ORGANIZATION_ID=str(org.id),
        )
        assert r.status_code == status.HTTP_201_CREATED, r.data
        assert r.data["code"] == "EP102"
