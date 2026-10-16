"""
Platform admin module.
"""
from django.contrib import admin

from apps.core.admin.base import PlatformScopedModelAdmin
from apps.platform.models import ProductionReport, StudioNotification


@admin.register(StudioNotification)
class StudioNotificationAdmin(PlatformScopedModelAdmin):
    list_display = ("title", "type", "read", "created_at")
    list_filter = ("type", "read")
    search_fields = ("title", "message")


@admin.register(ProductionReport)
class ProductionReportAdmin(PlatformScopedModelAdmin):
    list_display = ("title", "category", "status", "created_at")
    list_filter = ("category", "status")
    search_fields = ("title", "project_code")
