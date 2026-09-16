"""
Platform admin module.
"""
from django.contrib import admin

from apps.platform.models import ProductionReport, StudioNotification


@admin.register(StudioNotification)
class StudioNotificationAdmin(admin.ModelAdmin):
    list_display = ("title", "type", "read", "organization", "created_at")
    list_filter = ("type", "read")
    search_fields = ("title", "message")
    raw_id_fields = ("organization",)


@admin.register(ProductionReport)
class ProductionReportAdmin(admin.ModelAdmin):
    list_display = ("title", "category", "status", "organization", "created_at")
    list_filter = ("category", "status")
    search_fields = ("title", "project_code")
    raw_id_fields = ("organization",)
