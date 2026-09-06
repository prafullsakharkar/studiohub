"""
Shared Django admin base classes.

Domain-neutral only: Core must never import business domains, so
organization-aware behavior lives in
``apps.organization.admin.base`` instead.
"""

from __future__ import annotations

from django.contrib import admin


class StudioHubModelAdmin(admin.ModelAdmin):
    """
    Base admin for all StudioHub models.

    Automatically marks audit/system fields read-only when the model
    defines them, so per-model configs only declare business fields.
    Explicit ``readonly_fields`` on subclasses are preserved.
    """

    #: Audit/system fields treated as read-only whenever present.
    audit_readonly_fields = (
        "id",
        "uuid",
        "created_at",
        "updated_at",
        "is_deleted",
        "deleted_at",
        "created_by",
        "updated_by",
        "deleted_by",
    )

    def get_readonly_fields(self, request, obj=None):
        fields: list = list(super().get_readonly_fields(request, obj))
        available = {f.name for f in self.model._meta.get_fields()}
        for name in self.audit_readonly_fields:
            if name in available and name not in fields:
                fields.append(name)
        return tuple(fields)
