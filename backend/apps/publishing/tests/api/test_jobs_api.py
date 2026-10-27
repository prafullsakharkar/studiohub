"""Export job and destination endpoints after Phase 3 (API-PUB-02, API-PUB-13)."""

from __future__ import annotations

import pytest

from apps.production.tests.factories import ShotFactory
from apps.publishing.models import PublishDestination, PublishItem
from apps.publishing.tests.helpers import published_version

pytestmark = pytest.mark.django_db

URL = "/api/v1/publishing/"
BODY = {
    "name": "Rig export",
    "entity_type": "Shot",
    "entity_id": "x",
    "entity_code": "SH010",
    "entity_name": "Opening",
    "dcc_tool": "Maya",
    "source_file": "a.ma",
}


class TestCreate:
    def test_a_blank_code_is_numbered_and_returned(self, staff_client, project):
        response = staff_client.post(URL, {**BODY, "project_id": str(project.pk)}, format="json")

        assert response.status_code == 201
        assert response.json()["code"] == "PUB-PUBP-0001"
        assert response.json()["project_id"] == str(project.pk)

    def test_two_creates_get_two_codes(self, staff_client, project):
        codes = {
            staff_client.post(URL, {**BODY, "project_id": str(project.pk)}, format="json").json()[
                "code"
            ]
            for _ in range(3)
        }
        assert len(codes) == 3

    def test_an_unknown_project_is_400_not_500(self, staff_client):
        response = staff_client.post(
            URL,
            {**BODY, "code": "C-1", "project_id": "00000000-0000-0000-0000-000000000000"},
            format="json",
        )

        assert response.status_code == 400
        assert "project_id" in response.content.decode()
        assert PublishItem.objects.count() == 0

    def test_a_used_code_is_400_in_any_case(self, staff_client):
        assert staff_client.post(URL, {**BODY, "code": "ABC-1"}, format="json").status_code == 201
        assert staff_client.post(URL, {**BODY, "code": "abc-1"}, format="json").status_code == 400

    def test_a_blank_code_without_a_project_is_400(self, staff_client):
        assert staff_client.post(URL, BODY, format="json").status_code == 400

    def test_a_version_supplies_the_entity(self, staff_client, project):
        shot = ShotFactory.create(project=project, code="SH050")
        version = published_version(project, shot=shot)
        body = {"name": "n", "dcc_tool": "Maya", "source_file": "a", "version_id": str(version.pk)}

        response = staff_client.post(URL, body, format="json")

        assert response.status_code == 201
        job = PublishItem.objects.get(pk=response.json()["id"])
        assert (job.version_id, job.entity_code, job.project_id) == (
            version.pk,
            "SH050",
            project.pk,
        )

    def test_the_frontend_body_still_works(self, staff_client):
        """The shape RESTPublishingAdapter sends today: its own code, entity code as id, no project."""
        body = {**BODY, "code": "PUB-20261027-AB12", "entity_id": "SH010"}

        assert staff_client.post(URL, body, format="json").status_code == 201


class TestDestinations:
    DEST = "/api/v1/publishing/destinations/"
    BODY = {"name": "Client SFTP", "type": "Storage Cluster", "path": "/mnt/x", "protocol": "NFS"}

    def test_names_are_unique_in_any_case(self, staff_client):
        assert staff_client.post(self.DEST, self.BODY, format="json").status_code == 201

        again = staff_client.post(self.DEST, {**self.BODY, "name": "client sftp"}, format="json")

        assert again.status_code == 400
        assert PublishDestination.objects.count() == 1

    def test_a_deleted_destinations_name_can_be_used_again(self, staff_client):
        first = staff_client.post(self.DEST, self.BODY, format="json").json()["id"]
        assert staff_client.delete(f"{self.DEST}{first}/").status_code == 204

        assert staff_client.post(self.DEST, self.BODY, format="json").status_code == 201

    def test_renaming_to_itself_in_another_case_is_allowed(self, staff_client):
        dest_id = staff_client.post(self.DEST, self.BODY, format="json").json()["id"]

        response = staff_client.patch(
            f"{self.DEST}{dest_id}/", {"name": "CLIENT SFTP"}, format="json"
        )

        assert response.status_code == 200

    def test_making_one_the_default_clears_the_previous_default(self, staff_client):
        first = staff_client.post(
            self.DEST, {**self.BODY, "is_default": True}, format="json"
        ).json()
        second = staff_client.post(
            self.DEST, {**self.BODY, "name": "Other", "is_default": True}, format="json"
        ).json()

        defaults = list(
            PublishDestination.objects.filter(is_default=True).values_list("id", flat=True)
        )
        assert defaults == [__import__("uuid").UUID(second["id"])]
        third = staff_client.patch(
            f"{self.DEST}{first['id']}/", {"is_default": True}, format="json"
        )
        assert third.status_code == 200
        assert list(
            PublishDestination.objects.filter(is_default=True).values_list("name", flat=True)
        ) == ["Client SFTP"]
