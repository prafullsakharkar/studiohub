"""
Identity security event model tests.
"""

from __future__ import annotations

import pytest

from apps.identity.models.security_event import SecurityEvent


class TestSecurityEventModel:
    """Tests for SecurityEvent model."""

    @pytest.mark.django_db
    def test_create_security_event(self, security_event):
        """Test creating a security event."""
        assert security_event is not None
        assert security_event.user is not None
        assert security_event.event_type is not None
        assert security_event.ip_address is not None

    @pytest.mark.django_db
    def test_security_event_uuid_generation(self, security_event):
        """Test UUID is generated on creation."""
        assert security_event.uuid is not None
        assert len(str(security_event.uuid)) == 36

    @pytest.mark.django_db
    def test_security_event_audit_fields(self, security_event):
        """Test audit fields are present."""
        assert security_event.created_at is not None
        assert security_event.updated_at is not None
        assert security_event.created_by is None
        assert security_event.updated_by is None

    @pytest.mark.django_db
    def test_security_event_soft_delete(self, security_event):
        """Test soft delete functionality."""
        assert security_event.deleted_at is None
        security_event.soft_delete()
        security_event = type(security_event).all_objects.get(pk=security_event.pk)
        assert security_event.deleted_at is not None

    @pytest.mark.django_db
    def test_security_event_event_type_choices(self, security_event):
        """Test event_type field choices."""
        assert security_event.event_type in [
            "login_success",
            "login_failed",
            "login_locked",
            "password_changed",
            "password_reset",
            "mfa_enabled",
            "mfa_disabled",
            "mfa_verified",
            "account_locked",
            "ip_blocked",
        ]

    @pytest.mark.django_db
    def test_security_event_ip_address(self, security_event):
        """Test ip_address field."""
        assert security_event.ip_address is not None

    @pytest.mark.django_db
    def test_security_event_user_agent(self, security_event):
        """Test user_agent field."""
        assert security_event.user_agent is not None

    @pytest.mark.django_db
    def test_security_event_metadata_default(self, security_event):
        """Test metadata field default value."""
        assert security_event.metadata == {}

    @pytest.mark.django_db
    def test_security_event_occurred_at(self, security_event):
        """Test occurred_at field."""
        assert security_event.occurred_at is not None

    @pytest.mark.django_db
    def test_security_event_str_representation(self, security_event):
        """Test string representation."""
        expected = f"{security_event.event_type} for {security_event.user.email}"
        assert str(security_event) == expected

    @pytest.mark.django_db
    def test_security_event_meta_db_table(self, security_event):
        """Test database table name."""
        assert security_event._meta.db_table == "identity_security_events"
