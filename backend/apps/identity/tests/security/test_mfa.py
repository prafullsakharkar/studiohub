"""
MFA lifecycle, login enforcement, replay, lockout and recovery (WP 6.1-6.7).

Everything goes through the real enrollment flow and the real login
endpoints; nothing writes ``status`` directly to reach ENABLED.
"""

from __future__ import annotations

import threading
from datetime import timedelta

import pytest
from django.core.cache import cache
from django.db import connection
from django.urls import NoReverseMatch, reverse
from django.utils import timezone
from rest_framework.test import APIClient

from apps.identity.authentication.exceptions import MFACodeInvalid
from apps.identity.authentication.totp import TOTPService
from apps.identity.choices import AuthenticationMethod, SecurityEventType
from apps.identity.models import (
    BackupCode,
    LoginHistory,
    SecurityEvent,
    TrustedDevice,
    UserMFA,
    UserSession,
)
from apps.identity.services.mfa import MFAService
from apps.identity.tests.factories import UserFactory
from apps.identity.tests.mfa_helpers import enable_mfa, pending_secret, valid_code

PASSWORD = "Correct-horse-battery-9!"
LOGIN = "api:v1:auth-compat:auth-login"
CHALLENGE = "api:v1:auth-compat:auth-mfa-challenge"
ME = "api:v1:auth-compat:auth-me"
SETUP = "api:v1:identity:mfa-totp-setup"
ENABLE = "api:v1:identity:mfa-totp-enable"
VERIFY = "api:v1:identity:mfa-totp-verify"
DISABLE = "api:v1:identity:mfa-totp-disable"
CONFIG = "api:v1:identity:mfa-config-compat"
CODES = "api:v1:identity:mfa-recovery-codes"
REGENERATE = "api:v1:identity:mfa-recovery-codes-regenerate"
ADMIN_RESET = "api:v1:identity:mfa-admin-reset"


@pytest.fixture(autouse=True)
def _clean_cache():
    cache.clear()
    yield
    cache.clear()


def _user(**extra):
    user = UserFactory.create(is_email_verified=True, **extra)
    user.set_password(PASSWORD)
    user.save(update_fields=["password"])
    return user


def _client(user):
    client = APIClient()
    client.force_authenticate(user=user)
    return client


def _login(user, client=None):
    return (client or APIClient()).post(
        reverse(LOGIN), {"email": user.email, "password": PASSWORD}, format="json"
    )


def _challenge(user):
    response = _login(user)
    assert response.status_code == 200, response.content
    assert response.json()["mfa_required"] is True
    return response.json()["challenge"]


def _complete(challenge, client=None, **body):
    return (client or APIClient()).post(
        reverse(CHALLENGE), {"challenge": challenge, **body}, format="json"
    )


def _events(user, event_type):
    return SecurityEvent.objects.filter(user=user, event_type=event_type)


def _enabled_user(**extra):
    user = _user(**extra)
    codes = enable_mfa(user)
    return user, codes


@pytest.mark.django_db
class TestEnrollmentLifecycle:
    def test_enroll_leaves_the_account_pending_and_unchallenged(self):
        user = _user()

        mfa = MFAService.enroll(user=user)

        assert mfa.status == "pending"
        assert mfa.totp_secret
        assert mfa.requires_challenge is False
        assert _login(user).json().get("mfa_required") is None

    def test_a_wrong_code_does_not_activate(self):
        user = _user()
        MFAService.enroll(user=user)

        with pytest.raises(MFACodeInvalid):
            MFAService.activate(user=user, code="000000")

        assert UserMFA.objects.get(user=user).status == "pending"

    def test_a_valid_code_activates_and_returns_recovery_codes_once(self):
        user = _user()
        MFAService.enroll(user=user)

        codes = MFAService.activate(user=user, code=TOTPService.current_code(pending_secret(user)))

        mfa = UserMFA.objects.get(user=user)
        assert mfa.status == "enabled" and mfa.is_verified
        assert len(codes) == 10
        assert BackupCode.objects.filter(user=user).count() == 10
        assert _events(user, SecurityEventType.MFA_ENABLED).count() == 1

    def test_activation_without_enrollment_is_refused(self):
        from django.core.exceptions import ValidationError

        user = _user()

        with pytest.raises(ValidationError):
            MFAService.activate(user=user, code="123456")

    def test_enrolling_again_cannot_replace_a_live_factor(self):
        from django.core.exceptions import ValidationError

        user, _ = _enabled_user()
        secret = UserMFA.objects.get(user=user).totp_secret

        with pytest.raises(ValidationError):
            MFAService.enroll(user=user)

        mfa = UserMFA.objects.get(user=user)
        assert mfa.status == "enabled" and mfa.totp_secret == secret

    def test_sms_and_email_are_not_offered(self):
        from django.core.exceptions import ValidationError

        with pytest.raises(ValidationError):
            MFAService.enroll(user=_user(), method="sms")

        for name in ("mfa-sms-enable", "mfa-email-enable"):
            with pytest.raises(NoReverseMatch):
                reverse(f"api:v1:identity:{name}")


