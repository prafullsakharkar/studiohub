"""
TOTP secret encryption at rest (WP 6.3, DOM-MFA-03).

The stored form is ciphertext; every failure to decrypt fails closed.
"""

from __future__ import annotations

import pytest
from cryptography.fernet import Fernet
from django.core.cache import cache
from django.core.checks import Error, Warning
from django.db import connection
from django.urls import reverse
from rest_framework.test import APIClient

from apps.identity import crypto
from apps.identity.checks import mfa_encryption_key_check
from apps.identity.models import UserMFA, UserSession
from apps.identity.services.mfa import MFAService
from apps.identity.tests.factories import UserFactory
from apps.identity.tests.mfa_helpers import enable_mfa

PASSWORD = "Correct-horse-battery-9!"
SECRET = "JBSWY3DPEHPK3PXP"


@pytest.fixture(autouse=True)
def _clean_cache():
    cache.clear()
    yield
    cache.clear()


def _raw_secret(mfa) -> str:
    with connection.cursor() as cursor:
        cursor.execute("SELECT totp_secret FROM identity_user_mfa WHERE id = %s", [mfa.pk])
        return cursor.fetchone()[0]


def _set_raw(mfa, value: str) -> None:
    with connection.cursor() as cursor:
        cursor.execute(
            "UPDATE identity_user_mfa SET totp_secret = %s WHERE id = %s",
            [value, mfa.pk],
        )


def _mfa(secret: str = ""):
    user = UserFactory.create()
    mfa = UserMFA.objects.create(user=user)
    if secret:
        _set_raw(mfa, secret)
    return mfa


def _login(user):
    return APIClient().post(
        reverse("api:v1:auth-compat:auth-login"),
        {"email": user.email, "password": PASSWORD},
        format="json",
    )


@pytest.mark.django_db
class TestStoredForm:
    def test_the_database_holds_ciphertext_and_python_sees_plaintext(self):
        mfa = _mfa()
        mfa.totp_secret = SECRET
        mfa.save()

        stored = _raw_secret(mfa)

        assert stored.startswith(crypto.PREFIX)
        assert SECRET not in stored
        assert UserMFA.objects.get(pk=mfa.pk).totp_secret == SECRET

    def test_each_write_produces_a_different_ciphertext(self):
        mfa = _mfa()
        mfa.totp_secret = SECRET
        mfa.save()
        first = _raw_secret(mfa)
        mfa.save()

        assert _raw_secret(mfa) != first

    def test_queryset_update_encrypts_too(self):
        mfa = _mfa()

        UserMFA.objects.filter(pk=mfa.pk).update(totp_secret=SECRET)

        assert SECRET not in _raw_secret(mfa)
        assert UserMFA.objects.get(pk=mfa.pk).totp_secret == SECRET

    def test_no_secret_stays_empty(self):
        mfa = _mfa()

        assert _raw_secret(mfa) == ""
        assert UserMFA.objects.get(pk=mfa.pk).totp_secret == ""

    def test_enrollment_stores_only_ciphertext(self):
        user = UserFactory.create()

        mfa = MFAService.enroll(user=user)

        assert mfa.totp_secret and mfa.totp_secret not in _raw_secret(mfa)

    def test_the_stored_form_fits_the_column(self):
        assert len(crypto.encrypt("A" * 64)) < 255


