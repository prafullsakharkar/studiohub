"""
Core soft delete manager tests.
"""

from __future__ import annotations

import pytest

from apps.core.models.managers.soft_delete import (
    AllObjectsManager,
    DeletedObjectsManager,
    SoftDeleteManager,
)


class TestSoftDeleteManager:
    """Tests for soft delete managers."""

    @pytest.mark.django_db
    def test_soft_delete_manager_exists(self):
        """Test that SoftDeleteManager class exists."""
        assert SoftDeleteManager is not None

    @pytest.mark.django_db
    def test_all_objects_manager_exists(self):
        """Test that AllObjectsManager class exists."""
        assert AllObjectsManager is not None

    @pytest.mark.django_db
    def test_deleted_objects_manager_exists(self):
        """Test that DeletedObjectsManager class exists."""
        assert DeletedObjectsManager is not None
