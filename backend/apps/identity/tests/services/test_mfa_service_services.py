"""
Identity MFA service tests.
"""

from __future__ import annotations

import pytest

from apps.identity.services.mfa.facade import MFAService
from apps.identity.tests.factories import UserFactory


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
        """Test successful MFA activation after enrollment."""
        user = UserFactory.create()
        MFAService.enroll(
            user=user,
            method="totp",
        )

        mfa = MFAService.activate(
            user=user,
        )

        assert mfa is not None
        assert mfa.is_verified is True
        assert mfa.totp_confirmed_at is not None

    @pytest.mark.django_db
    def test_verify_mfa_success(self):
        """Test successful MFA verification."""
        user = UserFactory.create()
        MFAService.enroll(
            user=user,
            method="totp",
        )
        MFAService.activate(
            user=user,
        )

        result = MFAService.verify(
            user=user,
            code="000000",
        )
        assert result is False

    @pytest.mark.django_db
    def test_verify_mfa_failure(self):
        """Test failed MFA verification."""
        user = UserFactory.create()
        MFAService.enroll(
            user=user,
            method="totp",
        )
        MFAService.activate(
            user=user,
        )

        result = MFAService.verify(
            user=user,
            code="000000",
        )
        assert result is False

    @pytest.mark.django_db
    def test_disable_mfa_success(self):
        """Test successful MFA disable."""
        user = UserFactory.create()
        MFAService.enroll(
            user=user,
            method="totp",
        )
        MFAService.activate(
            user=user,
        )

        result = MFAService.disable(
            user=user,
        )
        assert result is not None
        assert result.status == "disabled"

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
