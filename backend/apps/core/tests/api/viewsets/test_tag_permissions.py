"""CR-28: anyone signed in reads tags; changing them is platform settings administration; system tags are the platform's."""

from __future__ import annotations

import pytest
from rest_framework.test import APIClient

from apps.core.models.tag import Tag
from apps.core.tests.factories import TagFactory
from apps.identity.tests.factories import UserFactory

pytestmark = pytest.mark.django_db

URL = "/api/v1/core/tags/"


def detail(tag):
    return f"{URL}{tag.uuid}/"


def client_for(user):
    client = APIClient()
    client.force_authenticate(user=user)
    return client


@pytest.fixture
def manager(staff_client):
    # A holder of every code who is not a superuser: settings.manage, no break-glass.
    return staff_client


class TestWhoMay:
    def test_anyone_signed_in_reads(self, authenticated_client):
        TagFactory.create_batch(2)
        assert authenticated_client.get(URL).status_code == 200

    def test_a_signed_in_user_without_the_code_cannot_write(self, authenticated_client):
        tag = TagFactory.create(is_system=False)
        assert authenticated_client.post(URL, {"name": "mine"}, format="json").status_code == 403
        assert (
            authenticated_client.patch(detail(tag), {"name": "renamed"}, format="json").status_code
            == 403
        )
        assert authenticated_client.delete(detail(tag)).status_code == 403
        assert Tag.objects.filter(pk=tag.pk, name=tag.name).exists()

    def test_a_manager_writes(self, manager):
        created = manager.post(URL, {"name": "wip", "color": "#33aa66"}, format="json")
        assert created.status_code == 201, created.content
        tag = Tag.objects.get(name="wip")
        assert (
            manager.patch(
                detail(tag), {"description": "work in progress"}, format="json"
            ).status_code
            == 200
        )
        assert manager.delete(detail(tag)).status_code == 204

    def test_nobody_anonymous(self, api_client):
        assert api_client.get(URL).status_code == 401


class TestSystemTags:
    def test_only_a_platform_administrator_changes_or_removes_one(self, manager, admin_client):
        tag = TagFactory.create(name="system-one", is_system=True)
        assert manager.patch(detail(tag), {"name": "taken"}, format="json").status_code == 403
        assert manager.delete(detail(tag)).status_code == 403
        assert Tag.objects.get(pk=tag.pk).name == "system-one"
        assert (
            admin_client.patch(detail(tag), {"description": "ok"}, format="json").status_code == 200
        )
        assert admin_client.delete(detail(tag)).status_code == 204

    def test_is_system_is_for_a_platform_administrator_to_say(self, manager, admin_client):
        mine = manager.post(URL, {"name": "pretend", "is_system": True}, format="json")
        assert mine.status_code == 201 and mine.json()["is_system"] is False
        tag = Tag.objects.get(name="pretend")
        manager.patch(detail(tag), {"is_system": True}, format="json")
        assert Tag.objects.get(pk=tag.pk).is_system is False
        theirs = admin_client.post(URL, {"name": "platform", "is_system": True}, format="json")
        assert theirs.status_code == 201 and theirs.json()["is_system"] is True


class TestBody:
    def test_colour_is_hex_or_empty(self, manager):
        for bad in ("red", "#12", "#GGGGGG", "#1234567"):
            response = manager.post(URL, {"name": f"c{bad}", "color": bad}, format="json")
            assert response.status_code == 400, bad
            assert "color" in response.json()
        assert manager.post(URL, {"name": "none"}, format="json").status_code == 201
        assert (
            manager.post(URL, {"name": "short", "color": "#abc"}, format="json").status_code == 201
        )

    def test_create_and_update_answer_the_id(self, manager):
        created = manager.post(URL, {"name": "withid"}, format="json")
        assert created.json()["id"]
        tag = Tag.objects.get(name="withid")
        assert created.json()["id"] == str(tag.id)
        assert manager.patch(detail(tag), {"description": "d"}, format="json").json()["id"] == str(
            tag.id
        )

    def test_a_plain_user_row_keeps_working(self):
        user = UserFactory.create(is_staff=False, is_superuser=False)
        assert client_for(user).get(URL).status_code == 200
