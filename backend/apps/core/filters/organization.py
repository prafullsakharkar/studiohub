"""
Organization filters.
"""

from __future__ import annotations

import django_filters


class OrganizationFilterMixin:

    organization = django_filters.UUIDFilter()