@pytest.mark.django_db
class TestEnrollmentOverHttp:
    def test_full_flow_over_http(self):
        user = _user()
        client = _client(user)

        setup = client.get(reverse(SETUP)).json()
        code = TOTPService.current_code(setup["secret"])
        enabled = client.post(reverse(ENABLE), {"code": code}, format="json")

        assert enabled.status_code == 200
        assert enabled.json()["enabled"] is True
        assert len(enabled.json()["recovery_codes"]) == 10
        assert UserMFA.objects.get(user=user).status == "enabled"

    def test_a_client_supplied_secret_is_never_trusted(self):
        user = _user()
        client = _client(user)
        client.get(reverse(SETUP))
        attacker_secret = TOTPService.generate_secret()

        response = client.post(
            reverse(ENABLE),
            {"secret": attacker_secret, "code": TOTPService.current_code(attacker_secret)},
            format="json",
        )

        assert response.status_code == 400
        mfa = UserMFA.objects.get(user=user)
        assert mfa.status == "pending" and mfa.totp_secret != attacker_secret

    def test_the_secret_is_not_shown_again(self):
        user, _ = _enabled_user()
        client = _client(user)
        secret = UserMFA.objects.get(user=user).totp_secret

        config = client.get(reverse(CONFIG))
        setup = client.get(reverse(SETUP))

        assert secret not in config.content.decode()
        assert setup.status_code == 400
        assert secret not in setup.content.decode()

    def test_setup_again_while_pending_issues_a_new_secret(self):
        user = _user()
        client = _client(user)

        first = client.get(reverse(SETUP)).json()["secret"]
        second = client.get(reverse(SETUP)).json()["secret"]

        assert first != second
        assert pending_secret(user) == second

    def test_unauthenticated_calls_are_refused(self):
        for name in (SETUP, CONFIG, CODES):
            assert APIClient().get(reverse(name)).status_code in (401, 403)

    def test_the_legacy_tree_answers_over_http(self):
        user = _user()
        client = _client(user)

        enroll = client.post(reverse("api:v1:identity:mfa-enroll"), {}, format="json")

        assert enroll.status_code == 200
        secret = enroll.json()["data"]["secret"]

        verify = client.post(
            reverse("api:v1:identity:mfa-verify"),
            {"code": TOTPService.current_code(secret)},
            format="json",
        )

        assert verify.status_code == 200
        assert len(verify.json()["data"]["recovery_codes"]) == 10
        assert client.get(reverse("api:v1:identity:mfa-recovery")).json()["data"]["remaining"] == 10


