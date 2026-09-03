"""
Identity trusted device model tests.
"""

from __future__ import annotations

import pytest
from django.db import IntegrityError

from apps.identity.models.trusted_device import TrustedDevice


class TestTrustedDeviceModel:
    """Tests for TrustedDevice model."""

    @pytest.mark.django_db
    def test_create_trusted_device(self, trusted_device):
        """Test creating a trusted device."""
        assert trusted_device is not None
        assert trusted_device.user is not None
        assert trusted_device.fingerprint is not None
        assert trusted_device.browser is not None

    @pytest.mark.django_db
    def test_trusted_device_uuid_generation(self, trusted_device):
        """Test UUID is generated on creation."""
        assert trusted_device.uuid is not None
        assert len(str(trusted_device.uuid)) == 36

    @pytest.mark.django_db
    def test_trusted_device_audit_fields(self, trusted_device):
        """Test audit fields are present."""
        assert trusted_device.created_at is not None
        assert trusted_device.updated_at is not None
        assert trusted_device.created_by is None
        assert trusted_device.updated_by is None

    @pytest.mark.django_db
    def test_trusted_device_soft_delete(self, trusted_device):
        """Test soft delete functionality."""
        assert trusted_device.deleted_at is None
        trusted_device.soft_delete()
        trusted_device = type(trusted_device).all_objects.get(pk=trusted_device.pk)
        assert trusted_device.deleted_at is not None

    @pytest.mark.django_db
    def test_trusted_device_unique_constraint(self, trusted_device):
        """Test unique constraint on user, fingerprint."""
        with pytest.raises(IntegrityError):
            TrustedDevice.objects.create(
                user=trusted_device.user,
                fingerprint=trusted_device.fingerprint,
                browser="Another Browser",
            )

    @pytest.mark.django_db
    def test_trusted_device_platform(self, trusted_device):
        """Test platform field."""
        assert trusted_device.platform is not None

    @pytest.mark.django_db
    def test_trusted_device_ip_address(self, trusted_device):
        """Test ip_address field."""
        assert trusted_device.ip_address is not None

    @pytest.mark.django_db
    def test_trusted_device_user_agent(self, trusted_device):
        """Test user_agent field."""
        assert trusted_device.user_agent is not None

    @pytest.mark.django_db
    def test_trusted_device_last_login_at(self, trusted_device):
        """Test last_login_at field."""
        assert trusted_device.last_login_at is not None

    @pytest.mark.django_db
    def test_trusted_device_is_trusted_default(self, trusted_device):
        """Test is_trusted field default value."""
        assert trusted_device.is_trusted is True

    @pytest.mark.django_db
    def test_trusted_device_str_representation(self, trusted_device):
        """Test string representation."""
        expected = f"{trusted_device.user.email} - Trusted Device"
        assert str(trusted_device) == expected

    @pytest.mark.django_db
    def test_trusted_device_meta_db_table(self, trusted_device):
        """Test database table name."""
        assert trusted_device._meta.db_table == "identity_trusted_devices"
