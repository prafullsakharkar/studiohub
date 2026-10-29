"""
Masterdata services.

Business-logic layer: platform-level statistics for the catalog overview.
"""

from __future__ import annotations

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
    """Counts of live catalog rows. The ``global_`` prefix is kept for the frontend contract."""
    return {
        "global_software_count": SoftwareSelector.get_queryset().count(),
        "global_version_count": SoftwareVersionSelector.get_queryset().count(),
        "global_status_count": MasterStatusSelector.get_queryset().count(),
        "global_task_type_count": MasterTaskTypeSelector.get_queryset().count(),
        "global_asset_type_count": MasterAssetTypeSelector.get_queryset().count(),
        "global_shot_type_count": MasterShotTypeSelector.get_queryset().count(),
        "global_review_type_count": MasterReviewTypeSelector.get_queryset().count(),
        "global_file_type_count": MasterFileTypeSelector.get_queryset().count(),
        "system_health": "healthy",
        "last_definition_update": None,
    }