@pytest.mark.django_db
class TestLoginEnforcement:
    def test_password_alone_yields_no_tokens_and_no_session(self):
        user, _ = _enabled_user()
        sessions = UserSession.objects.count()
        history = LoginHistory.objects.count()

        response = _login(user)

        body = response.json()
        assert response.status_code == 200
        assert body["mfa_required"] is True and body["challenge"]
        assert "tokens" not in body and "user" not in body
        assert UserSession.objects.count() == sessions
        assert LoginHistory.objects.count() == history

    def test_challenge_plus_a_valid_code_signs_in_with_an_mfa_session(self):
        user, _ = _enabled_user()

        response = _complete(_challenge(user), code=valid_code(user))

        assert response.status_code == 200
        tokens = response.json()["tokens"]
        session = UserSession.objects.get(user=user)
        assert session.authentication_method == AuthenticationMethod.MFA
        me = APIClient()
        me.credentials(HTTP_AUTHORIZATION=f"Bearer {tokens['access']}")
        assert me.get(reverse(ME)).status_code == 200

    def test_a_wrong_code_signs_nobody_in(self):
        user, _ = _enabled_user()

        response = _complete(_challenge(user), code="000000")

        assert response.status_code == 401
        assert not UserSession.objects.filter(user=user).exists()
        assert _events(user, SecurityEventType.MFA_FAILED).count() == 1

    def test_a_challenge_is_single_use(self):
        user, _ = _enabled_user()
        challenge = _challenge(user)
        assert _complete(challenge, code=valid_code(user)).status_code == 200

        again = _complete(challenge, code=valid_code(user))

        assert again.status_code == 401
        assert UserSession.objects.filter(user=user).count() == 1

    def test_a_tampered_challenge_is_rejected(self):
        user, _ = _enabled_user()
        challenge = _challenge(user)

        response = _complete(challenge[:-2] + "xx", code=valid_code(user))

        assert response.status_code == 401
        assert not UserSession.objects.filter(user=user).exists()

    def test_an_expired_challenge_is_rejected(self, monkeypatch):
        user, _ = _enabled_user()
        challenge = _challenge(user)
        monkeypatch.setattr("apps.identity.services.authentication.MFA_CHALLENGE_TTL_SECONDS", -1)

        response = _complete(challenge, code=valid_code(user))

        assert response.status_code == 401

    def test_garbage_challenges_are_rejected_uniformly(self):
        for value in ("", "x", "a:b:c", "A" * 400):
            response = _complete(value or "x", code="123456")
            assert response.status_code in (400, 401)

    def test_the_challenge_is_not_a_bearer_token(self):
        user, _ = _enabled_user()
        client = APIClient()
        client.credentials(HTTP_AUTHORIZATION=f"Bearer {_challenge(user)}")

        assert client.get(reverse(ME)).status_code == 401

    def test_another_users_code_cannot_complete_my_challenge(self):
        victim, _ = _enabled_user()
        attacker, _ = _enabled_user()
        challenge = _challenge(victim)

        response = _complete(challenge, code=valid_code(attacker))

        assert response.status_code == 401
        assert not UserSession.objects.filter(user=victim).exists()

    def test_a_deactivated_account_cannot_finish_a_challenge(self):
        user, _ = _enabled_user()
        challenge = _challenge(user)
        user.is_active = False
        user.save(update_fields=["is_active"])

        assert _complete(challenge, code=valid_code(user)).status_code == 401

    def test_users_without_mfa_log_in_as_before(self):
        user = _user()

        body = _login(user).json()

        assert body["tokens"]["access"] and "mfa_required" not in body

    def test_policy_flags_unenrolled_staff_but_does_not_lock_them_out(self):
        staff = _user(is_staff=True)

        body = _login(staff).json()

        assert body["mfa_enrollment_required"] is True
        assert body["tokens"]["access"]
        assert "mfa_enrollment_required" not in _login(_user()).json()

    def test_a_trusted_device_skips_the_second_factor(self):
        user, _ = _enabled_user()
        client = APIClient()
        done = _complete(
            _challenge(user), client=client, code=valid_code(user), remember_device=True
        )
        assert done.status_code == 200
        assert TrustedDevice.objects.filter(user=user).exists()

        again = _login(user, client=client)

        assert again.json()["tokens"]["access"]

    def test_a_trusted_device_cookie_does_not_work_for_another_user(self):
        owner, _ = _enabled_user()
        other, _ = _enabled_user()
        client = APIClient()
        _complete(_challenge(owner), client=client, code=valid_code(owner), remember_device=True)

        assert _login(other, client=client).json()["mfa_required"] is True


@pytest.mark.django_db
class TestReplayPrevention:
    def test_a_code_can_be_used_once(self):
        user, _ = _enabled_user()
        code = valid_code(user)

        assert MFAService.verify(user=user, code=code) is True
        assert MFAService.verify(user=user, code=code) is False

    def test_an_older_step_is_refused_after_a_newer_one(self):
        user, _ = _enabled_user()
        secret = UserMFA.objects.get(user=user).totp_secret
        now = timezone.now().timestamp()
        UserMFA.objects.filter(user=user).update(last_used_step=None)

        assert MFAService.verify(
            user=user, code=TOTPService.at(secret=secret, timestamp=int(now) + 30)
        )
        assert not MFAService.verify(
            user=user, code=TOTPService.at(secret=secret, timestamp=int(now) - 30)
        )

    def test_the_activation_code_cannot_be_replayed_to_log_in(self):
        user = _user()
        MFAService.enroll(user=user)
        code = TOTPService.current_code(pending_secret(user))
        MFAService.activate(user=user, code=code)

        assert _complete(_challenge(user), code=code).status_code == 401

    def test_matching_step_is_exact_about_the_window(self):
        secret = TOTPService.generate_secret()
        base = 1_700_000_000
        code = TOTPService.at(secret=secret, timestamp=base)

        step = TOTPService.matching_step(secret=secret, code=code, now=base)

        assert step == base // 30
        assert TOTPService.matching_step(secret=secret, code=code, now=base + 30) == step
        assert TOTPService.matching_step(secret=secret, code=code, now=base + 90) is None
        assert TOTPService.matching_step(secret=secret, code="", now=base) is None
        assert TOTPService.matching_step(secret="", code=code, now=base) is None


