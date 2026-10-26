from django.contrib import admin

from apps.core.admin.base import StudioHubModelAdmin
from apps.production.admin.mixins import NoHardDeleteMixin
from apps.production.models import TaskTemplate, TaskTemplateItem


class TaskTemplateItemInline(admin.TabularInline):  # pyright: ignore[reportMissingTypeArgument]
    model = TaskTemplateItem
    extra = 0
    autocomplete_fields = ("task_type",)


@admin.register(TaskTemplateItem)
class TaskTemplateItemAdmin(NoHardDeleteMixin, StudioHubModelAdmin):
    list_display = ("name", "template", "task_type", "order", "default_bid_hours", "is_deleted")
    list_filter = ("is_deleted",)
    search_fields = ("name", "template__name")
    autocomplete_fields = ("template", "task_type")


@admin.register(TaskTemplate)
class TaskTemplateAdmin(NoHardDeleteMixin, StudioHubModelAdmin):
    list_display = ("name", "entity_type", "project", "is_active", "is_deleted")
    list_filter = ("entity_type", "is_active", "is_deleted")
    search_fields = ("name", "description")
    autocomplete_fields = ("project",)
    inlines = (TaskTemplateItemInline,)
