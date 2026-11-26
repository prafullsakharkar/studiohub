"""CR-58: link an account and sync the directory from the Directory (LDAP) screen (ADR-0039 decisions 6, 10)."""

from __future__ import annotations

import pytest
from django.core.cache import cache

from apps.identity.models import ExternalIdentity, SecurityEvent, User, UserSession
from apps.identity.tests.directory_helpers import (
    LOCAL_PASSWORD,
    FakeDirectory,
    as_user,
    configure,
    give_role,
    login,
    session,
)
from apps.identity.tests.factories import UserFactory

pytestmark = [pytest.mark.django_db, pytest.mark.usefixtures("seeded_platform_module")]

LINK = "/api/v1/identity/directory/link/"
SYNC = "/api/v1/identity/directory/sync/"


@pytest.fixture(autouse=True)
def _clean_cache():
    cache.clear()
    yield
    cache.clear()


@pytest.fixture
def directory(monkeypatch):
    fake = FakeDirectory()
    fake.install(monkeypatch)
    return fake


def _person(role=None, **kwargs):
    user = UserFactory.create(is_email_verified=True, **kwargs)
    user.set_password(LOCAL_PASSWORD)
    user.save(update_fields=["password"])
    if role:
        give_role(user, role)
    return user


@pytest.fixture
def admin_user():
    return _person("platform-admin")


@pytest.fixture
def admin(admin_user):
    return as_user(admin_user)


@pytest.fixture
def local():
    return _person(email="jane@studio.test")


def _link(client, username="jdoe", email="jane@studio.test", **extra):
    return client.post(LINK, {"email": email, "username": username, **extra}, format="json")


class TestOnlyThePlatformAdministrator:
    @pytest.mark.parametrize("role", [None, "artist", "org-admin", "production-admin"])
    def test_everyone_else_is_refused(self, role, directory, local):
        configure()
        directory.add("jdoe", mail="jane@studio.test")
        client = as_user(_person(role))

        assert _link(client).status_code == 403
        assert client.post(SYNC, {}, format="json").status_code == 403
        assert not ExternalIdentity.objects.exists()

    def test_anonymous_is_refused(self, directory):
        from rest_framework.test import APIClient

        assert APIClient().post(SYNC, {}, format="json").status_code == 401


class TestLink:
    def test_a_check_names_the_entry_and_links_nothing(self, admin, directory, local):
        configure()
        dn = directory.add("jdoe", mail="jane@studio.test")

        response = _link(admin, dry_run=True)

        assert response.status_code == 200, response.content
        assert response.json() == {
            "email": "jane@studio.test",
            "username": "jdoe",
            "dn": dn,
            "linked": False,
        }
        assert not ExternalIdentity.objects.exists()
        assert login("jane@studio.test", LOCAL_PASSWORD).status_code == 200

    def test_a_link_signs_in_with_the_username_and_ends_the_local_sign_in(
        self, admin, admin_user, directory, local
    ):
        configure()
        directory.add("jdoe", mail="jane@studio.test")
        session("jane@studio.test", LOCAL_PASSWORD)

        response = _link(admin)

        assert response.status_code == 200, response.content
        assert response.json()["linked"] is True
        assert ExternalIdentity.objects.get(user=local).username == "jdoe"
        assert not UserSession.objects.filter(user=local, status="active").exists()
        assert login("jane@studio.test", LOCAL_PASSWORD).status_code == 401
        session("jdoe")
        assert User.objects.filter(email="jane@studio.test").count() == 1
        event = SecurityEvent.objects.filter(user=local, metadata__area="directory_link").get()
        assert event.metadata == {
            "area": "directory_link",
            "username": "jdoe",
            "actor": str(admin_user.pk),
        }

    def test_it_works_while_sign_in_is_off(self, admin, directory, local):
        configure(enabled=False)
        directory.add("jdoe")

        assert _link(admin).status_code == 200

    @pytest.mark.parametrize(
        ("email", "username", "field", "message"),
        [
            ("nobody@studio.test", "jdoe", "email", "No account has this e-mail."),
            ("jane@studio.test", "ghost", "username", "No directory entry has this username."),
            ("not-an-email", "jdoe", "email", None),
        ],
    )
    def test_what_cannot_be_linked_is_a_400_on_its_field(
        self, admin, directory, local, email, username, field, message
    ):
        configure()
        directory.add("jdoe")

        response = _link(admin, username=username, email=email)

        assert response.status_code == 400, response.content
        assert field in str(response.json())
        if message:
            assert message in str(response.json())
        assert not ExternalIdentity.objects.exists()

    def test_an_account_already_linked_is_refused(self, admin, directory, local):
        configure()
        directory.add("jdoe")
        directory.add("jdoe2", subject="other")
        assert _link(admin).status_code == 200

        response = _link(admin, username="jdoe2")

        assert response.status_code == 400
        assert "already linked to the directory" in str(response.json())

    def test_an_entry_linked_to_another_account_is_refused(self, admin, directory, local):
        configure()
        directory.add("jdoe")
        _person(email="other@studio.test")
        assert _link(admin).status_code == 200

        response = _link(admin, email="other@studio.test")

        assert response.status_code == 400
        assert "already linked to another account" in str(response.json())

    def test_two_entries_for_one_username_are_refused(self, admin, directory, local):
        configure()
        directory.add("jdoe")
        directory.add("jdoe", dn="uid=jdoe,ou=more,ou=people,dc=studio,dc=test", subject="u2")

        response = _link(admin)

        assert response.status_code == 400
        assert "More than one entry" in str(response.json())

    def test_an_outage_is_a_503_and_links_nothing(self, admin, directory, local):
        configure()
        directory.add("jdoe")
        directory.down = True

        response = _link(admin)

        assert response.status_code == 503
        assert not ExternalIdentity.objects.exists()

    def test_without_the_encryption_key_it_is_a_503(self, admin, directory, local, settings):
        configure()
        directory.add("jdoe")
        settings.DIRECTORY_ENCRYPTION_KEYS = ()

        assert _link(admin).status_code == 503