@pytest.mark.django_db
class TestLockout:
    def test_the_limits_come_from_settings(self, settings):
        from apps.identity.services.mfa.base import BaseMFAService

        assert settings.MFA_MAX_FAILED_ATTEMPTS == 5
        assert settings.MFA_LOCKOUT_MINUTES == 15
        assert BaseMFAService.MAX_FAILED_ATTEMPTS == settings.MFA_MAX_FAILED_ATTEMPTS

    def test_five_failures_lock_and_the_factor_stays_required(self):
        user, _ = _enabled_user()
        challenge = _challenge(user)

        for _ in range(5):
            assert _complete(challenge, code="000000").status_code == 401

        locked = _complete(challenge, code=valid_code(user))

        assert locked.status_code == 429
        mfa = UserMFA.objects.get(user=user)
        assert mfa.status == "enabled"
        assert mfa.locked_until > timezone.now()
        assert _login(user).json()["mfa_required"] is True
        assert _events(user, SecurityEventType.MFA_LOCKED).count() == 1
        assert not UserSession.objects.filter(user=user).exists()

    def test_the_lockout_expires(self):
        user, _ = _enabled_user()
        challenge = _challenge(user)
        for _ in range(5):
            _complete(challenge, code="000000")
        UserMFA.objects.filter(user=user).update(locked_until=timezone.now() - timedelta(seconds=1))

        assert _complete(challenge, code=valid_code(user)).status_code == 200
        assert UserMFA.objects.get(user=user).failed_attempts == 0

    def test_recovery_code_guesses_feed_the_same_counter(self):
        user, _ = _enabled_user()
        challenge = _challenge(user)

        for _ in range(5):
            assert _complete(challenge, recovery_code="AAAA-AAA-AA").status_code == 401

        assert _complete(challenge, code=valid_code(user)).status_code == 429

    def test_a_success_resets_the_counter(self):
        user, _ = _enabled_user()
        for _ in range(3):
            MFAService.verify(user=user, code="000000")

        assert MFAService.verify(user=user, code=valid_code(user))

        assert UserMFA.objects.get(user=user).failed_attempts == 0

    def test_a_legacy_locked_status_row_still_requires_the_factor(self):
        user, _ = _enabled_user()
        UserMFA.objects.filter(user=user).update(status="locked")

        assert _login(user).json()["mfa_required"] is True


@pytest.mark.django_db
class TestRecoveryCodes:
    def test_codes_are_hashed_and_expire(self):
        user, codes = _enabled_user()

        rows = BackupCode.objects.filter(user=user)

        assert rows.count() == 10
        assert all(code not in row.code_hash for row in rows for code in codes)
        assert all(row.expires_at > timezone.now() + timedelta(days=364) for row in rows)

    def test_a_recovery_code_logs_in_once(self):
        user, codes = _enabled_user()

        first = _complete(_challenge(user), recovery_code=codes[0])
        second = _complete(_challenge(user), recovery_code=codes[0])

        assert first.status_code == 200
        assert second.status_code == 401
        assert _events(user, SecurityEventType.MFA_RECOVERY_CODE_USED).count() == 1

    def test_an_expired_code_is_refused(self):
        user, codes = _enabled_user()
        BackupCode.objects.filter(user=user).update(
            expires_at=timezone.now() - timedelta(seconds=1)
        )

        assert _complete(_challenge(user), recovery_code=codes[0]).status_code == 401

    def test_codes_are_case_and_space_tolerant(self):
        user, codes = _enabled_user()

        response = _complete(_challenge(user), recovery_code=f"  {codes[1].lower()} ")

        assert response.status_code == 200

    def test_get_shows_counts_only_and_never_rotates(self):
        user, _ = _enabled_user()
        before = set(BackupCode.objects.filter(user=user).values_list("pk", flat=True))

        first = _client(user).get(reverse(CODES)).json()
        second = _client(user).get(reverse(CODES)).json()

        assert first == {"codes": [], "remaining": 10} == second
        assert before == set(BackupCode.objects.filter(user=user).values_list("pk", flat=True))

    def test_regeneration_needs_reauthentication(self):
        user, codes = _enabled_user()
        client = _client(user)

        no_password = client.post(reverse(REGENERATE), {"code": valid_code(user)}, format="json")
        wrong_password = client.post(
            reverse(REGENERATE), {"password": "nope", "code": valid_code(user)}, format="json"
        )
        wrong_code = client.post(
            reverse(REGENERATE), {"password": PASSWORD, "code": "000000"}, format="json"
        )

        assert no_password.status_code == 400
        assert wrong_password.status_code == 400
        assert wrong_code.status_code == 400
        assert MFAService.consume_recovery_code(user=user, code=codes[0]) is True

    def test_regeneration_replaces_the_set_and_shows_it_once(self):
        user, old = _enabled_user()

        response = _client(user).post(
            reverse(REGENERATE), {"password": PASSWORD, "code": valid_code(user)}, format="json"
        )

        new = response.json()["codes"]
        assert response.status_code == 200 and len(new) == 10
        assert MFAService.consume_recovery_code(user=user, code=old[0]) is False
        assert MFAService.consume_recovery_code(user=user, code=new[0]) is True
        assert _events(user, SecurityEventType.MFA_RECOVERY_CODES_REGENERATED).count() == 2

    def test_regeneration_without_mfa_is_refused(self):
        user = _user()

        response = _client(user).post(reverse(REGENERATE), {"password": PASSWORD}, format="json")

        assert response.status_code == 400
        assert not BackupCode.objects.filter(user=user).exists()


