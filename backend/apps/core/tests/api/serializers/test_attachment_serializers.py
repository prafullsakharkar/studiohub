"""
Core attachment serializer tests.
"""

from __future__ import annotations

import pytest

from apps.core.api.serializers.attachment import AttachmentSerializer


class TestAttachmentSerializer:
    """Tests for AttachmentSerializer."""

    @pytest.mark.django_db
    def test_attachment_serializer_exists(self):
        """Test that AttachmentSerializer class exists."""
        assert AttachmentSerializer is not None
