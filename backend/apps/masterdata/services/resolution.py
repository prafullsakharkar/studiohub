"""
Masterdata services.

Business-logic layer: platform-level statistics for the catalog overview.
The organization-scoped bundle resolvers were deleted with the org removal
plan (org master-data endpoints 404 by absence).
"""

from __future__ import annotations

from apps.masterdata.models import MasterDataScope
from apps.masterdata.selectors.catalog import (
    MasterAssetTypeSelector,
    MasterFileTypeSelector,
    MasterReviewTypeSelector,
    MasterShotTypeSelector,
    MasterStatusSelector,
    MasterTaskTypeSelector,
    SoftwareSelector,
    SoftwareVersionSelector,
)


def get_platform_overview() -> dict[str, object]:
    scope_global = MasterDataScope.GLOBAL
    scope_org = MasterDataScope.ORGANIZATION
    return {
        "global_software_count": SoftwareSelector.get_queryset().filter(scope=scope_global).count(),
        "global_version_count": SoftwareVersionSelector.get_queryset().filter(
            software__scope=scope_global
        ).count(),
        "global_status_count": MasterStatusSelector.get_queryset().filter(scope=scope_global).count(),
        "global_task_type_count": MasterTaskTypeSelector.get_queryset().filter(scope=scope_global).count(),
        "global_asset_type_count": MasterAssetTypeSelector.get_queryset().filter(scope=scope_global).count(),
        "global_shot_type_count": MasterShotTypeSelector.get_queryset().filter(scope=scope_global).count(),
        "global_review_type_count": MasterReviewTypeSelector.get_queryset().filter(scope=scope_global).count(),
        "global_file_type_count": MasterFileTypeSelector.get_queryset().filter(scope=scope_global).count(),
        "total_custom_records_across_orgs": (
            SoftwareSelector.get_queryset().filter(scope=scope_org).count()
            + MasterStatusSelector.get_queryset().filter(scope=scope_org).count()
            + MasterTaskTypeSelector.get_queryset().filter(scope=scope_org).count()
        ),
        "system_health": "healthy",
        "last_definition_update": None,
    }
