"""
Core base service tests.
"""

from __future__ import annotations

import pytest

from apps.core.services.base import BaseService


class TestBaseService:
    """Tests for BaseService."""

    @pytest.mark.django_db
    def test_base_service_exists(self):
        """Test that BaseService class exists."""
        assert BaseService is not None
