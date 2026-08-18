from django.contrib import admin

from apps.organization.models import Department


@admin.register(Department)
class DepartmentAdmin(admin.ModelAdmin):
    list_display = (
        "name",
        "code",
        "department_type",
        "organization",
        "created_at",
    )

    list_filter = (
        "department_type",
        "organization",
    )

    search_fields = (
        "name",
        "code",
    )

    readonly_fields = (
        "id",
        "created_at",
        "updated_at",
    )
