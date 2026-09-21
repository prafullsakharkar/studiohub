"""
Masterdata services.

Business-logic layer: resolving effective catalog records per organization
(global + org-scoped overrides), bundle resolution, and platform statistics.

The resolver builds plain dicts that match the effective serializer shapes:
a base serialized record spread with effective override fields merged in.
"""

from __future__ import annotations

from typing import Any

from django.utils import timezone

from apps.masterdata.api.serializers.catalog import (
    MasterAssetTypeSerializer,
    MasterFileTypeSerializer,
    MasterReviewTypeSerializer,
    MasterShotTypeSerializer,
    MasterStatusSerializer,
    MasterTaskTypeSerializer,
    SoftwareSerializer,
    SoftwareVersionSerializer,
)
from apps.masterdata.api.serializers.config import (
    OrganizationAssetTypeConfigSerializer,
    OrganizationReviewTypeConfigSerializer,
    OrganizationShotTypeConfigSerializer,
    OrganizationSoftwareConfigSerializer,
    OrganizationStatusConfigSerializer,
    OrganizationTaskTypeConfigSerializer,
)
from apps.masterdata.models import MasterDataScope
from apps.masterdata.selectors.catalog import (
    MasterAssetTypeSelector,
    MasterFileTypeSelector,
    MasterReviewTypeSelector,
    MasterShotTypeSelector,
    MasterStatusSelector,
    MasterTaskTypeSelector,
    OrganizationAssetTypeConfigSelector,
    OrganizationReviewTypeConfigSelector,
    OrganizationShotTypeConfigSelector,
    OrganizationSoftwareConfigSelector,
    OrganizationStatusConfigSelector,
    OrganizationTaskTypeConfigSelector,
    SoftwareSelector,
    SoftwareVersionSelector,
)

_ORIGIN_GLOBAL = "GLOBAL"
_ORIGIN_ORGANIZATION = "ORGANIZATION"


def _config_data(serializer_class, cfg: Any) -> dict[str, Any] | None:
    return dict(serializer_class(cfg).data) if cfg is not None else None


def _version_data(version: Any) -> dict[str, Any] | None:
    return dict(SoftwareVersionSerializer(version).data) if version is not None else None


def resolve_software_bundle(organization: Any) -> list[dict[str, Any]]:
    records = SoftwareSelector.for_organization(organization)
    configs = OrganizationSoftwareConfigSelector.for_organization(organization).select_related(
        "software", "default_version"
    )
    config_map = {c.software_id: c for c in configs}

    results: list[dict[str, Any]] = []
    for sw in records:
        versions = [
            v for v in SoftwareVersionSelector.for_software(sw.id) if v.status != "archived"
        ]
        cfg = config_map.get(sw.id)
        is_custom = sw.scope != MasterDataScope.GLOBAL
        is_enabled = sw.status != "archived"
        is_overridden = cfg is not None

        display_name = sw.name
        effective_category = sw.category or "general"
        default_version = versions[0] if versions else None
        if cfg is not None:
            display_name = (cfg.display_name_override or sw.name).strip() or sw.name
            effective_category = (cfg.category_override or sw.category or "general").strip()
            if cfg.default_version_id:
                default_version = (
                    next((v for v in versions if v.id == cfg.default_version_id), None)
                    or versions[0]
                    if versions
                    else None
                )

        base = dict(SoftwareSerializer(sw).data)
        base.update({
            "origin": _ORIGIN_GLOBAL if not is_custom else _ORIGIN_ORGANIZATION,
            "is_custom": is_custom,
            "is_enabled": is_enabled,
            "is_overridden": is_overridden,
            "display_name": display_name,
            "effective_category": effective_category,
            "versions": SoftwareVersionSerializer(versions, many=True).data,
            "default_version": _version_data(default_version),
            "config": _config_data(OrganizationSoftwareConfigSerializer, cfg),
            "organization_config": None,
        })
        results.append(base)
    return results


