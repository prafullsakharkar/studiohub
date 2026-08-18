"""
Identity known device model tests.
"""

from __future__ import annotations

import pytest

from apps.identity.models.known_device import KnownDevice


class TestKnownDeviceModel:
    """Tests for KnownDevice model."""

    @pytest.mark.django_db
    def test_create_known_device(self, known_device):
        """Test creating a known device."""
        assert known_device is not None
        assert known_device.user is not None
        assert known_device.fingerprint is not None
        assert known_device.device_type is not None

    @pytest.mark.django_db
    def test_known_device_uuid_generation(self, known_device):
        """Test UUID is generated on creation."""
        assert known_device.uuid is not None
        assert len(str(known_device.uuid)) == 36

    @pytest.mark.django_db
    def test_known_device_audit_fields(self, known_device):
        """Test audit fields are present."""
        assert known_device.created_at is not None
        assert known_device.updated_at is not None
        assert known_device.created_by is None
        assert known_device.updated_by is None

    @pytest.mark.django_db
    def test_known_device_soft_delete(self, known_device):
        """Test soft delete functionality."""
        assert known_device.deleted_at is None
        known_device.soft_delete()
        known_device = type(known_device).all_objects.get(pk=known_device.pk)
        assert known_device.deleted_at is not None

    @pytest.mark.django_db
    def test_known_device_unique_constraint(self, known_device):
        """Test unique constraint on user, fingerprint."""
        with pytest.raises(Exception):
            KnownDevice.objects.create(
                user=known_device.user,
                fingerprint=known_device.fingerprint,
            )

    @pytest.mark.django_db
    def test_known_device_first_seen(self, known_device):
        """Test first_seen field."""
        assert known_device.first_seen_at is not None

    @pytest.mark.django_db
    def test_known_device_last_seen(self, known_device):
        """Test last_seen field."""
        assert known_device.last_seen_at is not None

    @pytest.mark.django_db
    def test_known_device_is_trusted_default(self, known_device):
        """Test is_trusted field default value."""
        assert known_device.is_trusted is False

    @pytest.mark.django_db
    def test_known_device_str_representation(self, known_device):
        """Test string representation."""
        expected = f"{known_device.user.email} - {known_device.fingerprint}"
        assert str(known_device) == expected

    @pytest.mark.django_db
    def test_known_device_meta_db_table(self, known_device):
        """Test database table name."""
        assert known_device._meta.db_table == "identity_known_devices"