@pytest.mark.django_db
class TestFailsClosed:
    def test_no_key_means_no_enrollment(self, settings):
        settings.MFA_ENCRYPTION_KEYS = ()

        with pytest.raises(crypto.SecretUnavailable):
            MFAService.enroll(user=UserFactory.create())

    def test_no_key_over_http_is_a_503_that_leaks_nothing(self, settings):
        settings.MFA_ENCRYPTION_KEYS = ()
        client = APIClient()
        client.force_authenticate(user=UserFactory.create())

        response = client.get(reverse("api:v1:identity:mfa-totp-setup"))

        assert response.status_code == 503
        assert "key" not in response.content.decode().lower()

    def test_a_malformed_key_is_unusable(self, settings):
        settings.MFA_ENCRYPTION_KEYS = ("not-a-fernet-key",)

        with pytest.raises(crypto.SecretUnavailable):
            crypto.encrypt(SECRET)

    def test_a_plaintext_value_at_rest_is_refused_not_trusted(self):
        mfa = _mfa(SECRET)

        with pytest.raises(crypto.SecretUnavailable):
            UserMFA.objects.get(pk=mfa.pk)

    def test_a_tampered_ciphertext_is_refused(self):
        mfa = _mfa()
        mfa.totp_secret = SECRET
        mfa.save()
        stored = _raw_secret(mfa)
        _set_raw(mfa, stored[:-4] + ("AAAA" if not stored.endswith("AAAA") else "BBBB"))

        with pytest.raises(crypto.SecretUnavailable):
            UserMFA.objects.get(pk=mfa.pk)

    def test_a_different_key_cannot_read_it(self, settings):
        mfa = _mfa()
        mfa.totp_secret = SECRET
        mfa.save()
        settings.MFA_ENCRYPTION_KEYS = (Fernet.generate_key().decode(),)

        with pytest.raises(crypto.SecretUnavailable):
            UserMFA.objects.get(pk=mfa.pk)

    def test_an_account_whose_secret_cannot_be_read_gets_no_session(self, settings):
        user = UserFactory.create(is_email_verified=True)
        user.set_password(PASSWORD)
        user.save(update_fields=["password"])
        enable_mfa(user)
        settings.MFA_ENCRYPTION_KEYS = ()

        response = _login(user)

        assert response.status_code == 503
        assert "tokens" not in response.json()
        assert not UserSession.objects.filter(user=user).exists()

    def test_a_legacy_plaintext_row_cannot_be_used_to_skip_the_factor(self):
        user = UserFactory.create(is_email_verified=True)
        user.set_password(PASSWORD)
        user.save(update_fields=["password"])
        enable_mfa(user)
        _set_raw(UserMFA.objects.get(user=user), SECRET)

        response = _login(user)

        assert response.status_code == 503
        assert not UserSession.objects.filter(user=user).exists()


@pytest.mark.django_db
class TestKeyRotation:
    def test_old_secrets_stay_readable_and_new_writes_use_the_new_key(self, settings):
        old = settings.MFA_ENCRYPTION_KEYS[0]
        new = Fernet.generate_key().decode()
        mfa = _mfa()
        mfa.totp_secret = SECRET
        mfa.save()

        settings.MFA_ENCRYPTION_KEYS = (new, old)

        assert UserMFA.objects.get(pk=mfa.pk).totp_secret == SECRET
        fresh = _mfa()
        fresh.totp_secret = SECRET
        fresh.save()

        settings.MFA_ENCRYPTION_KEYS = (new,)
        assert UserMFA.objects.get(pk=fresh.pk).totp_secret == SECRET
        with pytest.raises(crypto.SecretUnavailable):
            UserMFA.objects.get(pk=mfa.pk)


class TestSystemCheck:
    def test_a_missing_key_is_an_error_outside_debug(self, settings):
        settings.MFA_ENCRYPTION_KEYS = ()
        settings.DEBUG = False

        found = mfa_encryption_key_check(None)

        assert [type(item) for item in found] == [Error]

    def test_a_missing_key_is_a_warning_in_debug(self, settings):
        settings.MFA_ENCRYPTION_KEYS = ()
        settings.DEBUG = True

        assert [type(item) for item in mfa_encryption_key_check(None)] == [Warning]

    def test_an_invalid_key_is_reported(self, settings):
        settings.MFA_ENCRYPTION_KEYS = ("nope",)
        settings.DEBUG = False

        assert [type(item) for item in mfa_encryption_key_check(None)] == [Error]

    def test_a_valid_key_is_clean(self):
        assert mfa_encryption_key_check(None) == []


