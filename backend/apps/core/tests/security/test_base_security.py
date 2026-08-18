"""
Core base security tests.
"""

from __future__ import annotations

import pytest


class TestBaseSecurity:
    """Tests for base security."""

    @pytest.mark.django_db
    def test_security_test_exists(self):
        """Test that security tests exist."""
        pass
