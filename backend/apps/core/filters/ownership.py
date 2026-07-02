"""
Ownership filters.
"""

from __future__ import annotations

import django_filters


class OwnershipFilterMixin:

    created_by = django_filters.UUIDFilter()

    updated_by = django_filters.UUIDFilter()
