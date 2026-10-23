"""
Validator tests for Audit application.
"""

from __future__ import annotations

from apps.audit.choices.audit_log import AuditAction, AuditSeverity, AuditTarget
from apps.audit.choices.error_log import ErrorSeverity
from apps.audit.validators.audit_log import AuditLogValidator
from apps.audit.validators.error_log import ErrorLogValidator


class TestAuditLogValidator:
    """Tests for AuditLogValidator."""

    def test_valid_action(self) -> None:
        """Valid action passes validation."""
        validator = AuditLogValidator()
        assert validator.validate_action(AuditAction.CREATE) is True

    def test_invalid_action(self) -> None:
        """Invalid action fails validation and records an error."""
        validator = AuditLogValidator()
        assert validator.validate_action("nonsense") is False
        assert "action" in validator.errors

    def test_valid_severity(self) -> None:
        """Valid severity passes validation."""
        validator = AuditLogValidator()
        assert validator.validate_severity(AuditSeverity.INFO) is True

    def test_invalid_severity(self) -> None:
        """Invalid severity fails validation and records an error."""
        validator = AuditLogValidator()
        assert validator.validate_severity("nonsense") is False
        assert "severity" in validator.errors

    def test_valid_target(self) -> None:
        """Valid target passes validation."""
        validator = AuditLogValidator()
        assert validator.validate_target(AuditTarget.PROJECT) is True

    def test_invalid_target(self) -> None:
        """Invalid target fails validation and records an error."""
        validator = AuditLogValidator()
        assert validator.validate_target("nonsense") is False
        assert "target" in validator.errors

    def test_validate_all_valid(self) -> None:
        """validate() returns True when all fields are valid."""
        validator = AuditLogValidator()
        result = validator.validate(
            action=AuditAction.CREATE,
            severity=AuditSeverity.INFO,
            target_type=AuditTarget.PROJECT,
        )
        assert result is True

    def test_validate_with_invalid_field(self) -> None:
        """validate() returns False when any field is invalid."""
        validator = AuditLogValidator()
        result = validator.validate(
            action="nonsense",
            severity=AuditSeverity.INFO,
        )
        assert result is False
        assert "action" in validator.errors


class TestErrorLogValidator:
    """Tests for ErrorLogValidator."""

    def test_valid_severity(self) -> None:
        """Valid severity passes validation."""
        validator = ErrorLogValidator()
        assert validator.validate_severity(ErrorSeverity.ERROR) is True

    def test_invalid_severity(self) -> None:
        """Invalid severity fails validation."""
        validator = ErrorLogValidator()
        assert validator.validate_severity("nonsense") is False
        assert "severity" in validator.errors
