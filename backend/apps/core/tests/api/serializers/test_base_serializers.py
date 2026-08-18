"""
Core base serializer tests.
"""

from __future__ import annotations

import pytest

from apps.core.api.serializers.base import BaseSerializer


class TestBaseSerializer:
    """Tests for BaseSerializer."""

    @pytest.mark.django_db
    def test_base_serializer_exists(self):
        """Test that BaseSerializer class exists."""
        assert BaseSerializer is not None
