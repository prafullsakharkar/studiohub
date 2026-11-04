"""
The directory settings screen's API and the per-user MFA requirement (ADR-0039 decisions 3 and 5,
CR-40 WP L.1 and L.5).
"""

from __future__ import annotations

import logging

import pytest
from django.core.cache import cache

from apps.identity.models import DirectoryConfiguration, SecurityEvent, User
from apps.identity.services.mfa import MFAPolicyService
from apps.identity.tests.directory_helpers import (
    DIRECTORY,
    LOCAL_PASSWORD,
    SERVICE_DN,
    SERVICE_PASSWORD,
    TEST_CONNECTION,
    TEST_USER,
    FakeDirectory,
    as_user,
    configure,
    give_role,
    session,
)
from apps.identity.tests.factories import UserFactory

pytestmark = [pytest.mark.django_db, pytest.mark.usefixtures("seeded_platform_module")]

DATA = "/api/v1/projects/"


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
def admin():
    return as_user(_person("platform-admin"))


def _connection(**extra):
    return {
        "server_uri": "ldaps://ldap.studio.test",
        "bind_dn": SERVICE_DN,
        "bind_password": SERVICE_PASSWORD,
        "user_search_base": "ou=people,dc=studio,dc=test",
        **extra,
    }


class TestWhoMayManageIt:
    @pytest.mark.parametrize("role", [None, "artist", "org-admin", "production-admin"])
    def test_everyone_but_the_platform_administrator_is_refused(self, role, directory):
        client = as_user(_person(role))

        assert client.get(DIRECTORY).status_code == 403
        assert client.patch(DIRECTORY, {"enabled": True}, format="json").status_code == 403
        assert client.post(TEST_CONNECTION).status_code == 403
        assert client.post(TEST_USER, {"username": "jdoe"}, format="json").status_code == 403

    def test_the_platform_administrator_may(self, admin):
        assert admin.get(DIRECTORY).status_code == 200


class TestTheServicePassword:
    def test_it_is_stored_encrypted_and_never_returned(self, admin, caplog):
        with caplog.at_level(logging.DEBUG):
            response = admin.patch(DIRECTORY, _connection(), format="json")

        assert response.status_code == 200, response.content
        body = response.json()
        assert "bind_password" not in body
        assert body["bind_password_set"] is True
        stored = DirectoryConfiguration.objects.get().bind_password
        assert stored.startswith("enc:v1:")
        assert SERVICE_PASSWORD not in stored
        assert SERVICE_PASSWORD not in admin.get(DIRECTORY).content.decode()
        assert SERVICE_PASSWORD not in caplog.text

    def test_the_change_is_audited_without_the_value(self, admin):
        admin.patch(DIRECTORY, _connection(), format="json")

        event = SecurityEvent.objects.filter(metadata__area="directory").latest("occurred_at")
        assert "bind_password" in event.metadata["fields"]
        assert SERVICE_PASSWORD not in str(event.metadata)

    def test_leaving_it_out_keeps_it_and_an_empty_string_clears_it(self, admin):
        admin.patch(DIRECTORY, _connection(), format="json")
        admin.patch(DIRECTORY, {"bind_dn": "cn=other,dc=studio,dc=test"}, format="json")
        assert DirectoryConfiguration.objects.get().bind_password

        admin.patch(DIRECTORY, {"bind_password": ""}, format="json")

        assert DirectoryConfiguration.objects.get().bind_password == ""

    def test_without_an_encryption_key_it_cannot_be_saved(self, admin, settings):
        settings.DIRECTORY_ENCRYPTION_KEYS = ()

        response = admin.patch(DIRECTORY, _connection(), format="json")

        assert response.status_code == 503
        assert DirectoryConfiguration.objects.get().bind_password == ""


