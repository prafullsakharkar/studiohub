"""
Core tag serializer tests.
"""

from __future__ import annotations

import pytest

from apps.core.api.serializers.tag import TagSerializer


class TestTagSerializer:
    """Tests for TagSerializer."""

    @pytest.mark.django_db
    def test_tag_serializer_exists(self):
        """Test that TagSerializer class exists."""
        assert TagSerializer is not None
