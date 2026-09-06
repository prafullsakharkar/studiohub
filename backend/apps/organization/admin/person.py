from django.contrib import admin

from apps.core.admin.base import StudioHubModelAdmin
from apps.organization.models import Person


@admin.register(Person)
class PersonAdmin(StudioHubModelAdmin):
    """Person directory entries carry no organization FK: no tenant scoping."""

    list_display = (
        "name",
        "email",
        "status",
        "phone",
        "nationality",
        "created_at",
    )

    list_filter = ("status",)

    search_fields = (
        "name",
        "email",
    )

    ordering = ("name",)