class TestItCannotBeSwitchedOnBroken:
    def test_plain_ldap_without_starttls_is_refused(self, admin):
        response = admin.patch(
            DIRECTORY, _connection(server_uri="ldap://ldap.studio.test"), format="json"
        )

        assert response.status_code == 400
        assert "start_tls" in response.content.decode()

    def test_plain_ldap_with_starttls_is_accepted(self, admin):
        response = admin.patch(
            DIRECTORY,
            _connection(server_uri="ldap://ldap.studio.test", start_tls=True),
            format="json",
        )

        assert response.status_code == 200

    def test_a_filter_without_the_username_is_refused(self, admin):
        response = admin.patch(DIRECTORY, {"user_filter": "(uid=*)"}, format="json")

        assert response.status_code == 400

    def test_an_unknown_default_role_is_refused(self, admin):
        response = admin.patch(DIRECTORY, {"default_role_code": "nope"}, format="json")

        assert response.status_code == 400

    def test_turning_it_on_needs_a_passing_connection_test(self, admin, directory):
        admin.patch(DIRECTORY, _connection(), format="json")

        refused = admin.patch(DIRECTORY, {"enabled": True}, format="json")
        tested = admin.post(TEST_CONNECTION).json()
        accepted = admin.patch(DIRECTORY, {"enabled": True}, format="json")

        assert refused.status_code == 400
        assert tested["ok"] is True
        assert accepted.status_code == 200
        assert accepted.json()["enabled"] is True

    def test_a_failed_test_does_not_allow_it(self, admin, directory):
        admin.patch(DIRECTORY, _connection(bind_password="wrong"), format="json")

        tested = admin.post(TEST_CONNECTION).json()

        assert tested["ok"] is False
        assert admin.patch(DIRECTORY, {"enabled": True}, format="json").status_code == 400

    def test_changing_the_server_after_a_test_needs_a_new_one(self, admin, directory):
        admin.patch(DIRECTORY, _connection(), format="json")
        admin.post(TEST_CONNECTION)

        admin.patch(DIRECTORY, {"server_uri": "ldaps://other.studio.test"}, format="json")

        assert DirectoryConfiguration.objects.get().last_tested_at is None
        assert admin.patch(DIRECTORY, {"enabled": True}, format="json").status_code == 400

    def test_the_forced_off_switch_is_reported(self, admin, settings):
        settings.DIRECTORY_LOGIN_FORCE_OFF = True

        assert admin.get(DIRECTORY).json()["forced_off"] is True


class TestTestAUsername:
    def test_it_shows_what_would_be_copied_without_any_password(self, admin, directory):
        configure(enabled=False)
        directory.add("jdoe", given="Jane", sn="Doe")

        body = admin.post(TEST_USER, {"username": "jdoe"}, format="json").json()

        assert body["found"] is True
        assert body["entry"]["email"] == "jdoe@studio.test"
        assert body["entry"]["first_name"] == "Jane"
        assert directory.binds == [SERVICE_DN]

    def test_an_entry_without_mail_is_flagged(self, admin, directory):
        configure(enabled=False)
        directory.add("nomail", no_mail=True)

        body = admin.post(TEST_USER, {"username": "nomail"}, format="json").json()

        assert body["found"] is True
        assert body["problems"]

    def test_no_match_and_an_outage_are_reported(self, admin, directory):
        configure(enabled=False)

        assert admin.post(TEST_USER, {"username": "ghost"}, format="json").json()["found"] is False
        directory.down = True
        assert admin.post(TEST_USER, {"username": "ghost"}, format="json").json()["ok"] is False


class TestMfaForDirectoryUsers:
    @pytest.fixture(autouse=True)
    def _blanket_rule_on(self, monkeypatch):
        # The production default (MFA_REQUIRE_ALL).
        monkeypatch.setattr(MFAPolicyService, "REQUIRE_MFA", True)

    def test_a_directory_user_is_not_asked_for_mfa_by_default(self, directory):
        configure()
        directory.add("jdoe")

        client, body = session("jdoe")

        assert "mfa_enrollment_required" not in body
        assert client.get("/api/v1/identity/users/me/").status_code == 200

    def test_a_local_account_still_is(self):
        user = _person()

        _, body = session(user.email, LOCAL_PASSWORD)

        assert body["mfa_enrollment_required"] is True

    def test_the_configuration_can_require_it_for_every_directory_user(self, directory):
        configure(require_mfa=True)
        directory.add("jdoe")

        _, body = session("jdoe")

        assert body["mfa_enrollment_required"] is True

    def test_a_directory_user_who_is_a_vendor_member_is_still_required(self, directory):
        from apps.production.models import ProjectMembership
        from apps.production.tests.factories import ProjectFactory

        configure()
        directory.add("vendor")
        session("vendor")
        user = User.objects.get(email="vendor@studio.test")
        ProjectMembership.objects.create(
            user=user, project=ProjectFactory(), status="active", role="Artist", vendor_id="v-1"
        )

        _, body = session("vendor")

        assert body["mfa_enrollment_required"] is True