class TestSync:
    def test_a_preview_lists_the_leavers_and_changes_nothing(self, admin, directory):
        configure()
        dn = directory.add("leaver")
        directory.add("stayer")
        session("leaver")
        session("stayer")
        directory.remove(dn)

        response = admin.post(SYNC, {"dry_run": True}, format="json")

        assert response.status_code == 200, response.content
        assert response.json() == {
            "dry_run": True,
            "refreshed": 1,
            "deactivated": ["leaver"],
            "skipped": [],
        }
        assert User.objects.get(email="leaver@studio.test").is_active is True

    def test_a_sync_deactivates_the_leavers_and_refreshes_the_others(self, admin, directory):
        configure()
        dn = directory.add("leaver")
        stayer_dn = directory.add("stayer", given="Stan")
        session("leaver")
        session("stayer")
        directory.remove(dn)
        directory.remove(stayer_dn)
        directory.add("stayer", given="Stanley")

        response = admin.post(SYNC, {}, format="json")

        assert response.status_code == 200, response.content
        assert response.json() == {
            "dry_run": False,
            "refreshed": 1,
            "deactivated": ["leaver"],
            "skipped": [],
        }
        leaver = User.objects.get(email="leaver@studio.test")
        assert leaver.is_active is False
        assert not UserSession.objects.filter(user=leaver, status="active").exists()
        stayer = User.objects.get(email="stayer@studio.test")
        assert stayer.is_active is True
        assert stayer.profile.first_name == "Stanley"

    def test_an_ambiguous_username_is_skipped_not_deactivated(self, admin, directory):
        configure()
        directory.add("jdoe")
        session("jdoe")
        directory.add("jdoe", dn="uid=jdoe,ou=more,ou=people,dc=studio,dc=test", subject="u2")

        response = admin.post(SYNC, {}, format="json")

        assert response.json()["skipped"] == ["jdoe"]
        assert response.json()["deactivated"] == []
        assert User.objects.get(email="jdoe@studio.test").is_active is True

    def test_an_outage_is_a_503_and_changes_nothing(self, admin, directory):
        configure()
        dn = directory.add("leaver")
        session("leaver")
        directory.remove(dn)
        directory.down = True

        response = admin.post(SYNC, {}, format="json")

        assert response.status_code == 503
        assert User.objects.get(email="leaver@studio.test").is_active is True

    def test_it_is_a_409_while_sign_in_is_off(self, admin, directory):
        configure(enabled=False)

        response = admin.post(SYNC, {}, format="json")

        assert response.status_code == 409
        assert "Directory sign-in is off" in str(response.json())


class TestRated:
    def test_both_are_rated_like_the_connection_test(self, admin, directory):
        # They open outbound connections: the `sensitive` scope (20/min) holds them, as for test-connection.
        configure(enabled=False)
        statuses = [admin.post(SYNC, {}, format="json").status_code for _ in range(21)]
        assert statuses[:20] == [409] * 20
        assert statuses[20] == 429
        assert _link(admin, email="nobody@studio.test").status_code == 429
