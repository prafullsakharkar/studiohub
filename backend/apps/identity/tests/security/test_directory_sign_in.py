"""
Directory (LDAP) sign-in beside local accounts (ADR-0039, CR-40 WP L.2 to L.4).

Every call goes through the real login endpoint; the directory is ldap3's in-memory mock, so the
search, the filter escaping and the bind are the real client code.
"""

from __future__ import annotations

import logging

import pytest
from django.core.cache import cache

from apps.identity.models import (
    ExternalIdentity,
    LoginAttempt,
    Profile,
    SecurityEvent,
    User,
    UserRole,
)
from apps.identity.services.directory.client import DirectoryClient
from apps.identity.tests.directory_helpers import (
    LOCAL_PASSWORD,
    ME,
    PASSWORD,
    FakeDirectory,
    configure,
    login,
    session,
)
from apps.identity.tests.factories import UserFactory

pytestmark = [pytest.mark.django_db, pytest.mark.usefixtures("seeded_platform_module")]


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


def _local(email="local@studio.test"):
    user = UserFactory.create(email=email, is_email_verified=True)
    user.set_password(LOCAL_PASSWORD)
    user.save(update_fields=["password"])
    return user


def _reason(identifier):
    attempt = LoginAttempt.objects.filter(username=identifier).order_by("-attempted_at").first()
    return attempt.reason if attempt else None


class TestWhenTheDirectoryIsOff:
    def test_no_connection_is_made_and_local_sign_in_is_unchanged(self, directory):
        configure(enabled=False)
        directory.add("jdoe")
        _local()

        assert login("jdoe").status_code == 401
        assert login("local@studio.test", LOCAL_PASSWORD).status_code == 200
        assert directory.binds == []
        assert _reason("jdoe") == "unknown_user"

    def test_without_any_configuration_nothing_is_asked(self, directory):
        directory.add("jdoe")

        assert login("jdoe").status_code == 401
        assert directory.binds == []

    def test_a_directory_user_cannot_sign_in_while_it_is_off(self, directory):
        configure()
        directory.add("jdoe")
        assert login("jdoe").status_code == 200
        configure(enabled=False)

        response = login("jdoe")

        assert response.status_code == 401
        assert _reason("jdoe") == "ldap_disabled"

    def test_the_server_switch_turns_it_off_whatever_the_screen_says(self, directory, settings):
        configure()
        directory.add("jdoe")
        settings.DIRECTORY_LOGIN_FORCE_OFF = True

        assert login("jdoe").status_code == 401
        assert directory.binds == []
        assert not User.objects.filter(email="jdoe@studio.test").exists()


class TestFirstSignIn:
    def test_it_makes_the_account_the_profile_the_link_the_role_and_the_person(
        self, directory, django_capture_on_commit_callbacks
    ):
        from apps.masterdata.models import Person

        configure()
        directory.add("jdoe", given="Jane", sn="Doe", display="Jane D.")

        with django_capture_on_commit_callbacks(execute=True):
            client, body = session("jdoe")

        user = User.objects.get(email="jdoe@studio.test")
        assert ExternalIdentity.objects.filter(user=user, subject="uuid-jdoe").count() == 1
        assert not user.has_usable_password()
        profile = Profile.objects.get(user=user)
        assert (profile.first_name, profile.last_name, profile.display_name) == (
            "Jane",
            "Doe",
            "Jane D.",
        )
        assert list(UserRole.objects.filter(user=user).values_list("role__code", flat=True)) == [
            "artist"
        ]
        assert Person.objects.filter(user=user).count() == 1
        assert SecurityEvent.objects.filter(user=user, event_type="user_created").exists()
        assert "mfa_enrollment_required" not in body
        me = client.get(ME).json()
        assert me["auth_source"] == "ldap"
        assert me["mfa_required"] is False

    def test_the_username_is_matched_whatever_its_case(self, directory):
        configure()
        directory.add("jdoe")
        session("jdoe")

        session("JDoe")

        assert User.objects.filter(email="jdoe@studio.test").count() == 1

    def test_an_entry_without_mail_makes_no_account(self, directory):
        configure()
        directory.add("nomail", no_mail=True)

        assert login("nomail").status_code == 401
        assert _reason("nomail") == "ldap_no_email"
        assert not ExternalIdentity.objects.exists()

    def test_a_local_account_with_the_same_email_is_not_taken_over(self, directory):
        local = _local("jdoe@studio.test")
        configure()
        directory.add("jdoe")

        assert login("jdoe").status_code == 401
        assert _reason("jdoe") == "ldap_email_conflict"
        assert not ExternalIdentity.objects.exists()
        local.refresh_from_db()
        assert local.check_password(LOCAL_PASSWORD)
        assert login("jdoe@studio.test", LOCAL_PASSWORD).status_code == 200


