"""
CR-60: a project has one checked client and its own vendors, and only those can be chosen on its records.

The project's ``client_id`` is a live client's UUID (``client_name`` is the server's); a delivery's client is the
project's client; a task's vendor and a member's vendor are among the project's ``vendor_ids``; a member's client
is the project's client. Changing the client, or dropping a vendor, is refused while a record still names it.
"""

from __future__ import annotations

import importlib
from uuid import uuid4

import pytest
from django.apps import apps as django_apps
from rest_framework.test import APIClient

from apps.identity.tests.factories import UserFactory
from apps.masterdata.tests.factories import ClientFactory, VendorFactory
from apps.production.models import Project, ProjectMembership, Task
from apps.production.tests.factories import ProjectFactory, TaskFactory

pytestmark = pytest.mark.django_db

API = "/api/v1"
PROJECTS = f"{API}/projects/"
TASKS = f"{API}/tasks/"
DELIVERIES = f"{API}/deliveries/"
NOT_CLIENT = "This client is not the project's client."
NOT_VENDOR = "This vendor is not on the project."


def members_url(project):
    return f"/api/organizations/projects/{project.pk}/members/"


@pytest.fixture
def admin(admin_user):
    client = APIClient()
    client.force_authenticate(user=admin_user)
    return client


@pytest.fixture
def acme():
    return ClientFactory.create(name="Acme Pictures", code="CLI-ACME")


@pytest.fixture
def globex():
    return ClientFactory.create(name="Globex", code="CLI-GLOBEX")


@pytest.fixture
def north():
    return VendorFactory.create(name="Northlight", code="VEN-NORTH")


@pytest.fixture
def ember():
    return VendorFactory.create(name="Ember FX", code="VEN-EMBER")


@pytest.fixture
def project(acme, north):
    return ProjectFactory.create(
        code="CRP", client_id=str(acme.pk), client_name=acme.name, vendor_ids=[str(north.pk)]
    )


def patch_project(client, project, **body):
    return client.patch(f"{PROJECTS}{project.pk}/", body, format="json")


def create_task(client, project, **body):
    return client.post(
        TASKS,
        {
            "project_id": str(project.pk),
            "title": "Comp",
            "code": f"{project.code}_T{uuid4().hex[:4]}",
            "entity_type": "Shot",
            **body,
        },
        format="json",
    )


class TestTheProjectClient:
    def test_a_client_is_stored_as_its_uuid_and_named_by_the_server(self, admin, acme):
        response = admin.post(
            PROJECTS,
            {
                "code": "CRA",
                "name": "With a client",
                "type": "Feature Film",
                "client_id": str(acme.pk),
                "client_name": "Typed",
            },
            format="json",
        )
        assert response.status_code == 201, response.json()
        assert (response.json()["client_id"], response.json()["client_name"]) == (
            str(acme.pk),
            "Acme Pictures",
        )
        stored = Project.objects.get(code="CRA")
        assert (stored.client_id, stored.client_name) == (str(acme.pk), "Acme Pictures")
        assert admin.get(f"{PROJECTS}{stored.pk}/").json()["client_name"] == "Acme Pictures"

    @pytest.mark.parametrize(
        "value", ["CLI-ACME", "free text", str(uuid4())], ids=["code", "text", "unknown"]
    )
    def test_anything_but_a_live_clients_uuid_is_refused(self, admin, acme, value):
        project = ProjectFactory.create(code="CRB")
        response = patch_project(admin, project, client_id=value)
        assert response.status_code == 400
        assert response.json()["client_id"] == ["Unknown client."]
        project.refresh_from_db()
        assert project.client_id == ""

    def test_a_deleted_client_is_refused(self, admin, acme):
        project = ProjectFactory.create(code="CRC")
        type(acme).all_objects.filter(pk=acme.pk).update(is_deleted=True)
        assert patch_project(admin, project, client_id=str(acme.pk)).json()["client_id"] == [
            "Unknown client."
        ]

    def test_blank_clears_the_client_and_its_name(self, admin, project):
        response = patch_project(admin, project, client_id="")
        assert response.status_code == 200, response.json()
        project.refresh_from_db()
        assert (project.client_id, project.client_name) == ("", "")

    def test_the_name_alone_cannot_be_written(self, admin, project):
        response = patch_project(admin, project, client_name="Renamed")
        assert response.status_code == 200
        project.refresh_from_db()
        assert project.client_name == "Acme Pictures"