@pytest.mark.django_db(transaction=True)
class TestRecoveryCodeRace:
    def test_two_concurrent_uses_of_one_code_spend_it_once(self):
        user, codes = _enabled_user()
        results: list[bool] = []
        barrier = threading.Barrier(2)

        def attempt():
            try:
                barrier.wait(timeout=10)
                results.append(MFAService.consume_recovery_code(user=user, code=codes[0]))
            finally:
                connection.close()

        threads = [threading.Thread(target=attempt) for _ in range(2)]
        for thread in threads:
            thread.start()
        for thread in threads:
            thread.join(timeout=30)

        assert sorted(results) == [False, True]
        assert BackupCode.objects.filter(user=user, used=True).count() == 1


@pytest.mark.django_db
class TestDisable:
    def _post(self, user, **body):
        return _client(user).post(reverse(DISABLE), body, format="json")

    def test_needs_the_password_and_a_valid_code(self):
        user, _ = _enabled_user()

        assert self._post(user).status_code == 400
        assert self._post(user, password=PASSWORD).status_code == 400
        assert self._post(user, password="nope", code=valid_code(user)).status_code == 400
        assert self._post(user, password=PASSWORD, code="000000").status_code == 400

        assert UserMFA.objects.get(user=user).status == "enabled"

    def test_disabling_discards_everything_that_depended_on_it(self):
        user, _ = _enabled_user()
        MFAService.register_device(user=user, request=_request())

        response = self._post(user, password=PASSWORD, code=valid_code(user))

        assert response.status_code == 200
        mfa = UserMFA.objects.get(user=user)
        assert mfa.status == "disabled" and mfa.totp_secret == ""
        assert not BackupCode.objects.filter(user=user).exists()
        assert not TrustedDevice.objects.filter(user=user, revoked_at__isnull=True).exists()
        assert _events(user, SecurityEventType.MFA_DISABLED).count() == 1
        assert "tokens" in _login(user).json()

    def test_a_recovery_code_can_authorise_disabling(self):
        user, codes = _enabled_user()

        response = self._post(user, password=PASSWORD, recovery_code=codes[0])

        assert response.status_code == 200

    def test_accounts_the_policy_requires_cannot_opt_out(self):
        staff, _ = _enabled_user(is_staff=True)

        response = self._post(staff, password=PASSWORD, code=valid_code(staff))

        assert response.status_code == 403
        assert UserMFA.objects.get(user=staff).status == "enabled"

    def test_a_pending_enrollment_can_be_abandoned_with_the_password(self):
        user = _user()
        MFAService.enroll(user=user)

        response = self._post(user, password=PASSWORD)

        assert response.status_code == 200
        assert UserMFA.objects.get(user=user).status == "disabled"

    def test_repeated_wrong_codes_lock_the_disable_path_too(self):
        user, _ = _enabled_user()

        for _ in range(5):
            self._post(user, password=PASSWORD, code="000000")

        assert self._post(user, password=PASSWORD, code=valid_code(user)).status_code == 429