class TestLaterSignIns:
    def test_nothing_new_is_made_and_the_name_and_email_follow_the_directory(self, directory):
        configure()
        dn = directory.add("jdoe", given="Jane", sn="Doe")
        session("jdoe")
        directory.remove(dn)
        directory.add("jdoe", given="Janet", sn="Dough", mail="janet@studio.test")

        session("jdoe")

        assert ExternalIdentity.objects.count() == 1
        user = ExternalIdentity.objects.get(subject="uuid-jdoe").user
        assert user.email == "janet@studio.test"
        assert Profile.objects.get(user=user).first_name == "Janet"
        assert UserRole.objects.filter(user=user).count() == 1

    def test_an_email_another_account_uses_is_not_copied(self, directory):
        configure()
        dn = directory.add("jdoe")
        session("jdoe")
        _local("taken@studio.test")
        directory.remove(dn)
        directory.add("jdoe", mail="taken@studio.test")

        session("jdoe")

        assert ExternalIdentity.objects.get(subject="uuid-jdoe").user.email == "jdoe@studio.test"

    def test_a_username_given_to_another_entry_does_not_get_the_old_account(self, directory):
        configure()
        dn = directory.add("jdoe", subject="uuid-first")
        session("jdoe")
        directory.remove(dn)
        directory.add("jdoe", subject="uuid-second", mail="second@studio.test")

        assert login("jdoe").status_code == 401
        assert _reason("jdoe") == "ldap_ambiguous"
        assert not User.objects.filter(email="second@studio.test").exists()

    def test_a_deactivated_account_is_refused_even_with_the_right_password(self, directory):
        configure()
        directory.add("jdoe")
        session("jdoe")
        User.objects.filter(email="jdoe@studio.test").update(is_active=False)

        assert login("jdoe").status_code == 401
        assert _reason("jdoe") == "user_inactive"


class TestRefusals:
    def test_a_wrong_password_is_the_generic_failure(self, directory):
        configure()
        directory.add("jdoe")
        session("jdoe")

        response = login("jdoe", "wrong-password")

        assert response.status_code == 401
        unknown = login("nobody-at-all", "x")
        assert response.json()["detail"] == unknown.json()["detail"]
        assert response.json()["error"]["code"] == unknown.json()["error"]["code"]
        attempt = LoginAttempt.objects.filter(username="jdoe", success=False).get()
        assert attempt.reason == "invalid_password"
        assert attempt.user is not None

    def test_the_accounts_email_is_not_a_way_in(self, directory):
        # An identifier that is an account's e-mail takes the local check (ADR-0039 implementation
        # notes); a directory account has no usable local password, so its username is the only way.
        configure()
        directory.add("jdoe")
        session("jdoe")
        binds_before = len(directory.binds)

        response = login("jdoe@studio.test", PASSWORD)

        assert response.status_code == 401
        assert len(directory.binds) == binds_before
        assert _reason("jdoe@studio.test") == "invalid_password"

    def test_an_empty_password_is_refused_before_any_bind(self, directory, monkeypatch):
        configure()
        directory.add("jdoe")
        called = []
        monkeypatch.setattr(DirectoryClient, "find", lambda self, username: called.append(username))

        response = login("jdoe", "")

        assert response.status_code in (400, 401)
        assert called == []
        assert directory.binds == []

    def test_the_client_itself_never_binds_with_an_empty_password(self, directory):
        config = configure()
        directory.add("jdoe")
        from apps.identity.services.directory.configuration import DirectoryConfigurationService

        assert DirectoryConfigurationService.client(config).authenticate("jdoe", "") is None
        assert directory.binds == []

    def test_an_unknown_username_is_the_generic_failure(self, directory):
        configure()

        assert login("ghost").status_code == 401
        assert _reason("ghost") == "unknown_user"

    def test_two_entries_for_one_username_are_refused(self, directory):
        configure()
        directory.add("twin", dn="uid=twin,ou=a,ou=people,dc=studio,dc=test", subject="a")
        directory.add("twin", dn="uid=twin,ou=b,ou=people,dc=studio,dc=test", subject="b")

        assert login("twin").status_code == 401
        assert _reason("twin") == "ldap_ambiguous"
        assert not User.objects.filter(email="twin@studio.test").exists()

    def test_a_filter_injection_matches_nothing(self, directory):
        configure()
        directory.add("jdoe")

        assert login("*)(uid=*", PASSWORD).status_code == 401
        assert login("*", PASSWORD).status_code == 401
        assert not ExternalIdentity.objects.exists()

    def test_the_username_is_escaped_in_the_filter(self):
        config = configure()
        client = DirectoryClient(config, bind_password="x")

        assert client._filter_for("*)(uid=*") == (
            "(&(objectClass=inetOrgPerson)(uid=\\2a\\29\\28uid=\\2a))"
        )


