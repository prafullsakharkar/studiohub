"""CR-22 (job list filters, project and version ids), CR-23 (job delete guard), CR-24 (destination type)."""

from __future__ import annotations

import pytest

from apps.production.tests.factories import ProjectFactory, ShotFactory
from apps.publishing.models import PublishDestination, PublishItem
from apps.publishing.tests.helpers import published_version, registration

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


def make_job(client, project, **over):
    # A version supplies the entity itself, so the body then carries none (the server checks they agree).
    base = (
        {k: v for k, v in BODY.items() if not k.startswith("entity")}
        if "version_id" in over
        else BODY
    )
    response = client.post(URL, {**base, "project_id": str(project.pk), **over}, format="json")
    assert response.status_code == 201, response.content
    return PublishItem.objects.get(pk=response.json()["id"])


def ids(client, query):
    response = client.get(f"{URL}?{query}")
    assert response.status_code == 200, response.content
    return {row["id"] for row in response.json()["results"]}


class TestListFilters:
    def test_rows_carry_the_project_id_and_the_detail_the_version_id(self, staff_client, project):
        shot = ShotFactory.create(project=project, code="SH050")
        version = published_version(project, shot=shot)
        job = make_job(staff_client, project, version_id=str(version.pk))

        row = staff_client.get(URL).json()["results"][0]
        detail = staff_client.get(f"{URL}{job.pk}/").json()

        assert row["project_id"] == str(project.pk)
        assert detail["version_id"] == str(version.pk)

    def test_job_status_takes_the_stored_word_in_any_case(self, staff_client, project):
        pending = make_job(staff_client, project)
        failed = make_job(staff_client, project)
        PublishItem.objects.filter(pk=failed.pk).update(status="Failed")

        assert ids(staff_client, "job_status=Failed") == {str(failed.pk)}
        assert ids(staff_client, "job_status=pending") == {str(pending.pk)}
        assert ids(staff_client, "job_status=Banana") == set()

    def test_status_takes_the_read_words_too(self, staff_client, project):
        queued = make_job(staff_client, project)
        exported = make_job(staff_client, project)
        validated = make_job(staff_client, project)
        PublishItem.objects.filter(pk=exported.pk).update(status="Exported")
        PublishItem.objects.filter(pk=validated.pk).update(status="Validated")

        assert ids(staff_client, "status=Queued") == {str(queued.pk)}
        assert ids(staff_client, "status=Published") == {str(exported.pk), str(validated.pk)}
        assert ids(staff_client, "status=Exported") == {str(exported.pk)}

    def test_unpublished_includes_archived_jobs(self, staff_client, project):
        cancelled = make_job(staff_client, project)
        archived = make_job(staff_client, project)
        PublishItem.objects.filter(pk=cancelled.pk).update(status="Cancelled")
        PublishItem.objects.filter(pk=archived.pk).update(status="Exported", is_archived=True)

        assert ids(staff_client, "status=Unpublished") == {str(cancelled.pk), str(archived.pk)}
        assert ids(staff_client, "status=Published") == set()

    def test_tool_and_entity_type_ignore_case(self, staff_client, project):
        maya = make_job(staff_client, project)
        nuke = make_job(staff_client, project, dcc_tool="Nuke")

        assert ids(staff_client, "dcc_tool=nuke") == {str(nuke.pk)}
        assert ids(staff_client, "dcc_tool=MAYA") == {str(maya.pk)}
        assert ids(staff_client, "entity_type=shot") == {str(maya.pk), str(nuke.pk)}

    def test_project_and_version_filters_under_both_spellings(self, staff_client, project):
        other = ProjectFactory.create(code="OTHR")
        mine = make_job(staff_client, project)
        theirs = make_job(staff_client, other)
        version = published_version(project, shot=ShotFactory.create(project=project, code="SH060"))
        versioned = make_job(staff_client, project, version_id=str(version.pk))

        assert ids(staff_client, f"project={project.pk}") == {str(mine.pk), str(versioned.pk)}
        assert ids(staff_client, f"project_id={other.pk}") == {str(theirs.pk)}
        assert ids(staff_client, f"version={version.pk}") == {str(versioned.pk)}
        assert ids(staff_client, f"version_id={version.pk}") == {str(versioned.pk)}

    def test_a_value_that_is_not_an_id_is_400(self, staff_client):
        assert staff_client.get(f"{URL}?project=nope").status_code == 400
        assert staff_client.get(f"{URL}?version_id=nope").status_code == 400


class TestDelete:
    @pytest.mark.parametrize("stored", ["Pending", "Cancelled"])
    def test_a_job_that_never_ran_or_was_cancelled_is_deleted(self, staff_client, project, stored):
        job = make_job(staff_client, project)
        PublishItem.objects.filter(pk=job.pk).update(status=stored)

        assert staff_client.delete(f"{URL}{job.pk}/").status_code == 204
        assert not PublishItem.objects.filter(pk=job.pk).exists()

    @pytest.mark.parametrize(
        "stored", ["Validating", "Validated", "Exporting", "Exported", "Failed"]
    )
    def test_any_other_status_is_409_and_the_job_stays(self, staff_client, project, stored):
        job = make_job(staff_client, project)
        PublishItem.objects.filter(pk=job.pk).update(status=stored)

        response = staff_client.delete(f"{URL}{job.pk}/")

        assert response.status_code == 409
        assert response.json()["error"]["code"] == "job_not_editable"
        assert PublishItem.objects.filter(pk=job.pk).exists()

    def test_a_job_with_registered_files_is_409(self, staff_client, project, root):
        version = published_version(project, shot=ShotFactory.create(project=project, code="SH070"))
        job = make_job(staff_client, project, version_id=str(version.pk))
        body = registration(version, root, export_job_id=str(job.pk))
        assert (
            staff_client.post("/api/v1/publishing/files/", body, format="json").status_code == 201
        )
        PublishItem.objects.filter(pk=job.pk).update(status="Cancelled")

        response = staff_client.delete(f"{URL}{job.pk}/")

        assert response.status_code == 409
        assert response.json()["error"]["code"] == "job_has_files"
        assert PublishItem.objects.filter(pk=job.pk).exists()


class TestDestinationType:
    DEST = "/api/v1/publishing/destinations/"
    BODY = {"name": "Dest", "type": "Storage Cluster", "path": "/mnt/x", "protocol": "NFS"}

    def test_a_listed_type_is_accepted(self, staff_client):
        assert staff_client.post(self.DEST, self.BODY, format="json").status_code == 201

    def test_a_made_up_type_is_400_on_the_type_field(self, staff_client):
        response = staff_client.post(self.DEST, {**self.BODY, "type": "Banana"}, format="json")

        assert response.status_code == 400
        assert "type" in response.json()
        assert PublishDestination.objects.count() == 0

    def test_an_old_value_survives_an_unchanged_save_but_not_a_change_to_another_bad_one(
        self, staff_client
    ):
        destination = PublishDestination.objects.create(
            name="Legacy", destination_type="Old Kind", path="/p", protocol="NFS"
        )
        url = f"{self.DEST}{destination.pk}/"

        assert (
            staff_client.patch(url, {"type": "Old Kind", "path": "/q"}, format="json").status_code
            == 200
        )
        assert staff_client.patch(url, {"type": "Newer Kind"}, format="json").status_code == 400
        assert staff_client.patch(url, {"type": "Vendor Ingest"}, format="json").status_code == 200
