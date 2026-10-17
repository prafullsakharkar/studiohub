"""
Masterdata catalog selectors.

Follows StudioHub selector pattern: classmethods with request/view kwargs,
returning QuerySets. Platform-global: no organization scoping.
"""

from __future__ import annotations

from django.db.models import Count, QuerySet

from apps.core.selectors.base import BaseSelector
from apps.masterdata.models import (
    MasterAssetType,
    MasterFileType,
    MasterReviewType,
    MasterShotType,
    MasterStatus,
    MasterTaskType,
    Software,
    SoftwareVersion,
)


class SoftwareSelector(BaseSelector):
    model = Software

    @classmethod
    def get_queryset(cls, *, request=None, view=None) -> QuerySet[Software]:
        return Software.objects.prefetch_related("versions")

    @classmethod
    def annotate_version_count(cls, queryset: QuerySet[Software] | None = None) -> QuerySet[Software]:
        qs = queryset or cls.get_queryset()
        return qs.annotate(version_count=Count("versions", distinct=True))


class SoftwareVersionSelector(BaseSelector):
    model = SoftwareVersion

    @classmethod
    def get_queryset(cls, *, request=None, view=None) -> QuerySet[SoftwareVersion]:
        return SoftwareVersion.objects.select_related("software")

    @classmethod
    def for_software(cls, software_id: str) -> QuerySet[SoftwareVersion]:
        return cls.get_queryset().filter(software_id=software_id)


class MasterStatusSelector(BaseSelector):
    model = MasterStatus

    @classmethod
    def get_queryset(cls, *, request=None, view=None) -> QuerySet[MasterStatus]:
        return MasterStatus.objects.all()

    @classmethod
    def for_entity_type(cls, entity_type: str) -> QuerySet[MasterStatus]:
        return cls.get_queryset().filter(entity_type=entity_type)


class MasterTaskTypeSelector(BaseSelector):
    model = MasterTaskType

    @classmethod
    def get_queryset(cls, *, request=None, view=None) -> QuerySet[MasterTaskType]:
        return MasterTaskType.objects.all()


class MasterAssetTypeSelector(BaseSelector):
    model = MasterAssetType

    @classmethod
    def get_queryset(cls, *, request=None, view=None) -> QuerySet[MasterAssetType]:
        return MasterAssetType.objects.all()


class MasterShotTypeSelector(BaseSelector):
    model = MasterShotType

    @classmethod
    def get_queryset(cls, *, request=None, view=None) -> QuerySet[MasterShotType]:
        return MasterShotType.objects.all()


class MasterReviewTypeSelector(BaseSelector):
    model = MasterReviewType

    @classmethod
    def get_queryset(cls, *, request=None, view=None) -> QuerySet[MasterReviewType]:
        return MasterReviewType.objects.all()


class MasterFileTypeSelector(BaseSelector):
    model = MasterFileType

    @classmethod
    def get_queryset(cls, *, request=None, view=None) -> QuerySet[MasterFileType]:
        return MasterFileType.objects.all()
