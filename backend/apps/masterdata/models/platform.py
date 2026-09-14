"""
Platform taxonomy models (global admin catalogs).

These are UI-facing taxonomies for the Platform Admin screens, distinct from
the organization RBAC models (Role/Group/Department/Position), which are
organization-scoped with membership junctions. Field names preserve the
frontend contract, including camelCase keys used by the admin tabs.
"""

from __future__ import annotations

from django.db import models
from django.utils.translation import gettext_lazy as _

from apps.core.models.bases import EntityModel


class PlatformRole(EntityModel):
    name = models.CharField(_("Name"), max_length=255, db_index=True)
    code = models.CharField(_("Code"), max_length=100, blank=True, default="", db_index=True)
    description = models.TextField(_("Description"), blank=True, default="")
    badge = models.CharField(_("Badge"), max_length=100, blank=True, default="")
    badge_color = models.CharField(_("Badge color"), max_length=255, blank=True, default="")
    scope = models.CharField(_("Scope"), max_length=50, blank=True, default="")
    permissions = models.JSONField(_("Permissions"), default=list, blank=True)
    user_count = models.PositiveIntegerField(_("User count"), default=0)
    is_system = models.BooleanField(_("Is system"), default=False)

    class Meta:
        db_table = "masterdata_platform_role"
        ordering = ("name",)


class PlatformGroup(EntityModel):
    name = models.CharField(_("Name"), max_length=255, db_index=True)
    code = models.CharField(_("Code"), max_length=100, blank=True, default="", db_index=True)
    description = models.TextField(_("Description"), blank=True, default="")
    member_count = models.PositiveIntegerField(_("Member count"), default=0)
    roles = models.JSONField(_("Roles"), default=list, blank=True)

    class Meta:
        db_table = "masterdata_platform_group"
        ordering = ("name",)


class PlatformDepartment(EntityModel):
    name = models.CharField(_("Name"), max_length=255, db_index=True)
    code = models.CharField(_("Code"), max_length=100, blank=True, default="", db_index=True)
    lead = models.CharField(_("Lead"), max_length=255, blank=True, default="")
    description = models.TextField(_("Description"), blank=True, default="")
    color = models.CharField(_("Color"), max_length=20, blank=True, default="")
    software_stack = models.JSONField(_("Software stack"), default=list, blank=True)
    capacity_hours_weekly = models.PositiveIntegerField(_("Capacity hours weekly"), default=0)
    task_types_count = models.PositiveIntegerField(_("Task types count"), default=0)

    class Meta:
        db_table = "masterdata_platform_department"
        ordering = ("name",)


class PlatformPosition(EntityModel):
    title = models.CharField(_("Title"), max_length=255, db_index=True)
    code = models.CharField(_("Code"), max_length=100, blank=True, default="", db_index=True)
    level = models.CharField(_("Level"), max_length=100, blank=True, default="")
    department = models.CharField(_("Department"), max_length=255, blank=True, default="")
    band_level = models.CharField(_("Band level"), max_length=100, blank=True, default="")
    salary_range = models.CharField(_("Salary range"), max_length=100, blank=True, default="")
    employment_type = models.CharField(_("Employment type"), max_length=100, blank=True, default="")
    status = models.CharField(_("Status"), max_length=50, blank=True, default="")
    description = models.TextField(_("Description"), blank=True, default="")

    class Meta:
        db_table = "masterdata_platform_position"
        ordering = ("title",)
