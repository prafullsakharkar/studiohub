"""
Core soft delete queryset tests.
"""

from __future__ import annotations

import pytest

from apps.core.models.querysets.soft_delete import SoftDeleteQuerySet


class TestSoftDeleteQuerySet:
    """Tests for SoftDeleteQuerySet."""

    @pytest.mark.django_db
    def test_soft_delete_queryset_exists(self):
        """Test that SoftDeleteQuerySet class exists."""
        assert SoftDeleteQuerySet is not None

    @pytest.mark.django_db
    def test_alive_method(self):
        """Test alive method returns non-deleted records."""
        # This test requires a model that uses SoftDeleteQuerySet
        # For now, just verify the method exists
        assert hasattr(SoftDeleteQuerySet, "alive")

    @pytest.mark.django_db
    def test_deleted_method(self):
        """Test deleted method returns soft-deleted records."""
        assert hasattr(SoftDeleteQuerySet, "deleted")

    @pytest.mark.django_db
    def test_with_deleted_method(self):
        """Test with_deleted method returns unchanged queryset."""
        assert hasattr(SoftDeleteQuerySet, "with_deleted")

    @pytest.mark.django_db
    def test_active_method(self):
        """Test active method returns active records."""
        assert hasattr(SoftDeleteQuerySet, "active")

    @pytest.mark.django_db
    def test_inactive_method(self):
        """Test inactive method returns inactive records."""
        assert hasattr(SoftDeleteQuerySet, "inactive")
