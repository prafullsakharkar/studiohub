"""
Rotating the Fernet keys that protect TOTP secrets and delivery passcodes (TPN review TM-006).

New key first, old key kept; the rekey commands move every value to the new key; then the old key can
be removed and everything still reads.
"""

from __future__ import annotations

from io import StringIO

import pytest
from cryptography.fernet import Fernet
from django.core.management import call_command
from django.db import connection

from apps.core.security.fernet import PREFIX, FieldCipher
from apps.deliveries import passcode
from apps.deliveries.models import DeliveryPackage
from apps.identity import crypto
from apps.identity.models import UserMFA
from apps.identity.tests.factories import UserFactory

pytestmark = pytest.mark.django_db

SECRET = "JBSWY3DPEHPK3PXP"


def key():
    return Fernet.generate_key().decode()


def run(command, *args):
    out = StringIO()
    call_command(command, *args, stdout=out)
    return out.getvalue().strip()


def raw(table, column, pk):
    with connection.cursor() as cursor:
        cursor.execute(f"SELECT {column} FROM {table} WHERE id = %s", [pk])  # noqa: S608
        return cursor.fetchone()[0]


class TestCipher:
    def make(self, settings, *keys):
        settings.ROTATION_TEST_KEYS = keys
        return FieldCipher(keys_setting="ROTATION_TEST_KEYS", error=ValueError)

    def test_rekey_moves_a_value_to_the_first_key(self, settings):
        old, new = key(), key()
        cipher = self.make(settings, old)
        stored = cipher.encrypt("secret")

        cipher = self.make(settings, new, old)
        assert not cipher.uses_primary_key(stored)
        rekeyed = cipher.rekey(stored)
        assert cipher.uses_primary_key(rekeyed)
        assert rekeyed != stored

        cipher = self.make(settings, new)  # the old key is gone
        assert cipher.decrypt(rekeyed) == "secret"
        with pytest.raises(ValueError):
            cipher.decrypt(stored)

    def test_rekey_refuses_what_is_not_encrypted(self, settings):
        cipher = self.make(settings, key())

        with pytest.raises(ValueError):
            cipher.rekey("plaintext")
        assert not cipher.uses_primary_key("plaintext")
        assert not cipher.uses_primary_key("")


class TestMfaRekey:
    def setup_row(self, settings):
        old, new = key(), key()
        settings.MFA_ENCRYPTION_KEYS = (old,)
        mfa = UserMFA.objects.create(user=UserFactory.create())
        with connection.cursor() as cursor:
            cursor.execute(
                "UPDATE identity_user_mfa SET totp_secret = %s WHERE id = %s",
                [crypto.encrypt(SECRET), mfa.pk],
            )
        settings.MFA_ENCRYPTION_KEYS = (new, old)
        return mfa, old, new

    def test_the_whole_rotation(self, settings):
        mfa, _old, new = self.setup_row(settings)
        before = raw("identity_user_mfa", "totp_secret", mfa.pk)

        assert run("mfa_rekey", "--dry-run") == "would rekey: 1; already current: 0"
        assert raw("identity_user_mfa", "totp_secret", mfa.pk) == before

        assert run("mfa_rekey") == "rekeyed: 1; already current: 0"
        assert raw("identity_user_mfa", "totp_secret", mfa.pk) != before
        assert run("mfa_rekey") == "rekeyed: 0; already current: 1"

        settings.MFA_ENCRYPTION_KEYS = (new,)
        assert UserMFA.objects.get(pk=mfa.pk).totp_secret == SECRET

    def test_plaintext_rows_are_left_alone(self, settings):
        settings.MFA_ENCRYPTION_KEYS = (key(),)
        mfa = UserMFA.objects.create(user=UserFactory.create())
        with connection.cursor() as cursor:
            cursor.execute(
                "UPDATE identity_user_mfa SET totp_secret = %s WHERE id = %s", ["PLAINTEXT", mfa.pk]
            )

        assert run("mfa_rekey") == "rekeyed: 0; already current: 0"
        assert raw("identity_user_mfa", "totp_secret", mfa.pk) == "PLAINTEXT"

    def test_nothing_is_printed_but_counts(self, settings):
        _mfa, old, new = self.setup_row(settings)

        output = run("mfa_rekey")

        assert SECRET not in output and old not in output and new not in output


class TestDeliveryRekey:
    def test_the_whole_rotation(self, settings):
        old, new = key(), key()
        settings.DELIVERY_SECRET_KEYS = (old,)
        package = DeliveryPackage.objects.create(name="D", code="DEL-ROT-1")
        stored = passcode.encrypt("open-sesame")
        DeliveryPackage.objects.filter(pk=package.pk).update(passcode=stored)
        settings.DELIVERY_SECRET_KEYS = (new, old)

        assert run("delivery_rekey", "--dry-run") == "would rekey: 1; already current: 0"
        assert run("delivery_rekey") == "rekeyed: 1; already current: 0"
        assert run("delivery_rekey") == "rekeyed: 0; already current: 1"

        now = raw("deliveries_package", "passcode", package.pk)
        assert now.startswith(PREFIX) and now != stored

        settings.DELIVERY_SECRET_KEYS = (new,)
        assert passcode.decrypt(now) == "open-sesame"

    def test_packages_without_a_passcode_are_skipped(self, settings):
        settings.DELIVERY_SECRET_KEYS = (key(),)
        DeliveryPackage.objects.create(name="D", code="DEL-ROT-2")

        assert run("delivery_rekey") == "rekeyed: 0; already current: 0"