class TestChangingTheClientOrDroppingAVendor:
    def test_the_client_cannot_change_while_a_delivery_or_a_member_names_it(
        self, admin, project, acme, globex
    ):
        from apps.deliveries.models import DeliveryPackage

        DeliveryPackage.objects.create(name="Turnover", code="CRP_D1", project=project, client=acme)
        ProjectMembership.objects.create(
            project=project, user=UserFactory.create(), client_id=str(acme.pk)
        )

        response = patch_project(admin, project, client_id=str(globex.pk))

        assert response.status_code == 400
        assert response.json()["client_id"] == [
            "Acme Pictures is still the client of 1 delivery and 1 member."
        ]
        project.refresh_from_db()
        assert project.client_id == str(acme.pk)
        assert patch_project(admin, project, client_id="").status_code == 400

    def test_a_member_naming_the_client_by_code_counts_too(self, admin, project, globex):
        ProjectMembership.objects.create(
            project=project, user=UserFactory.create(), client_id="cli-acme"
        )
        response = patch_project(admin, project, client_id=str(globex.pk))
        assert response.json()["client_id"] == ["Acme Pictures is still the client of 1 member."]

    def test_an_unused_client_can_change_and_a_deleted_delivery_does_not_count(
        self, admin, project, acme, globex
    ):
        from apps.deliveries.models import DeliveryPackage

        DeliveryPackage.objects.create(
            name="Old", code="CRP_D2", project=project, client=acme, is_deleted=True
        )
        response = patch_project(admin, project, client_id=str(globex.pk))
        assert response.status_code == 200, response.json()
        assert response.json()["client_name"] == "Globex"

    def test_a_vendor_cannot_leave_while_a_task_or_a_member_names_it(
        self, admin, project, north, ember
    ):
        project.vendor_ids = [str(north.pk), str(ember.pk)]
        project.save(update_fields=["vendor_ids"])
        TaskFactory.create(project=project, vendor_id=str(north.pk))
        TaskFactory.create(project=project, vendor_code="VEN-NORTH")
        ProjectMembership.objects.create(
            project=project, user=UserFactory.create(), vendor_id=str(north.pk)
        )

        response = patch_project(admin, project, vendor_ids=[str(ember.pk)])

        assert response.status_code == 400
        assert response.json()["vendor_ids"] == [
            "Northlight is still the vendor of 2 tasks and 1 member."
        ]
        project.refresh_from_db()
        assert project.vendor_ids == [str(north.pk), str(ember.pk)]

    def test_an_unused_vendor_can_leave(self, admin, project, north, ember):
        project.vendor_ids = [str(north.pk), str(ember.pk)]
        project.save(update_fields=["vendor_ids"])
        TaskFactory.create(project=project, vendor_id=str(north.pk))
        response = patch_project(admin, project, vendor_ids=[str(north.pk)])
        assert response.status_code == 200, response.json()
        assert response.json()["vendor_names"] == ["Northlight"]


