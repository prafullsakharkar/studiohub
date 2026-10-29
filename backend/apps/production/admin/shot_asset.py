from django.contrib import admin

from apps.core.admin.base import StudioHubModelAdmin
from apps.production.admin.mixins import NoHardDeleteMixin
from apps.production.models import ShotAsset


@admin.register(ShotAsset)
class ShotAssetAdmin(NoHardDeleteMixin, StudioHubModelAdmin):
    list_display = ("shot", "asset", "quantity", "project", "is_deleted")
    list_filter = ("is_deleted",)
    search_fields = ("shot__code", "asset__code")
    autocomplete_fields = ("project", "shot", "asset")
