"""
Core organization manager tests.
"""

from __future__ import annotations

import pytest

from apps.core.models.managers.organization import OrganizationManager


class TestOrganizationManager:
    """Tests for OrganizationManager."""

    @pytest.mark.django_db
    def test_organization_manager_exists(self):
        """Test that OrganizationManager class exists."""
        assert OrganizationManager is not None
