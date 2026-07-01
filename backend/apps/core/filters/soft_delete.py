"""
Soft delete filters.
"""

from __future__ import annotations

import django_filters


class SoftDeleteFilterMixin:
    """
    Filter deleted records.
    """

    is_deleted = django_filters.BooleanFilter()
