"""
Organization initialization service (ADR-0033 D1, Phase 9).

When an organization is created, provision the enterprise baseline so the
tenant is immediately usable and isolated:

    Global Master Definition
        ↓
    Organization Initialization   ← this module
        ↓
    Organization Configuration    (existing *Config overrides, resolution.py)

Seeded per organization:

- RBAC starter roles + permission grants (canonical DEFAULT_ROLE_SPECS)
- Organization settings row + branding row + default work calendar
- Master-data org configs mirroring enabled global catalog rows
  (statuses, task types, asset types, shot types, review types, file types,
  software) — global definitions are never mutated from a tenant.

Idempotent: safe to call repeatedly (get_or_create semantics everywhere).
"""

from __future__ import annotations

from typing import Any

from django.db import IntegrityError

from apps.organization.constants import DEFAULT_ROLE_SPECS
from apps.organization.models import Permission, Role, RolePermission


class OrganizationInitializationService:
    """Provision a freshly-created organization with its default dataset."""

    # ------------------------------------------------------------------
    # public entry point
    # ------------------------------------------------------------------
    @classmethod
    def initialize(cls, organization) -> dict[str, int]:
        from apps.masterdata.models import (
            MasterAssetType,
            MasterFileType,
            MasterReviewType,
            MasterShotType,
            MasterStatus,
            MasterTaskType,
            Software,
        )
        from apps.organization.models import Branding, OrganizationSettings, WorkCalendar

        created = {
            "roles": 0,
            "role_permissions": 0,
            "settings": 0,
            "branding": 0,
            "work_calendars": 0,
            "master_configs": 0,
        }

        created["roles"], created["role_permissions"] = cls._seed_roles(organization)
        settings_created, settings_model = cls._seed_settings(
            organization, OrganizationSettings
        )
        created["settings"] += settings_created
        created["branding"] += cls._seed_branding(organization, Branding)
        created["work_calendars"] += cls._seed_work_calendar(organization, WorkCalendar)
        created["master_configs"] += cls._seed_master_configs(
            organization,
            status_model=MasterStatus,
            task_type_model=MasterTaskType,
            asset_type_model=MasterAssetType,
            shot_type_model=MasterShotType,
            review_type_model=MasterReviewType,
            file_type_model=MasterFileType,
            software_model=Software,
        )
        return created

    # ------------------------------------------------------------------
    # roles + permission grants (organization domain)
    # ------------------------------------------------------------------
    @classmethod
    def _ensure_permission(cls, code: str) -> Permission:
        module, _, action = code.partition(".")
        try:
            perm, _ = Permission.objects.get_or_create(
                code=code,
                defaults={
                    "name": code,
                    "module": module[:50] or "general",
                    "action": (action[:50] or "view"),
                    "category": "general",
                    "is_system": True,
                    "is_active": True,
                },
            )
        except IntegrityError:
            # concurrent creation — re-read
            perm = Permission.objects.get(code=code)
        return perm

    @classmethod
    def _seed_roles(cls, organization) -> tuple[int, int]:
        roles_created = 0
        grants_created = 0
        for spec in DEFAULT_ROLE_SPECS:
            role, was_created = Role.objects.get_or_create(
                code=spec["code"],
                organization=organization,
                defaults={
                    "name": spec["name"],
                    "description": f"StudioHub default role: {spec['name']}",
                    "role_type": "organization" if spec["scope"] == "organization" else "organization",
                    "scope": spec["scope"],
                    "priority": spec["priority"],
                    "is_system": True,
                    "is_default": spec["code"] == "org-member",
                    "is_active": True,
                },
            )
            if was_created:
                roles_created += 1

            codes = spec["permissions"]
            if codes is None:
                # platform-admin: grant every permission in the catalog
                codes = Permission.objects.filter(is_active=True, is_deleted=False).values_list(
                    "code", flat=True
                )
            for code in codes:
                perm = cls._ensure_permission(code)
                _, grant_created = RolePermission.objects.get_or_create(
                    role=role,
                    permission=perm,
                    defaults={"granted": True},
                )
                if grant_created:
                    grants_created += 1
        return roles_created, grants_created

    # ------------------------------------------------------------------
    # organization-local foundation records
    # ------------------------------------------------------------------
    @classmethod
    def _seed_settings(cls, organization, model) -> tuple[int, Any]:
        # The settings app has its own row; the organization_settings model
        # (organization app) carries org key/value defaults.
        existing = model.objects.filter(organization=organization, is_deleted=False).first()
        if existing:
            return 0, None
        row = model.objects.create(organization=organization)
        return 1, row

    @classmethod
    def _seed_branding(cls, organization, model) -> int:
        existing = model.objects.filter(organization=organization, is_deleted=False).first()
        if existing:
            return 0
        model.objects.create(organization=organization)
        return 1

    @classmethod
    def _seed_work_calendar(cls, organization, model) -> int:
        existing = model.objects.filter(organization=organization, is_deleted=False).first()
        if existing:
            return 0
        model.objects.create(
            organization=organization,
            timezone="UTC",
            working_days=[1, 2, 3, 4, 5],
            is_default=True,
        )
        return 1

    # ------------------------------------------------------------------
    # master-data org configs (init from enabled global catalog rows)
    # ------------------------------------------------------------------
    @classmethod
    def _seed_master_configs(
        cls,
        organization,
        *,
        status_model,
        task_type_model,
        asset_type_model,
        shot_type_model,
        review_type_model,
        file_type_model,
        software_model,
    ) -> int:
        """
        Seed org config rows for every enabled global catalog record so the
        tenant starts with the full default surface enabled — overrides can
        later disable or customize without touching the global catalog.
        """
        from apps.masterdata.models import (
            OrganizationAssetTypeConfig,
            OrganizationFileTypeConfig,
            OrganizationReviewTypeConfig,
            OrganizationShotTypeConfig,
            OrganizationSoftwareConfig,
            OrganizationStatusConfig,
            OrganizationTaskTypeConfig,
        )

        created = 0

        def init_configs(config_model, fk_name, global_model):
            nonlocal created
            existing_ids = set(
                config_model.objects.filter(organization=organization).values_list(
                    f"{fk_name}_id", flat=True
                )
            )
            for row in global_model.objects.filter(status="active"):
                if row.pk in existing_ids:
                    continue
                config_model.objects.create(
                    organization=organization,
                    **{fk_name: row},
                    enabled=True,
                )
                created += 1

        init_configs(OrganizationStatusConfig, "status_item", status_model)
        init_configs(OrganizationTaskTypeConfig, "task_type", task_type_model)
        init_configs(OrganizationAssetTypeConfig, "asset_type", asset_type_model)
        init_configs(OrganizationShotTypeConfig, "shot_type", shot_type_model)
        init_configs(OrganizationReviewTypeConfig, "review_type", review_type_model)
        init_configs(OrganizationFileTypeConfig, "file_type", file_type_model)
        init_configs(OrganizationSoftwareConfig, "software", software_model)
        return created