@pytest.mark.django_db
class TestIsolationAndAdmin:
    def test_verify_only_ever_acts_on_the_caller(self):
        victim, _ = _enabled_user()
        attacker = _user()

        response = _client(attacker).post(
            reverse(VERIFY), {"code": valid_code(victim)}, format="json"
        )

        assert response.status_code == 400
        assert UserMFA.objects.get(user=victim).failed_attempts == 0

    def test_only_a_superuser_can_reset_someone_elses_mfa(self):
        target, _ = _enabled_user()
        staff = _user(is_staff=True)
        root = _user(is_superuser=True)
        url = reverse(ADMIN_RESET, kwargs={"user_id": str(target.pk)})

        denied = _client(staff).post(url)
        assert denied.status_code == 403
        assert UserMFA.objects.get(user=target).status == "enabled"

        allowed = _client(root).post(url)

        assert allowed.status_code == 200
        mfa = UserMFA.objects.get(user=target)
        assert mfa.status == "disabled" and mfa.totp_secret == ""
        assert not BackupCode.objects.filter(user=target).exists()

    def test_resetting_an_unknown_user_is_a_404(self):
        root = _user(is_superuser=True)

        response = _client(root).post(
            reverse(ADMIN_RESET, kwargs={"user_id": "00000000-0000-0000-0000-000000000000"})
        )

        assert response.status_code == 404


@pytest.mark.django_db
class TestAuditTrailHoldsNoSecrets:
    def test_no_code_or_secret_reaches_the_ledger(self):
        user, codes = _enabled_user()
        secret = UserMFA.objects.get(user=user).totp_secret
        code = valid_code(user)
        MFAService.verify(user=user, code="123456")
        _complete(_challenge(user), recovery_code=codes[0])
        MFAService.verify(user=user, code=code)

        blob = " ".join(
            f"{event.description} {event.metadata}"
            for event in SecurityEvent.objects.filter(user=user)
        )

        assert secret not in blob
        assert code not in blob
        assert all(c not in blob for c in codes)


def _request():
    from django.test import RequestFactory

    request = RequestFactory().get("/")
    request.META.update(REMOTE_ADDR="198.51.100.1", HTTP_USER_AGENT="Mozilla/5.0 Chrome/120.0")
    return request


@pytest.mark.django_db
class TestLegacyTreeEnvelopes:
    """The legacy views returned bare dicts (DRF refuses those) and called a
    missing ResponseBuilder method; every path must answer over HTTP."""

    def test_wrong_verify_code_is_a_clean_400(self):
        user, _ = _enabled_user()

        response = _client(user).post(
            reverse("api:v1:identity:mfa-verify"), {"code": "000000"}, format="json"
        )

        assert response.status_code == 400
        assert response.json()["success"] is False

    def test_recovery_verify_and_wrong_code(self):
        user, codes = _enabled_user()
        client = _client(user)
        url = reverse("api:v1:identity:mfa-recovery-verify")

        assert client.post(url, {"code": "AAAA-AAA-AA"}, format="json").status_code == 400
        assert client.post(url, {"code": codes[0]}, format="json").status_code == 200
        assert client.post(url, {"code": codes[0]}, format="json").status_code == 400

    def test_recovery_regeneration_needs_the_password(self):
        user, _ = _enabled_user()
        client = _client(user)
        url = reverse("api:v1:identity:mfa-recovery")

        refused = client.post(url, {"code": valid_code(user)}, format="json")
        allowed = client.post(
            url, {"password": PASSWORD, "code": valid_code(user)}, format="json"
        )

        assert refused.status_code == 400
        assert len(allowed.json()["data"]["codes"]) == 10

    def test_disable_over_the_legacy_tree(self):
        user, _ = _enabled_user()

        response = _client(user).post(
            reverse("api:v1:identity:mfa-disable"),
            {"password": PASSWORD, "code": valid_code(user)},
            format="json",
        )

        assert response.status_code == 200
        assert UserMFA.objects.get(user=user).status == "disabled"

    def test_device_list_is_owner_scoped(self):
        user, _ = _enabled_user()
        other, _ = _enabled_user()
        MFAService.register_device(user=user, request=_request())
        MFAService.register_device(user=other, request=_request())

        response = _client(user).get(reverse("api:v1:identity:trusted-devices"))

        assert response.status_code == 200
        assert len(response.json()["data"]) == 1
