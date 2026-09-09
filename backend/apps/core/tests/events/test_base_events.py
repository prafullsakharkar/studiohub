"""
Core base event tests.
"""

from __future__ import annotations

import pytest

from apps.core.events.base import BaseEvent


class TestBaseEvent:
    """Tests for BaseEvent."""

    @pytest.mark.django_db
    def test_base_event_exists(self):
        """Test that BaseEvent class exists."""
        assert BaseEvent is not None
