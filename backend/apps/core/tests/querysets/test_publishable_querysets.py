"""
Core publishable queryset tests.
"""

from __future__ import annotations

import pytest

from apps.core.models.querysets.mixins.publishable import PublishableQuerySetMixin


class TestPublishableQuerySetMixin:
    """Tests for PublishableQuerySetMixin."""

    @pytest.mark.django_db
    def test_publishable_mixin_exists(self):
        """Test that PublishableQuerySetMixin class exists."""
        assert PublishableQuerySetMixin is not None
