"""Filters for the people list. ``has_user`` narrows it to people with (or without) a linked login (docs/sync CR-57)."""

from __future__ import annotations

import django_filters

from apps.masterdata.models import Person


class PersonFilter(django_filters.FilterSet):
    has_user = django_filters.BooleanFilter(field_name="user", lookup_expr="isnull", exclude=True)

    class Meta:
        model = Person
        fields = ["status", "department", "team", "office", "has_user"]
