"""
Masterdata catalog selectors.

Follows StudioHub selector pattern: classmethods with request/view kwargs,
returning QuerySets scoped to organization where applicable.
"""

from __future__ import annotations

from typing import Any

from django.db.models import Count, Q, QuerySet

from apps.core.selectors.base import BaseSelector
from apps.masterdata.models import (
    MasterAssetType,
    MasterDataScope,
    MasterFileType,
    MasterReviewType,
    MasterShotType,
    MasterStatus,
    MasterTaskType,
    OrganizationAssetTypeConfig,
    OrganizationReviewTypeConfig,
    OrganizationShotTypeConfig,
    OrganizationSoftwareConfig,
    OrganizationStatusConfig,
    OrganizationTaskTypeConfig,
    PlatformDepartment,
    PlatformGroup,
    PlatformPosition,
    PlatformRole,
    Software,
    SoftwareVersion,
)


class SoftwareSelector(BaseSelector):
    model = Software

    @classmethod
    def get_queryset(cls, *, request=None, view=None) -> QuerySet[Software]:
        return Software.objects.select_related("organization").prefetch_related("versions")

    @classmethod
    def annotate_version_count(cls, queryset: QuerySet[Software] | None = None) -> QuerySet[Software]:
        qs = queryset or cls.get_queryset()
        return qs.annotate(version_count=Count("versions", distinct=True))

    @classmethod
    def for_organization(cls, organization: Any) -> QuerySet[Software]:
        return cls.get_queryset().filter(Q(organization=organization) | Q(scope=MasterDataScope.GLOBAL))


class SoftwareVersionSelector(BaseSelector):
    model = SoftwareVersion

    @classmethod
    def get_queryset(cls, *, request=None, view=None) -> QuerySet[SoftwareVersion]:
        return SoftwareVersion.objects.select_related("software", "software__organization")

    @classmethod
    def for_software(cls, software_id: str) -> QuerySet[SoftwareVersion]:
        return cls.get_queryset().filter(software_id=software_id)

    @classmethod
    def for_organization(cls, organization: Any) -> QuerySet[SoftwareVersion]:
        return cls.get_queryset().filter(
            Q(software__organization=organization) | Q(software__scope=MasterDataScope.GLOBAL)
        )


class MasterStatusSelector(BaseSelector):
    model = MasterStatus

    @classmethod
    def get_queryset(cls, *, request=None, view=None) -> QuerySet[MasterStatus]:
        return MasterStatus.objects.select_related("organization")

    @classmethod
    def for_entity_type(cls, entity_type: str) -> QuerySet[MasterStatus]:
        return cls.get_queryset().filter(entity_type=entity_type)

    @classmethod
    def for_organization(cls, organization: Any) -> QuerySet[MasterStatus]:
        return cls.get_queryset().filter(Q(organization=organization) | Q(scope=MasterDataScope.GLOBAL))


class MasterTaskTypeSelector(BaseSelector):
    model = MasterTaskType

    @classmethod
    def get_queryset(cls, *, request=None, view=None) -> QuerySet[MasterTaskType]:
        return MasterTaskType.objects.select_related("organization")

    @classmethod
    def for_organization(cls, organization: Any) -> QuerySet[MasterTaskType]:
        return cls.get_queryset().filter(Q(organization=organization) | Q(scope=MasterDataScope.GLOBAL))


class MasterAssetTypeSelector(BaseSelector):
    model = MasterAssetType

    @classmethod
    def get_queryset(cls, *, request=None, view=None) -> QuerySet[MasterAssetType]:
        return MasterAssetType.objects.select_related("organization")

    @classmethod
    def for_organization(cls, organization: Any) -> QuerySet[MasterAssetType]:
        return cls.get_queryset().filter(Q(organization=organization) | Q(scope=MasterDataScope.GLOBAL))


class MasterShotTypeSelector(BaseSelector):
    model = MasterShotType

    @classmethod
    def get_queryset(cls, *, request=None, view=None) -> QuerySet[MasterShotType]:
        return MasterShotType.objects.select_related("organization")

    @classmethod
    def for_organization(cls, organization: Any) -> QuerySet[MasterShotType]:
        return cls.get_queryset().filter(Q(organization=organization) | Q(scope=MasterDataScope.GLOBAL))


class MasterReviewTypeSelector(BaseSelector):
    model = MasterReviewType

    @classmethod
    def get_queryset(cls, *, request=None, view=None) -> QuerySet[MasterReviewType]:
        return MasterReviewType.objects.select_related("organization")

    @classmethod
    def for_organization(cls, organization: Any) -> QuerySet[MasterReviewType]:
        return cls.get_queryset().filter(Q(organization=organization) | Q(scope=MasterDataScope.GLOBAL))


class MasterFileTypeSelector(BaseSelector):
    model = MasterFileType

    @classmethod
    def get_queryset(cls, *, request=None, view=None) -> QuerySet[MasterFileType]:
        return MasterFileType.objects.select_related("organization")

    @classmethod
    def for_organization(cls, organization: Any) -> QuerySet[MasterFileType]:
        return cls.get_queryset().filter(Q(organization=organization) | Q(scope=MasterDataScope.GLOBAL))


