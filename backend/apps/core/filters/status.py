"""
Status filters.
"""

from __future__ import annotations

import django_filters


class StatusFilterMixin:
    """
    Filter by status field.
    """

    status = django_filters.CharFilter()
