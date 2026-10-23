"""
Masterdata catalog selectors.

Follows StudioHub selector pattern: classmethods with request/view kwargs,
returning QuerySets. Platform-global: no organization scoping.
"""

from __future__ import annotations

from typing import Any

from django.db.models import Count, Q, QuerySet

from apps.core.selectors.base import BaseSelector
from apps.masterdata.models import (
    CatalogStatus,
    LookupCatalogModel,
    MasterAssetType,
    MasterFileType,
    MasterReviewType,
    MasterShotType,
    MasterStatus,
    MasterTaskType,
    Software,
    SoftwareVersion,
)


class LookupSelector(BaseSelector):
    """Selector base for the managed lookup catalogs."""

    model: type[LookupCatalogModel]  # pyright: ignore[reportIncompatibleVariableOverride]

    @classmethod
    def with_deleted(cls) -> QuerySet[Any]:
        """Every row, soft-deleted included (restore and hard delete only)."""
        return cls.model.all_objects.all()


class SoftwareSelector(LookupSelector):
    model = Software

    @classmethod
    def get_queryset(cls, *, request=None, view=None) -> QuerySet[Software]:
        return Software.objects.all()

    @classmethod
    def annotate_version_count(cls, queryset: QuerySet[Any]) -> QuerySet[Any]:
        """``version_count`` = live, non-archived versions, in one query."""
        counted = Q(versions__is_deleted=False) & ~Q(versions__status=CatalogStatus.ARCHIVED)
        return queryset.annotate(version_count=Count("versions", filter=counted, distinct=True))


class SoftwareVersionSelector(LookupSelector):
    model = SoftwareVersion

    @classmethod
    def get_queryset(cls, *, request=None, view=None) -> QuerySet[SoftwareVersion]:
        return SoftwareVersion.objects.select_related("software")

    @classmethod
    def for_software(cls, software_id: str) -> QuerySet[SoftwareVersion]:
        return cls.get_queryset().filter(software_id=software_id)


class MasterStatusSelector(LookupSelector):
    model = MasterStatus

    @classmethod
    def get_queryset(cls, *, request=None, view=None) -> QuerySet[MasterStatus]:
        return MasterStatus.objects.all()

    @classmethod
    def for_entity_type(cls, entity_type: str) -> QuerySet[MasterStatus]:
        return cls.get_queryset().filter(entity_type=entity_type)


class MasterTaskTypeSelector(LookupSelector):
    model = MasterTaskType

    @classmethod
    def get_queryset(cls, *, request=None, view=None) -> QuerySet[MasterTaskType]:
        return MasterTaskType.objects.all()


class MasterAssetTypeSelector(LookupSelector):
    model = MasterAssetType

    @classmethod
    def get_queryset(cls, *, request=None, view=None) -> QuerySet[MasterAssetType]:
        return MasterAssetType.objects.all()


class MasterShotTypeSelector(LookupSelector):
    model = MasterShotType

    @classmethod
    def get_queryset(cls, *, request=None, view=None) -> QuerySet[MasterShotType]:
        return MasterShotType.objects.all()


class MasterReviewTypeSelector(LookupSelector):
    model = MasterReviewType

    @classmethod
    def get_queryset(cls, *, request=None, view=None) -> QuerySet[MasterReviewType]:
        return MasterReviewType.objects.all()


class MasterFileTypeSelector(LookupSelector):
    model = MasterFileType

    @classmethod
    def get_queryset(cls, *, request=None, view=None) -> QuerySet[MasterFileType]:
        return MasterFileType.objects.all()