@pytest.mark.django_db
class TestEncryptionSwitchedOff:
    """MFA_ENCRYPTION_ENABLED=false: an operator choice, default is on."""

    def test_new_secrets_are_stored_as_given(self, settings):
        settings.MFA_ENCRYPTION_ENABLED = False
        mfa = _mfa()
        mfa.totp_secret = SECRET
        mfa.save()

        assert _raw_secret(mfa) == SECRET
        assert UserMFA.objects.get(pk=mfa.pk).totp_secret == SECRET

    def test_no_key_is_needed(self, settings):
        settings.MFA_ENCRYPTION_ENABLED = False
        settings.MFA_ENCRYPTION_KEYS = ()

        mfa = MFAService.enroll(user=UserFactory.create())

        assert mfa.totp_secret and _raw_secret(mfa) == mfa.totp_secret

    def test_mfa_works_end_to_end_without_a_key(self, settings):
        settings.MFA_ENCRYPTION_ENABLED = False
        settings.MFA_ENCRYPTION_KEYS = ()
        user = UserFactory.create(is_email_verified=True)
        user.set_password(PASSWORD)
        user.save(update_fields=["password"])
        enable_mfa(user)

        challenge = _login(user).json()["challenge"]
        from apps.identity.tests.mfa_helpers import valid_code

        done = APIClient().post(
            reverse("api:v1:auth-compat:auth-mfa-challenge"),
            {"challenge": challenge, "code": valid_code(user)},
            format="json",
        )

        assert done.status_code == 200 and done.json()["tokens"]["access"]

    def test_values_encrypted_earlier_stay_readable_while_the_key_is_present(self, settings):
        mfa = _mfa()
        mfa.totp_secret = SECRET
        mfa.save()
        assert _raw_secret(mfa).startswith(crypto.PREFIX)

        settings.MFA_ENCRYPTION_ENABLED = False

        assert UserMFA.objects.get(pk=mfa.pk).totp_secret == SECRET

    def test_encrypted_values_still_fail_closed_without_the_key(self, settings):
        mfa = _mfa()
        mfa.totp_secret = SECRET
        mfa.save()
        settings.MFA_ENCRYPTION_ENABLED = False
        settings.MFA_ENCRYPTION_KEYS = ()

        with pytest.raises(crypto.SecretUnavailable):
            UserMFA.objects.get(pk=mfa.pk)

    def test_the_system_check_warns(self, settings):
        settings.MFA_ENCRYPTION_ENABLED = False
        settings.DEBUG = False

        found = mfa_encryption_key_check(None)

        assert [(type(item), item.id) for item in found] == [(Warning, "identity.W003")]

    def test_switching_back_on_refuses_plaintext_until_it_is_converted(self, settings):
        from django.core.management import call_command

        settings.MFA_ENCRYPTION_ENABLED = False
        mfa = _mfa()
        mfa.totp_secret = SECRET
        mfa.save()

        settings.MFA_ENCRYPTION_ENABLED = True
        with pytest.raises(crypto.SecretUnavailable):
            UserMFA.objects.get(pk=mfa.pk)

        call_command("mfa_encrypt_secrets")

        assert _raw_secret(mfa).startswith(crypto.PREFIX)
        assert UserMFA.objects.get(pk=mfa.pk).totp_secret == SECRET

    def test_the_conversion_command_is_idempotent_and_refuses_while_off(self, settings):
        from django.core.management import CommandError, call_command

        mfa = _mfa()
        mfa.totp_secret = SECRET
        mfa.save()
        before = _raw_secret(mfa)

        call_command("mfa_encrypt_secrets")

        assert _raw_secret(mfa) == before

        settings.MFA_ENCRYPTION_ENABLED = False
        with pytest.raises(CommandError):
            call_command("mfa_encrypt_secrets")
