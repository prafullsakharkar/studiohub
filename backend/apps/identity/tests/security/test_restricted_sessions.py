"""
Restricted sessions and the password policy (TPN review TM-007).

No ``force_authenticate``: each call carries the token the login returned, because the control lives
in the authenticator. A session that owes an MFA enrollment or a password change can reach only the
endpoints that settle it.
"""

from __future__ import annotations

import pytest
from django.core.cache import cache
from django.core.exceptions import ValidationError
from django.urls import reverse
from rest_framework.test import APIClient

from apps.identity.authentication.totp import TOTPService
from apps.identity.models import PasswordHistory
from apps.identity.services.mfa import MFAPolicyService
from apps.identity.services.password import PasswordService
from apps.identity.tests.factories import UserFactory
from apps.production.models import ProjectMembership
from apps.production.tests.factories import ProjectFactory

PASSWORD = "Correct-horse-battery-9!"

LOGIN = "api:v1:auth-compat:auth-login"
ME = "api:v1:auth-compat:auth-me"
LOGOUT = "api:v1:auth-compat:auth-logout"
CHANGE = "api:v1:auth-compat:auth-change-password"
SETUP = "api:v1:identity:mfa-totp-setup"
ENABLE = "api:v1:identity:mfa-totp-enable"
DATA = "/api/v1/projects/"
OPEN = "/api/v1/identity/users/me/"  # needs no permission code, only a usable session


@pytest.fixture(autouse=True)
def _clean_cache():
    cache.clear()
    yield
    cache.clear()


def _user(**kwargs):
    user = UserFactory.create(is_email_verified=True, **kwargs)
    user.set_password(PASSWORD)
    user.save(update_fields=["password"])
    return user


def _login(user, password=PASSWORD):
    return APIClient().post(
        reverse(LOGIN), {"email": user.email, "password": password}, format="json"
    )


def _session(user):
    """A client carrying the access token a real login returned."""
    response = _login(user)
    assert response.status_code == 200, response.content
    client = APIClient()
    client.credentials(HTTP_AUTHORIZATION=f"Bearer {response.json()['tokens']['access']}")
    return client, response.json()


def _flag(user):
    from apps.identity.models import Profile

    profile, _ = Profile.objects.get_or_create(user=user)
    profile.must_change_password = True
    profile.save(update_fields=["must_change_password"])


def _code(response):
    return response.json().get("code")


@pytest.mark.django_db
class TestMfaEnrollmentIsEnforced:
    def test_a_staff_user_without_mfa_can_only_settle_the_enrollment(self):
        client, body = _session(_user(is_staff=True))

        assert body["mfa_enrollment_required"] is True

        blocked = client.get(DATA)
        assert blocked.status_code == 403
        assert _code(blocked) == "mfa_enrollment_required"

        assert client.get(reverse(ME)).status_code == 200
        assert client.get(reverse(SETUP)).status_code == 200

    def test_completing_the_enrollment_lifts_the_restriction(self):
        client, _ = _session(_user(is_staff=True))
        assert client.get(OPEN).status_code == 403

        secret = client.get(reverse(SETUP)).json()["secret"]
        enabled = client.post(
            reverse(ENABLE), {"code": TOTPService.current_code(secret)}, format="json"
        )
        assert enabled.status_code == 200, enabled.content

        assert client.get(OPEN).status_code == 200

    def test_a_restricted_session_cannot_disable_or_skip_other_endpoints(self):
        client, _ = _session(_user(is_staff=True))

        for url in (
            "/api/v1/identity/users/me/",
            "/api/v1/identity/sessions/",
            "/api/v1/identity/api-keys/",
            "/api/v1/attachments/",
        ):
            response = client.get(url)
            assert response.status_code == 403, url
            assert _code(response) == "mfa_enrollment_required", url

    def test_an_ordinary_user_is_not_restricted(self):
        client, body = _session(_user())

        assert "mfa_enrollment_required" not in body
        assert client.get(OPEN).status_code == 200

    def test_the_policy_can_be_widened_to_every_account(self, monkeypatch):
        monkeypatch.setattr(MFAPolicyService, "REQUIRE_MFA", True)
        client, _ = _session(_user())

        assert client.get(DATA).status_code == 403

    def test_logout_is_always_reachable(self):
        user = _user(is_staff=True)
        client, body = _session(user)

        out = client.post(reverse(LOGOUT), {"refresh": body["tokens"]["refresh"]}, format="json")

        assert out.status_code == 200


@pytest.mark.django_db
class TestExternalMembersNeedMfa:
    def _member(self, **membership):
        user = _user()
        ProjectMembership.objects.create(
            user=user, project=ProjectFactory(), status="active", role="Artist", **membership
        )
        return user

    def test_a_vendor_member_is_restricted_until_mfa_is_enrolled(self):
        client, body = _session(self._member(vendor_id="vendor-a"))

        assert body["mfa_enrollment_required"] is True
        assert client.get(DATA).status_code == 403

    def test_a_client_member_is_restricted_too(self):
        client, _ = _session(self._member(client_id="client-1"))

        assert client.get(DATA).status_code == 403

    def test_an_internal_member_is_not(self):
        client, body = _session(self._member())

        assert "mfa_enrollment_required" not in body
        assert client.get(OPEN).status_code == 200

    def test_a_suspended_vendor_membership_does_not_trigger_it(self):
        user = self._member(vendor_id="vendor-a")
        ProjectMembership.objects.filter(user=user).update(status="suspended")

        client, _ = _session(user)

        assert client.get(OPEN).status_code == 200

    def test_the_external_rule_can_be_switched_off(self, settings):
        settings.MFA_REQUIRE_EXTERNAL = False
        client, _ = _session(self._member(vendor_id="vendor-a"))

        assert client.get(OPEN).status_code == 200