class TestTaskVendor:
    def test_a_project_vendor_is_stored_with_the_vendors_name_and_code(self, admin, project, north):
        response = create_task(
            admin, project, vendor_id=str(north.pk), vendor_name="Typed", vendor_code="TYPED"
        )
        assert response.status_code == 201, response.json()
        task = Task.objects.get(pk=response.json()["id"])
        assert (task.vendor_id, task.vendor_name, task.vendor_code) == (
            str(north.pk),
            "Northlight",
            "VEN-NORTH",
        )

    @pytest.mark.parametrize(
        "value", ["ember", "VEN-NORTH", str(uuid4())], ids=["other-vendor", "code", "unknown"]
    )
    def test_a_vendor_that_is_not_on_the_project_is_refused(self, admin, project, ember, value):
        value = str(ember.pk) if value == "ember" else value
        response = create_task(admin, project, vendor_id=value)
        assert response.status_code == 400
        assert response.json()["vendor_id"] == [NOT_VENDOR]
        assert not Task.objects.filter(project=project).exists()

    def test_a_project_with_no_vendors_offers_none(self, admin, acme, north):
        bare = ProjectFactory.create(code="CRN")
        assert create_task(admin, bare, vendor_id=str(north.pk)).json()["vendor_id"] == [NOT_VENDOR]

    def test_the_name_and_code_cannot_be_written_without_the_vendor(self, admin, project):
        response = create_task(admin, project, vendor_name="Typed", vendor_code="TYPED")
        assert response.status_code == 201
        task = Task.objects.get(pk=response.json()["id"])
        assert (task.vendor_id, task.vendor_name, task.vendor_code) == ("", "", "")

    def test_an_update_changes_and_clears_the_vendor(self, admin, project, north, ember):
        task = TaskFactory.create(project=project)
        assert admin.patch(
            f"{TASKS}{task.pk}/", {"vendor_id": str(ember.pk)}, format="json"
        ).json()["vendor_id"] == [NOT_VENDOR]
        ok = admin.patch(f"{TASKS}{task.pk}/", {"vendor_id": str(north.pk)}, format="json")
        assert ok.status_code == 200, ok.json()
        task.refresh_from_db()
        assert (task.vendor_name, task.vendor_code) == ("Northlight", "VEN-NORTH")
        assert (
            admin.patch(f"{TASKS}{task.pk}/", {"vendor_id": ""}, format="json").status_code == 200
        )
        task.refresh_from_db()
        assert (task.vendor_id, task.vendor_name, task.vendor_code) == ("", "", "")

    def test_a_task_whose_vendor_left_the_project_can_still_be_edited(self, admin, project, ember):
        task = TaskFactory.create(
            project=project,
            vendor_id=str(ember.pk),
            vendor_name="Ember FX",
            vendor_code="VEN-EMBER",
        )
        response = admin.patch(
            f"{TASKS}{task.pk}/", {"title": "Renamed", "vendor_id": str(ember.pk)}, format="json"
        )
        assert response.status_code == 200, response.json()
        task.refresh_from_db()
        assert (task.title, task.vendor_id, task.vendor_name) == (
            "Renamed",
            str(ember.pk),
            "Ember FX",
        )

    def test_a_bulk_create_is_checked_item_by_item(self, admin, project, north, ember):
        response = admin.post(
            f"{TASKS}bulk-create/",
            {
                "project_id": str(project.pk),
                "items": [
                    {
                        "code": f"{project.code}_B1",
                        "data": {"title": "One", "entity_type": "Shot", "vendor_id": str(north.pk)},
                    },
                    {
                        "code": f"{project.code}_B2",
                        "data": {"title": "Two", "entity_type": "Shot", "vendor_id": str(ember.pk)},
                    },
                ],
            },
            format="json",
        )
        assert NOT_VENDOR in response.content.decode()
        assert not Task.objects.filter(project=project, code=f"{project.code}_B2").exists()


class TestDeliveryClient:
    def body(self, project, client):
        return {"name": "Turnover", "project_id": str(project.pk), "client_id": str(client.pk)}

    def test_the_projects_client_is_accepted(self, admin, project, acme):
        from apps.deliveries.models import DeliveryPackage

        response = admin.post(DELIVERIES, self.body(project, acme), format="json")
        assert response.status_code == 201, response.json()
        assert DeliveryPackage.objects.get(project=project).client_id == acme.pk

    def test_another_client_is_refused(self, admin, project, globex):
        from apps.deliveries.models import DeliveryPackage

        response = admin.post(DELIVERIES, self.body(project, globex), format="json")
        assert response.status_code == 400
        assert response.json()["client_id"] == [NOT_CLIENT]
        assert not DeliveryPackage.objects.filter(project=project).exists()

    def test_a_project_with_no_client_offers_none(self, admin, acme):
        bare = ProjectFactory.create(code="CRD")
        assert admin.post(DELIVERIES, self.body(bare, acme), format="json").json()["client_id"] == [
            NOT_CLIENT
        ]

    def test_a_delivery_with_no_client_is_still_fine(self, admin, project):
        response = admin.post(
            DELIVERIES, {"name": "Internal", "project_id": str(project.pk)}, format="json"
        )
        assert response.status_code == 201, response.json()