def resolve_status_bundle(organization: Any) -> list[dict[str, Any]]:
    records = [r for r in MasterStatusSelector.for_organization(organization) if r.status != "archived"]
    config_map = {
        c.status_item_id: c
        for c in OrganizationStatusConfigSelector.for_organization(organization)
    }
    results: list[dict[str, Any]] = []
    for r in records:
        cfg = config_map.get(r.id)
        is_custom = r.scope != MasterDataScope.GLOBAL
        is_enabled = True
        is_overridden = cfg is not None
        display_name = (cfg.name_override or r.name).strip() if is_overridden else r.name
        effective_color = (cfg.color_override or r.color).strip() if is_overridden else r.color
        effective_order = cfg.order_override if (is_overridden and cfg.order_override is not None) else r.order

        base = dict(MasterStatusSerializer(r).data)
        base.update({
            "origin": _ORIGIN_GLOBAL if not is_custom else _ORIGIN_ORGANIZATION,
            "is_custom": is_custom,
            "is_enabled": is_enabled,
            "is_overridden": is_overridden,
            "display_name": display_name,
            "effective_color": effective_color,
            "effective_order": effective_order,
            "config": _config_data(OrganizationStatusConfigSerializer, cfg),
            "organization_config": None,
        })
        results.append(base)
    return results


def resolve_task_type_bundle(organization: Any) -> list[dict[str, Any]]:
    records = [r for r in MasterTaskTypeSelector.for_organization(organization) if r.status != "archived"]
    config_map = {
        c.task_type_id: c
        for c in OrganizationTaskTypeConfigSelector.for_organization(organization)
    }
    results: list[dict[str, Any]] = []
    for r in records:
        cfg = config_map.get(r.id)
        is_custom = r.scope != MasterDataScope.GLOBAL
        is_enabled = True
        is_overridden = cfg is not None
        display_name = (cfg.name_override or r.name).strip() if is_overridden else r.name
        effective_color = (cfg.color_override or r.color).strip() if is_overridden else r.color

        base = dict(MasterTaskTypeSerializer(r).data)
        base.update({
            "origin": _ORIGIN_GLOBAL if not is_custom else _ORIGIN_ORGANIZATION,
            "is_custom": is_custom,
            "is_enabled": is_enabled,
            "is_overridden": is_overridden,
            "display_name": display_name,
            "effective_color": effective_color,
            "config": _config_data(OrganizationTaskTypeConfigSerializer, cfg),
            "organization_config": None,
        })
        results.append(base)
    return results


def resolve_asset_type_bundle(organization: Any) -> list[dict[str, Any]]:
    records = [r for r in MasterAssetTypeSelector.for_organization(organization) if r.status != "archived"]
    config_map = {
        c.asset_type_id: c
        for c in OrganizationAssetTypeConfigSelector.for_organization(organization)
    }
    results: list[dict[str, Any]] = []
    for r in records:
        cfg = config_map.get(r.id)
        is_custom = r.scope != MasterDataScope.GLOBAL
        is_enabled = True
        is_overridden = cfg is not None
        display_name = (cfg.name_override or r.name).strip() if is_overridden else r.name

        base = dict(MasterAssetTypeSerializer(r).data)
        base.update({
            "origin": _ORIGIN_GLOBAL if not is_custom else _ORIGIN_ORGANIZATION,
            "is_custom": is_custom,
            "is_enabled": is_enabled,
            "is_overridden": is_overridden,
            "display_name": display_name,
            "config": _config_data(OrganizationAssetTypeConfigSerializer, cfg),
        })
        results.append(base)
    return results


def resolve_shot_type_bundle(organization: Any) -> list[dict[str, Any]]:
    records = [r for r in MasterShotTypeSelector.for_organization(organization) if r.status != "archived"]
    config_map = {
        c.shot_type_id: c
        for c in OrganizationShotTypeConfigSelector.for_organization(organization)
    }
    results: list[dict[str, Any]] = []
    for r in records:
        cfg = config_map.get(r.id)
        is_custom = r.scope != MasterDataScope.GLOBAL
        is_enabled = True
        is_overridden = cfg is not None
        display_name = (cfg.name_override or r.name).strip() if is_overridden else r.name

        base = dict(MasterShotTypeSerializer(r).data)
        base.update({
            "origin": _ORIGIN_GLOBAL if not is_custom else _ORIGIN_ORGANIZATION,
            "is_custom": is_custom,
            "is_enabled": is_enabled,
            "is_overridden": is_overridden,
            "display_name": display_name,
            "config": _config_data(OrganizationShotTypeConfigSerializer, cfg),
        })
        results.append(base)
    return results


