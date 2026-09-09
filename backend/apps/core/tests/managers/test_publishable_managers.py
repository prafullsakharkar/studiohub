"""
Core publishable manager tests.
"""

from __future__ import annotations

import pytest

from apps.core.models.managers.publishable import (
    AllPublishedManager,
    PublishedManager,
)


class TestPublishableManager:
    """Tests for publishable managers."""

    @pytest.mark.django_db
    def test_published_manager_exists(self):
        """Test that PublishedManager class exists."""
        assert PublishedManager is not None

    @pytest.mark.django_db
    def test_all_published_manager_exists(self):
        """Test that AllPublishedManager class exists."""
        assert AllPublishedManager is not None