@pytest.mark.django_db
class TestPasswordChangeIsEnforced:
    def _flagged(self):
        user = _user()
        _flag(user)
        return user

    def test_a_flagged_session_can_only_change_the_password(self):
        user = self._flagged()
        client, _ = _session(user)

        blocked = client.get(DATA)
        assert blocked.status_code == 403
        assert _code(blocked) == "password_change_required"
        assert client.get(reverse(ME)).status_code == 200

        changed = client.post(
            reverse(CHANGE),
            {
                "old_password": PASSWORD,
                "new_password": "Another-long-passphrase-7",
                "confirm_password": "Another-long-passphrase-7",
            },
            format="json",
        )
        assert changed.status_code == 200, changed.content

        fresh, body = _session_with(user, "Another-long-passphrase-7")
        assert fresh.get(OPEN).status_code == 200

    def test_an_administrator_reset_forces_the_change_on_the_next_sign_in(self):
        from apps.identity.services.user import UserService

        user = _user()
        old_client, _ = _session(user)
        assert old_client.get(OPEN).status_code == 200

        UserService.reset_password(user, user=None)

        assert old_client.get(OPEN).status_code == 401  # the old session was revoked
        client, _ = _session(user)
        assert client.get(DATA).status_code == 403

    def test_the_password_is_settled_before_the_enrollment(self):
        user = _user(is_staff=True)
        _flag(user)
        client, _ = _session(user)

        assert _code(client.get(DATA)) == "password_change_required"
        assert _code(client.get(reverse(SETUP))) == "password_change_required"


def _session_with(user, password):
    response = _login(user, password)
    assert response.status_code == 200, response.content
    client = APIClient()
    client.credentials(HTTP_AUTHORIZATION=f"Bearer {response.json()['tokens']['access']}")
    return client, response.json()


@pytest.mark.django_db
class TestPasswordPolicy:
    @pytest.mark.parametrize(
        ("candidate", "fragment"),
        [
            ("Short-1aA", "at least 12"),
            ("Abcdefghij1", "at least 12"),
            ("lowercase-only-long-1", "uppercase"),
            ("UPPERCASE-ONLY-LONG-1", "lowercase"),
            ("No-digits-in-this-one", "digit"),
        ],
    )
    def test_weak_passwords_are_refused(self, candidate, fragment):
        user = _user()

        with pytest.raises(ValidationError) as error:
            PasswordService.set_password(user=user, new_password=candidate)

        assert fragment in " ".join(error.value.messages)

    def test_a_password_over_the_maximum_length_is_refused(self):
        with pytest.raises(ValidationError) as error:
            PasswordService.set_password(user=_user(), new_password="Aa1-" + "x" * 130)

        assert "at most 128" in " ".join(error.value.messages)

    def test_a_twelve_character_password_is_accepted(self):
        PasswordService.set_password(user=_user(), new_password="Abcdefghij1k")

    def test_the_current_password_cannot_be_set_again(self):
        user = _user()

        with pytest.raises(ValidationError) as error:
            PasswordService.set_password(user=user, new_password=PASSWORD)

        assert "last 5" in " ".join(error.value.messages)

    def test_earlier_passwords_cannot_come_back_within_the_window(self):
        user = _user()
        sequence = [f"Rotation-passphrase-{n}" for n in range(1, 6)]

        for candidate in sequence:
            PasswordService.set_password(user=user, new_password=candidate)

        # still inside the last five
        with pytest.raises(ValidationError):
            PasswordService.set_password(user=user, new_password=sequence[0])

        # one more rotation pushes the first out of the window
        PasswordService.set_password(user=user, new_password="Rotation-passphrase-6")
        PasswordService.set_password(user=user, new_password=sequence[0])

    def test_only_the_last_few_hashes_are_kept(self):
        user = _user()

        for n in range(9):
            PasswordService.set_password(user=user, new_password=f"Rotation-passphrase-{n}")

        assert PasswordHistory.objects.filter(user=user).count() == 5
        assert all(
            "Rotation" not in row.password_hash for row in PasswordHistory.objects.filter(user=user)
        )

    def test_reuse_is_refused_through_the_api_with_a_400(self):
        user = _user()
        PasswordService.set_password(user=user, new_password="First-long-passphrase-1")
        client, _ = _session_with(user, "First-long-passphrase-1")

        response = client.post(
            reverse(CHANGE),
            {
                "old_password": "First-long-passphrase-1",
                "new_password": "First-long-passphrase-1",
                "confirm_password": "First-long-passphrase-1",
            },
            format="json",
        )

        assert response.status_code == 400
