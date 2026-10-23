"""
Identity MFA service tests.
"""

from __future__ import annotations

import pytest

from apps.identity.authentication.totp import TOTPService
from apps.identity.models import UserMFA
from apps.identity.services.mfa.facade import MFAService
from apps.identity.tests.factories import UserFactory
from apps.identity.tests.mfa_helpers import enable_mfa, pending_secret, valid_code


class TestMFAService:
    """Tests for MFAService facade."""

    @pytest.mark.django_db
    def test_enroll_mfa_success(self):
        """Test successful MFA enrollment."""
        user = UserFactory.create()

        mfa = MFAService.enroll(
            user=user,
            method="totp",
        )

        assert mfa is not None
        assert mfa.user == user
        assert mfa.totp_secret is not None

    @pytest.mark.django_db
    def test_activate_mfa_success(self):
        """Activation needs a valid code for the pending secret."""
        user = UserFactory.create()
        MFAService.enroll(
            user=user,
            method="totp",
        )

        codes = MFAService.activate(
            user=user,
            code=TOTPService.current_code(pending_secret(user)),
        )

        mfa = UserMFA.objects.get(user=user)
        assert len(codes) == 10
        assert mfa.status == "enabled"
        assert mfa.is_verified is True
        assert mfa.totp_confirmed_at is not None

    @pytest.mark.django_db
    def test_verify_mfa_success(self):
        """A valid code verifies once the account is enabled."""
        user = UserFactory.create()
        enable_mfa(user)

        assert MFAService.verify(user=user, code=valid_code(user)) is True

    @pytest.mark.django_db
    def test_verify_mfa_failure(self):
        """A wrong code does not verify."""
        user = UserFactory.create()
        enable_mfa(user)

        assert MFAService.verify(user=user, code="000000") is False

    @pytest.mark.django_db
    def test_disable_mfa_success(self):
        """Disabling clears the factor."""
        user = UserFactory.create()
        enable_mfa(user)

        result = MFAService.disable(
            user=user,
        )
        assert result is not None
        assert result.status == "disabled"
        assert result.totp_secret == ""

    @pytest.mark.django_db
    def test_generate_backup_codes_success(self):
        """Test successful backup code generation."""
        user = UserFactory.create()
        MFAService.enroll(
            user=user,
            method="totp",
        )

        codes = MFAService.generate_recovery_codes(
            user=user,
        )
        assert len(codes) > 0

    @pytest.mark.django_db
    def test_verify_backup_code_success(self):
        """Test successful backup code verification."""
        user = UserFactory.create()
        MFAService.enroll(
            user=user,
            method="totp",
        )

        codes = MFAService.generate_recovery_codes(
            user=user,
        )

        result = MFAService.consume_recovery_code(
            user=user,
            code=codes[0],
        )
        assert result is True

    @pytest.mark.django_db
    def test_verify_backup_code_failure(self):
        """Test failed backup code verification."""
        user = UserFactory.create()
        MFAService.enroll(
            user=user,
            method="totp",
        )
        MFAService.generate_recovery_codes(
            user=user,
        )

        result = MFAService.consume_recovery_code(
            user=user,
            code="invalid-code",
        )
        assert result is False