class TestRequireMfaForOnePerson:
    def _target(self):
        return _person()

    def _url(self, user):
        return f"/api/v1/identity/users/{user.pk}/require-mfa/"

    def test_the_platform_administrator_may_require_it(self):
        target = self._target()
        admin = as_user(_person("platform-admin", is_staff=True))

        response = admin.post(self._url(target), {"required": True}, format="json")

        assert response.status_code == 200, response.content
        assert response.json() == {"mfa_required": True}
        target.refresh_from_db()
        assert target.mfa_required is True
        assert SecurityEvent.objects.filter(user=target, metadata__area="mfa_required").exists()

    def test_the_account_must_then_enrol_at_its_next_request(self, directory):
        configure()
        directory.add("jdoe")
        client, _ = session("jdoe")
        assert client.get(DATA).status_code == 200
        user = User.objects.get(email="jdoe@studio.test")

        as_user(_person("platform-admin", is_staff=True)).post(
            self._url(user), {"required": True}, format="json"
        )

        refused = client.get(DATA)
        assert refused.status_code == 403
        assert refused.json().get("code") == "mfa_enrollment_required"

    def test_turning_it_off_stops_requiring_it(self):
        target = self._target()
        target.mfa_required = True
        target.save(update_fields=["mfa_required"])
        admin = as_user(_person("platform-admin", is_staff=True))

        admin.post(self._url(target), {"required": False}, format="json")

        target.refresh_from_db()
        assert target.mfa_required is False
        assert MFAPolicyService.is_required(user=target) is False

    def test_an_organization_administrator_holds_the_permission(self):
        from apps.identity.services.permission_cache import PermissionCacheService

        org_admin = _person("org-admin")

        assert PermissionCacheService.has_permission(
            user=org_admin, permission="identity.user.require_mfa"
        )
        assert not PermissionCacheService.has_permission(
            user=org_admin, permission="identity.directory.manage"
        )

    def test_a_staff_organization_administrator_may_set_it(self):
        target = self._target()
        org_admin = as_user(_person("org-admin", is_staff=True))

        response = org_admin.post(self._url(target), {"required": True}, format="json")

        assert response.status_code == 200, response.content

    def test_an_artist_may_not(self):
        target = self._target()
        artist = as_user(_person("artist", is_staff=True))

        response = artist.post(self._url(target), {"required": True}, format="json")

        assert response.status_code == 403
        target.refresh_from_db()
        assert target.mfa_required is False

    def test_the_value_must_be_true_or_false(self):
        target = self._target()
        admin = as_user(_person("platform-admin", is_staff=True))

        response = admin.post(self._url(target), {"required": "yes"}, format="json")

        assert response.status_code == 400

    def test_the_user_payload_shows_it(self):
        target = self._target()
        admin = as_user(_person("platform-admin", is_staff=True))

        body = admin.get(f"/api/v1/identity/users/{target.pk}/").json()

        assert body["mfa_required"] is False
        assert body["auth_source"] == "local"

    def test_it_cannot_be_set_through_a_plain_update(self):
        target = self._target()
        admin = as_user(_person("platform-admin", is_staff=True))

        admin.patch(f"/api/v1/identity/users/{target.pk}/", {"mfa_required": True}, format="json")

        target.refresh_from_db()
        assert target.mfa_required is False
