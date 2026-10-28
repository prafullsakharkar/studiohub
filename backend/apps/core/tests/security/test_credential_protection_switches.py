"""
The switches that weaken stored-secret protection (TPN review TM-019).

Plaintext TOTP seeds and legacy API-key digests are fine in development; a production start refuses
the first and warns about the second, and ``legacy_credentials`` shows what the second still covers.
"""

from __future__ import annotations

from io import StringIO

import pytest
from django.core.management import call_command
from django.test import override_settings

from apps.core import checks
from apps.identity.api_keys.hashing import APIKeyHasher
from apps.identity.models import ApiKey, PersonalAccessToken
from apps.identity.tests.factories import UserFactory


def _ids(findings):
    return sorted(f.id for f in findings)


class TestDeployCheck:
    def test_both_protections_on_is_clean(self):
        with override_settings(MFA_ENCRYPTION_ENABLED=True, API_KEY_ACCEPT_LEGACY_HASH=False):
            assert checks.credential_protection_is_not_weakened(None) == []

    def test_plaintext_totp_secrets_are_an_error(self):
        with override_settings(MFA_ENCRYPTION_ENABLED=False, API_KEY_ACCEPT_LEGACY_HASH=False):
            assert _ids(checks.credential_protection_is_not_weakened(None)) == ["core.E005"]

    def test_accepting_legacy_digests_is_a_warning(self):
        with override_settings(MFA_ENCRYPTION_ENABLED=True, API_KEY_ACCEPT_LEGACY_HASH=True):
            assert _ids(checks.credential_protection_is_not_weakened(None)) == ["core.W005"]


@pytest.mark.django_db
class TestLegacyCredentialsCommand:
    def _credentials(self):
        owner = UserFactory.create(is_active=True)
        old_key = ApiKey.objects.create(
            name="old key",
            prefix="oldk",
            hashed_key=APIKeyHasher.legacy_hash("oldk.secret"),
            created_by=owner,
            scopes=[],
            is_active=True,
        )
        new_key = ApiKey.objects.create(
            name="new key",
            prefix="newk",
            hashed_key=APIKeyHasher.hash("newk.secret"),
            created_by=owner,
            scopes=[],
            is_active=True,
        )
        old_pat = PersonalAccessToken.objects.create(
            user=owner,
            name="old token",
            prefix="oldt",
            hashed_token=APIKeyHasher.legacy_hash("oldt.secret"),
            scopes=[],
            is_active=True,
        )
        return owner, old_key, new_key, old_pat

    def _run(self, *args):
        out = StringIO()
        call_command("legacy_credentials", *args, stdout=out)
        return out.getvalue()

    def test_it_lists_only_live_credentials_on_the_old_digest(self):
        _, old_key, new_key, old_pat = self._credentials()

        output = self._run()

        assert old_key.prefix in output
        assert old_pat.prefix in output
        assert new_key.prefix not in output
        assert "found: 2" in output
        old_key.refresh_from_db()
        assert old_key.is_active is True

    def test_revoke_revokes_them_and_leaves_the_rest(self):
        owner, old_key, new_key, old_pat = self._credentials()

        output = self._run("--revoke")

        assert "revoked: 2" in output
        for credential in (old_key, old_pat, new_key):
            credential.refresh_from_db()
        assert old_key.is_active is False and old_key.revoked_at is not None
        assert old_pat.is_active is False
        assert new_key.is_active is True

        assert "found: 0" in self._run()

    def test_a_revoked_legacy_credential_is_not_listed_again(self):
        self._credentials()
        self._run("--revoke")

        assert "found: 0" in self._run()
