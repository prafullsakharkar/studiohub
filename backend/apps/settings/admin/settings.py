from django.contrib import admin

from apps.core.admin.base import PlatformScopedModelAdmin
from apps.settings.models import (
    FeatureFlag,
    Localization,
    SettingCategory,
    SettingDefinition,
    SystemSetting,
    Theme,
)


@admin.register(SettingCategory)
class SettingCategoryAdmin(admin.ModelAdmin):  # pyright: ignore[reportMissingTypeArgument]
    """Admin for SettingCategory."""

    list_display = (
        "code",
        "name",
        "description",
        "icon",
        "order",
        "is_active",
        "created_at",
    )

    list_filter = (
        "is_active",
        "created_at",
    )

    search_fields = (
        "code",
        "name",
        "description",
    )

    readonly_fields = (
        "id",
        "created_at",
        "updated_at",
    )

    date_hierarchy = "created_at"


@admin.register(SettingDefinition)
class SettingDefinitionAdmin(admin.ModelAdmin):  # pyright: ignore[reportMissingTypeArgument]
    """Admin for SettingDefinition."""

    list_display = (
        "code",
        "name",
        "category",
        "data_type",
        "scope",
        "is_required",
        "is_active",
        "created_at",
    )

    list_filter = (
        "data_type",
        "scope",
        "is_required",
        "is_active",
        "created_at",
    )

    search_fields = (
        "code",
        "name",
        "description",
    )

    readonly_fields = (
        "id",
        "created_at",
        "updated_at",
    )

    date_hierarchy = "created_at"


@admin.register(FeatureFlag)
class FeatureFlagAdmin(PlatformScopedModelAdmin):
    """Admin for FeatureFlag."""

    list_display = (
        "code",
        "name",
        "feature_type",
        "status",
        "is_enabled",
        "percentage",
        "created_at",
    )

    list_filter = (
        "feature_type",
        "status",
        "created_at",
    )

    search_fields = (
        "code",
        "name",
        "description",
    )

    readonly_fields = (
        "id",
        "created_at",
        "updated_at",
    )

    date_hierarchy = "created_at"


@admin.register(Localization)
class LocalizationAdmin(PlatformScopedModelAdmin):
    """Admin for Localization."""

    list_display = (
        "language",
        "timezone",
        "date_format",
        "time_format",
        "number_format",
        "created_at",
    )

    list_filter = (
        "language",
        "timezone",
        "date_format",
        "time_format",
        "created_at",
    )

    search_fields = ("code", "name")

    readonly_fields = (
        "id",
        "created_at",
        "updated_at",
    )

    date_hierarchy = "created_at"


@admin.register(SystemSetting)
class SystemSettingAdmin(admin.ModelAdmin):  # pyright: ignore[reportMissingTypeArgument]
    """Admin for SystemSetting."""

    list_display = (
        "setting",
        "is_locked",
        "created_at",
    )

    list_filter = (
        "is_locked",
        "created_at",
    )

    search_fields = ("setting__name",)

    readonly_fields = (
        "id",
        "created_at",
        "updated_at",
    )

    date_hierarchy = "created_at"


@admin.register(Theme)
class ThemeAdmin(PlatformScopedModelAdmin):
    """Admin for Theme."""

    list_display = (
        "code",
        "name",
        "theme_type",
        "primary_color",
        "secondary_color",
        "accent_color",
        "created_at",
    )

    list_filter = (
        "theme_type",
        "created_at",
    )

    search_fields = (
        "code",
        "name",
        "description",
    )

    readonly_fields = (
        "id",
        "created_at",
        "updated_at",
    )

    date_hierarchy = "created_at"
