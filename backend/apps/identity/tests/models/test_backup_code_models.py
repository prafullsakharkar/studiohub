"""
Identity backup code model tests.
"""

from __future__ import annotations

import pytest
from django.db import IntegrityError

from apps.identity.models.backup_code import BackupCode


class TestBackupCodeModel:
    """Tests for BackupCode model."""

    @pytest.mark.django_db
    def test_create_backup_code(self, backup_code):
        """Test creating a backup code."""
        assert backup_code is not None
        assert backup_code.user is not None
        assert backup_code.code_hash is not None

    @pytest.mark.django_db
    def test_backup_code_uuid_generation(self, backup_code):
        """Test UUID is generated on creation."""
        assert backup_code.uuid is not None
        assert len(str(backup_code.uuid)) == 36

    @pytest.mark.django_db
    def test_backup_code_audit_fields(self, backup_code):
        """Test audit fields are present."""
        assert backup_code.created_at is not None
        assert backup_code.updated_at is not None
        assert backup_code.created_by is None
        assert backup_code.updated_by is None

    @pytest.mark.django_db
    def test_backup_code_soft_delete(self, backup_code):
        """Test soft delete functionality."""
        assert backup_code.deleted_at is None
        backup_code.soft_delete()
        backup_code = type(backup_code).all_objects.get(pk=backup_code.pk)
        assert backup_code.deleted_at is not None

    @pytest.mark.django_db
    def test_backup_code_unique_constraint(self, backup_code):
        """Test unique constraint on user, code_hash."""
        with pytest.raises(IntegrityError):
            BackupCode.objects.create(
                user=backup_code.user,
                code_hash=backup_code.code_hash,
            )

    @pytest.mark.django_db
    def test_backup_code_used_default(self, backup_code):
        """Test used field default value."""
        assert backup_code.used is False

    @pytest.mark.django_db
    def test_backup_code_used_at_default(self, backup_code):
        """Test used_at field default value."""
        assert backup_code.used_at is None

    @pytest.mark.django_db
    def test_backup_code_str_representation(self, backup_code):
        """Test string representation."""
        expected = f"Backup code for {backup_code.user.email}"
        assert str(backup_code) == expected

    @pytest.mark.django_db
    def test_backup_code_meta_db_table(self, backup_code):
        """Test database table name."""
        assert backup_code._meta.db_table == "identity_backup_codes"