class TestAnOutage:
    def test_it_fails_closed_and_is_logged(self, directory, caplog):
        configure()
        directory.add("jdoe")
        directory.down = True

        with caplog.at_level(logging.WARNING):
            response = login("jdoe")

        assert response.status_code == 401
        assert _reason("jdoe") == "ldap_unavailable"
        assert "directory is unavailable" in caplog.text
        assert PASSWORD not in caplog.text

    def test_it_does_not_count_toward_the_lockout(self, directory):
        configure()
        directory.add("jdoe")
        directory.down = True
        for _ in range(7):
            assert login("jdoe").status_code == 401
        directory.down = False

        assert login("jdoe").status_code == 200

    def test_wrong_passwords_still_lock(self, directory):
        configure()
        directory.add("jdoe")
        for _ in range(5):
            login("jdoe", "wrong")

        assert login("jdoe").status_code in (401, 429)
        assert LoginAttempt.objects.filter(username="jdoe", success=True).count() == 0

    def test_a_local_account_signs_in_while_the_directory_is_down(self, directory):
        configure()
        _local()
        directory.down = True

        assert login("local@studio.test", LOCAL_PASSWORD).status_code == 200

    def test_a_missing_encryption_key_fails_closed(self, directory, settings):
        configure()
        directory.add("jdoe")
        settings.DIRECTORY_ENCRYPTION_KEYS = ()

        assert login("jdoe").status_code == 401
        assert _reason("jdoe") == "ldap_unavailable"


class TestPasswordsStayInTheDirectory:
    def _directory_user(self, directory):
        configure()
        directory.add("jdoe")
        client, _ = session("jdoe")
        return client, User.objects.get(email="jdoe@studio.test")

    def test_change_password_is_refused_with_a_stable_code(self, directory):
        from apps.identity.exceptions.directory import PasswordManagedByDirectory
        from apps.identity.services.password import PasswordService

        _, user = self._directory_user(directory)

        with pytest.raises(PasswordManagedByDirectory):
            PasswordService.change_password(
                user=user, old_password=PASSWORD, new_password="Another-Password-7!"
            )

    def test_the_change_password_endpoint_says_why(self, directory):
        client, _ = self._directory_user(directory)

        response = client.post(
            "/api/v1/auth/change-password/",
            {
                "current_password": PASSWORD,
                "old_password": PASSWORD,
                "new_password": "Another-Password-7!",
            },
            format="json",
        )

        assert response.status_code == 400
        assert "password_managed_by_directory" in response.content.decode()

    def test_a_reset_request_issues_no_token(self, directory):
        from apps.identity.services.password_reset import PasswordResetService

        _, user = self._directory_user(directory)

        assert PasswordResetService.request_reset(email=user.email) is None

    def test_an_administrator_reset_is_refused(self, directory):
        from apps.identity.exceptions.directory import PasswordManagedByDirectory
        from apps.identity.services.user import UserService

        _, user = self._directory_user(directory)

        with pytest.raises(PasswordManagedByDirectory):
            UserService.reset_password(user)

    def test_a_local_account_is_unaffected(self):
        from apps.identity.services.password_reset import PasswordResetService

        user = _local()

        assert PasswordResetService.request_reset(email=user.email) is not None