class OrganizationSoftwareConfigSelector(BaseSelector):
    model = OrganizationSoftwareConfig

    @classmethod
    def get_queryset(cls, *, request=None, view=None) -> QuerySet[OrganizationSoftwareConfig]:
        return OrganizationSoftwareConfig.objects.select_related("organization", "software", "default_version")

    @classmethod
    def for_organization(cls, organization: Any) -> QuerySet[OrganizationSoftwareConfig]:
        return cls.get_queryset().filter(organization=organization)


class OrganizationStatusConfigSelector(BaseSelector):
    model = OrganizationStatusConfig

    @classmethod
    def get_queryset(cls, *, request=None, view=None) -> QuerySet[OrganizationStatusConfig]:
        return OrganizationStatusConfig.objects.select_related("organization", "status_item")

    @classmethod
    def for_organization(cls, organization: Any) -> QuerySet[OrganizationStatusConfig]:
        return cls.get_queryset().filter(organization=organization)

    @classmethod
    def for_status(cls, status_id: str) -> QuerySet[OrganizationStatusConfig]:
        return cls.get_queryset().filter(status_item_id=status_id)


class OrganizationTaskTypeConfigSelector(BaseSelector):
    model = OrganizationTaskTypeConfig

    @classmethod
    def get_queryset(cls, *, request=None, view=None) -> QuerySet[OrganizationTaskTypeConfig]:
        return OrganizationTaskTypeConfig.objects.select_related("organization", "task_type")

    @classmethod
    def for_organization(cls, organization: Any) -> QuerySet[OrganizationTaskTypeConfig]:
        return cls.get_queryset().filter(organization=organization)


class OrganizationAssetTypeConfigSelector(BaseSelector):
    model = OrganizationAssetTypeConfig

    @classmethod
    def get_queryset(cls, *, request=None, view=None) -> QuerySet[OrganizationAssetTypeConfig]:
        return OrganizationAssetTypeConfig.objects.select_related("organization", "asset_type")

    @classmethod
    def for_organization(cls, organization: Any) -> QuerySet[OrganizationAssetTypeConfig]:
        return cls.get_queryset().filter(organization=organization)


class OrganizationShotTypeConfigSelector(BaseSelector):
    model = OrganizationShotTypeConfig

    @classmethod
    def get_queryset(cls, *, request=None, view=None) -> QuerySet[OrganizationShotTypeConfig]:
        return OrganizationShotTypeConfig.objects.select_related("organization", "shot_type")

    @classmethod
    def for_organization(cls, organization: Any) -> QuerySet[OrganizationShotTypeConfig]:
        return cls.get_queryset().filter(organization=organization)


class OrganizationReviewTypeConfigSelector(BaseSelector):
    model = OrganizationReviewTypeConfig

    @classmethod
    def get_queryset(cls, *, request=None, view=None) -> QuerySet[OrganizationReviewTypeConfig]:
        return OrganizationReviewTypeConfig.objects.select_related("organization", "review_type")

    @classmethod
    def for_organization(cls, organization: Any) -> QuerySet[OrganizationReviewTypeConfig]:
        return cls.get_queryset().filter(organization=organization)


class PlatformRoleSelector(BaseSelector):
    model = PlatformRole

    @classmethod
    def get_queryset(cls, *, request=None, view=None) -> QuerySet[PlatformRole]:
        # No M2M/FK to prefetch (groups lives as JSON on PlatformGroup). prefetch_related("groups") raised AttributeError once rows existed.
        return PlatformRole.objects.all()

    @classmethod
    def annotate_user_count(cls, queryset: QuerySet[PlatformRole] | None = None) -> QuerySet[PlatformRole]:
        qs = queryset or cls.get_queryset()
        return qs.annotate(user_count=Count("users", distinct=True))


class PlatformGroupSelector(BaseSelector):
    model = PlatformGroup

    @classmethod
    def get_queryset(cls, *, request=None, view=None) -> QuerySet[PlatformGroup]:
        # roles is a JSONField and there is no members relation; prefetch raised ValueError once rows existed.
        return PlatformGroup.objects.all()

    @classmethod
    def annotate_member_count(cls, queryset: QuerySet[PlatformGroup] | None = None) -> QuerySet[PlatformGroup]:
        qs = queryset or cls.get_queryset()
        return qs.annotate(member_count=Count("members", distinct=True))


class PlatformDepartmentSelector(BaseSelector):
    model = PlatformDepartment

    @classmethod
    def get_queryset(cls, *, request=None, view=None) -> QuerySet[PlatformDepartment]:
        return PlatformDepartment.objects.all()

    @classmethod
    def annotate_task_types_count(cls, queryset: QuerySet[PlatformDepartment] | None = None) -> QuerySet[PlatformDepartment]:
        qs = queryset or cls.get_queryset()
        return qs.annotate(task_types_count=Count("task_types", distinct=True))


class PlatformPositionSelector(BaseSelector):
    model = PlatformPosition

    @classmethod
    def get_queryset(cls, *, request=None, view=None) -> QuerySet[PlatformPosition]:
        # department is a CharField (not a FK), so select_related() raises FieldError -> 500.
        return PlatformPosition.objects.all()