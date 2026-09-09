"""
Core attachment selector tests.
"""

from __future__ import annotations

import pytest

from apps.core.selectors.attachment import AttachmentSelector


class TestAttachmentSelector:
    """Tests for AttachmentSelector."""

    @pytest.mark.django_db
    def test_attachment_selector_exists(self):
        """Test that AttachmentSelector class exists."""
        assert AttachmentSelector is not None
