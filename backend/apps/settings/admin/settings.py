from django.contrib import admin

from apps.organization.admin.base import OrganizationScopedModelAdmin
from apps.settings.models import (
    FeatureFlag,
    Localization,
    OrganizationSetting,
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
class FeatureFlagAdmin(OrganizationScopedModelAdmin):
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
class LocalizationAdmin(OrganizationScopedModelAdmin):
    """Admin for Localization."""

    list_display = (
        "organization",
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

    search_fields = ("organization__name",)

    readonly_fields = (
        "id",
        "created_at",
        "updated_at",
    )

    date_hierarchy = "created_at"


@admin.register(OrganizationSetting)
class OrganizationSettingAdmin(OrganizationScopedModelAdmin):
    """Admin for OrganizationSetting."""

    list_display = (
        "organization",
        "setting",
        "is_locked",
        "created_at",
    )

    list_filter = (
        "is_locked",
        "created_at",
    )

    search_fields = (
        "organization__name",
        "setting__name",
    )

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
class ThemeAdmin(OrganizationScopedModelAdmin):
    """Admin for Theme."""

    list_display = (
        "code",
        "name",
        "theme_type",
        "organization",
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
