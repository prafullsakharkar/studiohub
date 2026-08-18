"""
Core base model tests.
"""

from __future__ import annotations

import pytest
from django.core.exceptions import ValidationError

from apps.core.models.base import BaseModel


class TestBaseModel:
    """Tests for BaseModel."""

    @pytest.mark.django_db
    def test_base_model_abstract(self):
        """Test that BaseModel is abstract."""
        assert BaseModel._meta.abstract is True
