"""
Core attachment filterset tests.
"""

from __future__ import annotations

import pytest

from apps.core.api.filtersets.attachment import AttachmentFilterSet


class TestAttachmentFilterSet:
    """Tests for AttachmentFilterSet."""

    @pytest.mark.django_db
    def test_attachment_filterset_exists(self):
        """Test that AttachmentFilterSet class exists."""
        assert AttachmentFilterSet is not None
