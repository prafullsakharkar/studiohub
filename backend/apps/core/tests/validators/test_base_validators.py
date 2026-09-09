"""
Core base validator tests.
"""

from __future__ import annotations

import pytest

from apps.core.validators.base import BaseValidator


class TestBaseValidator:
    """Tests for BaseValidator."""

    @pytest.mark.django_db
    def test_base_validator_exists(self):
        """Test that BaseValidator class exists."""
        assert BaseValidator is not None