def resolve_review_type_bundle(organization: Any) -> list[dict[str, Any]]:
    records = [r for r in MasterReviewTypeSelector.for_organization(organization) if r.status != "archived"]
    config_map = {
        c.review_type_id: c
        for c in OrganizationReviewTypeConfigSelector.for_organization(organization)
    }
    results: list[dict[str, Any]] = []
    for r in records:
        cfg = config_map.get(r.id)
        is_custom = r.scope != MasterDataScope.GLOBAL
        is_enabled = True
        is_overridden = cfg is not None
        display_name = (cfg.name_override or r.name).strip() if is_overridden else r.name

        base = dict(MasterReviewTypeSerializer(r).data)
        base.update({
            "origin": _ORIGIN_GLOBAL if not is_custom else _ORIGIN_ORGANIZATION,
            "is_custom": is_custom,
            "is_enabled": is_enabled,
            "is_overridden": is_overridden,
            "display_name": display_name,
            "config": _config_data(OrganizationReviewTypeConfigSerializer, cfg),
        })
        results.append(base)
    return results


def resolve_file_type_bundle(organization: Any) -> list[dict[str, Any]]:
    records = [r for r in MasterFileTypeSelector.for_organization(organization) if r.status != "archived"]
    results: list[dict[str, Any]] = []
    for r in records:
        is_custom = r.scope != MasterDataScope.GLOBAL
        base = dict(MasterFileTypeSerializer(r).data)
        base.update({
            "origin": _ORIGIN_GLOBAL if not is_custom else _ORIGIN_ORGANIZATION,
            "is_custom": is_custom,
            "is_enabled": True,
            "is_overridden": False,
            "display_name": r.name,
            "config": None,
        })
        results.append(base)
    return results


def resolve_master_bundle(organization: Any) -> dict[str, Any]:
    software = resolve_software_bundle(organization)
    statuses = resolve_status_bundle(organization)
    task_types = resolve_task_type_bundle(organization)
    asset_types = resolve_asset_type_bundle(organization)
    shot_types = resolve_shot_type_bundle(organization)
    review_types = resolve_review_type_bundle(organization)
    file_types = resolve_file_type_bundle(organization)
    total_overrides = (
        OrganizationSoftwareConfigSelector.for_organization(organization).count()
        + OrganizationStatusConfigSelector.for_organization(organization).count()
        + OrganizationTaskTypeConfigSelector.for_organization(organization).count()
        + OrganizationAssetTypeConfigSelector.for_organization(organization).count()
        + OrganizationShotTypeConfigSelector.for_organization(organization).count()
        + OrganizationReviewTypeConfigSelector.for_organization(organization).count()
    )
    stats = {
        "total_software": len(software),
        "enabled_software": sum(1 for s in software if s["is_enabled"]),
        "custom_software": sum(1 for s in software if s["is_custom"]),
        "total_statuses": len(statuses),
        "enabled_statuses": sum(1 for s in statuses if s["is_enabled"]),
        "custom_statuses": sum(1 for s in statuses if s["is_custom"]),
        "total_task_types": len(task_types),
        "enabled_task_types": sum(1 for t in task_types if t["is_enabled"]),
        "custom_task_types": sum(1 for t in task_types if t["is_custom"]),
        "total_overrides_applied": total_overrides,
    }
    return {
        "organization_id": str(organization.id),
        "resolved_at": timezone.now().isoformat(),
        "software": software,
        "statuses": statuses,
        "task_types": task_types,
        "asset_types": asset_types,
        "shot_types": shot_types,
        "review_types": review_types,
        "file_types": file_types,
        "stats": stats,
    }


def get_platform_overview() -> dict[str, Any]:
    from apps.organization.models import Organization

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
        "active_organizations_count": Organization.objects.filter(status="active").count(),
        "total_custom_records_across_orgs": (
            SoftwareSelector.get_queryset().filter(scope=scope_org).count()
            + MasterStatusSelector.get_queryset().filter(scope=scope_org).count()
            + MasterTaskTypeSelector.get_queryset().filter(scope=scope_org).count()
        ),
        "system_health": "healthy",
        "last_definition_update": None,
    }