class TestMemberClientAndVendor:
    def add(self, admin, project, **body):
        return admin.post(
            members_url(project),
            {"userId": str(UserFactory.create().pk), "role": "Artist", **body},
            format="json",
        )

    def test_the_projects_client_and_vendor_are_stored_as_uuids(self, admin, project, acme, north):
        client_member = self.add(admin, project, client_id=str(acme.pk))
        vendor_member = self.add(admin, project, vendor_id=str(north.pk).upper())
        assert client_member.status_code == 201, client_member.json()
        assert vendor_member.status_code == 201, vendor_member.json()
        rows = ProjectMembership.objects.filter(project=project).exclude(client_id="", vendor_id="")
        assert sorted((m.client_id, m.vendor_id) for m in rows) == sorted(
            [(str(acme.pk), ""), ("", str(north.pk))]
        )

    def test_others_are_refused_and_nobody_is_added(self, admin, project, globex, ember):
        before = ProjectMembership.objects.filter(project=project).count()
        assert self.add(admin, project, client_id=str(globex.pk)).json()["client_id"] == [
            NOT_CLIENT
        ]
        assert self.add(admin, project, vendor_id=str(ember.pk)).json()["vendor_id"] == [NOT_VENDOR]
        assert self.add(admin, project, vendor_id="VEN-NORTH").json()["vendor_id"] == [NOT_VENDOR]
        assert ProjectMembership.objects.filter(project=project).count() == before

    def test_an_edit_sets_and_clears_who_the_member_works_for(self, admin, project, north, ember):
        member = ProjectMembership.objects.create(
            project=project, user=UserFactory.create(), status="active"
        )
        url = f"{members_url(project)}{member.pk}/"

        assert admin.patch(url, {"vendor_id": str(ember.pk)}, format="json").json()[
            "vendor_id"
        ] == [NOT_VENDOR]
        assert admin.patch(url, {"vendor_id": str(north.pk)}, format="json").status_code == 200
        member.refresh_from_db()
        assert member.vendor_id == str(north.pk)

        assert admin.patch(url, {"vendor_id": ""}, format="json").status_code == 200
        member.refresh_from_db()
        assert (member.vendor_id, member.client_id) == ("", "")


class TestMigration:
    """``production.0019`` brings existing projects in line (run here on rows made after it)."""

    def run(self):
        module = importlib.import_module("apps.production.migrations.0019_cr60_project_partners")
        module.bring_in_line(django_apps, None)

    def test_a_client_code_becomes_the_clients_uuid_and_name(self, acme):
        project = ProjectFactory.create(code="CRM1", client_id="cli-acme")
        self.run()
        project.refresh_from_db()
        assert (project.client_id, project.client_name) == (str(acme.pk), "Acme Pictures")

    def test_a_project_with_no_client_takes_the_one_its_records_name(self, acme):
        from apps.deliveries.models import DeliveryPackage

        project = ProjectFactory.create(code="CRM2")
        DeliveryPackage.objects.create(name="D", code="CRM2_D1", project=project, client=acme)
        ProjectMembership.objects.create(
            project=project, user=UserFactory.create(), client_id="CLI-ACME"
        )
        self.run()
        project.refresh_from_db()
        assert (project.client_id, project.client_name) == (str(acme.pk), "Acme Pictures")

    def test_two_different_clients_leave_the_client_blank(self, acme, globex, capsys):
        from apps.deliveries.models import DeliveryPackage

        project = ProjectFactory.create(code="CRM3")
        DeliveryPackage.objects.create(name="D1", code="CRM3_D1", project=project, client=acme)
        DeliveryPackage.objects.create(name="D2", code="CRM3_D2", project=project, client=globex)
        self.run()
        project.refresh_from_db()
        assert project.client_id == ""
        assert "1 project(s) have records naming more than one client" in capsys.readouterr().out

    def test_an_unknown_client_value_is_left_and_counted(self, capsys):
        project = ProjectFactory.create(code="CRM4", client_id="nobody")
        self.run()
        project.refresh_from_db()
        assert project.client_id == "nobody"
        assert "1 client value(s) name no live client" in capsys.readouterr().out

    def test_vendors_named_by_tasks_and_members_are_added_after_the_listed_ones(self, north, ember):
        third = VendorFactory.create(name="Third", code="VEN-THIRD")
        project = ProjectFactory.create(code="CRM5", vendor_ids=[str(third.pk)])
        TaskFactory.create(project=project, vendor_code="ven-north")
        TaskFactory.create(project=project, vendor_id="not-a-vendor")
        ProjectMembership.objects.create(
            project=project, user=UserFactory.create(), vendor_id=str(ember.pk)
        )
        self.run()
        project.refresh_from_db()
        assert project.vendor_ids[0] == str(third.pk)
        assert sorted(project.vendor_ids[1:]) == sorted([str(north.pk), str(ember.pk)])

    def test_a_second_run_changes_nothing(self, acme, north):
        project = ProjectFactory.create(code="CRM6", client_id="CLI-ACME")
        TaskFactory.create(project=project, vendor_id=str(north.pk))
        self.run()
        project.refresh_from_db()
        first = (project.client_id, project.client_name, list(project.vendor_ids))
        self.run()
        project.refresh_from_db()
        assert (project.client_id, project.client_name, list(project.vendor_ids)) == first
