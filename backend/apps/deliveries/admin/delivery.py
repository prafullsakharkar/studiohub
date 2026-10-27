from django import forms
from django.contrib import admin
from django.db import transaction

from apps.core.admin.base import PlatformScopedModelAdmin
from apps.deliveries.models import (
    DeliveryCounter,
    DeliveryDestination,
    DeliveryItemFile,
    DeliveryPackage,
    DeliveryQCCheck,
    DeliveryStatusChange,
    DeliveryVersionRef,
)
from apps.deliveries.services.destination import clear_other_defaults, name_taken


class ViewOnlyMixin:
    """
    Deliveries, items, the snapshot, QC records, the history and the counter are written by the
    services only: numbering, locks, the transition map, separation of duties and the audit trail
    do not run when a row is edited here. Read them here; change them through the API.
    """

    def has_add_permission(self, request, *args, **kwargs):
        return False

    def has_change_permission(self, request, obj=None):
        return False

    def has_delete_permission(self, request, obj=None):
        return False


class ViewOnlyAdmin(ViewOnlyMixin, admin.ModelAdmin):  # pyright: ignore[reportMissingTypeArgument]
    pass


@admin.register(DeliveryPackage)
class DeliveryPackageAdmin(ViewOnlyMixin, PlatformScopedModelAdmin):
    list_display = (
        "code",
        "name",
        "project",
        "client",
        "status",
        "delivery_method",
        "destination",
        "expires_at",
    )

    list_filter = (
        "status",
        "client_status",
        "delivery_method",
        "is_archived",
    )

    search_fields = (
        "code",
        "name",
    )

    # The passcode is a secret for an external service (DLV-01): never searchable, never in a form.
    exclude = ("passcode",)

    # Read-only (ViewOnlyMixin): the admin would bypass the transition map, separation of duties
    # and the history (DOM-DLV-02). The fields below are listed so none is ever offered as a form
    # input if the mixin is removed by mistake.
    readonly_fields = (
        "code",
        "project",
        "client",
        "destination",
        "delivery_destination",
        "status",
        "client_status",
        "sent_by",
        "sent_at",
        "transfer_reference",
        "qc_run_id",
        "signed_off_by",
        "signed_off_at",
        "client_answered_by",
        "client_answered_at",
        "cancellation_reason",
        "rejection_reason",
        "revision_of",
        "manifest_data",
        "checksums",
        "total_size_bytes",
        "total_frames",
        "is_archived",
    )

    list_select_related = ("project", "client", "destination")

    date_hierarchy = "expires_at"

    ordering = ("-created_at",)


class DeliveryDestinationForm(forms.ModelForm):  # pyright: ignore[reportMissingTypeArgument]
    """Applies the same name rule as the API (any case, among live destinations)."""

    class Meta:
        model = DeliveryDestination
        fields = (
            "name",
            "destination_type",
            "endpoint",
            "credentials_configured",
            "transfer_rate_mbps",
            "storage_region",
            "port",
            "target_directory",
            "is_default",
            "is_active",
        )

    def clean_name(self):
        name = (self.cleaned_data.get("name") or "").strip()
        if name_taken(name, exclude=self.instance.pk):
            raise forms.ValidationError("A destination with this name already exists.")
        return name


@admin.register(DeliveryDestination)
class DeliveryDestinationAdmin(PlatformScopedModelAdmin):
    form = DeliveryDestinationForm

    def save_model(self, request, obj, form, change):
        # Choosing a default moves it, exactly as the API does (DestinationService).
        with transaction.atomic():
            if obj.is_default:
                clear_other_defaults(keep=obj.pk)
            super().save_model(request, obj, form, change)

    list_display = (
        "name",
        "destination_type",
        "storage_region",
        "is_default",
        "is_active",
    )

    list_filter = (
        "destination_type",
        "is_default",
        "is_active",
    )

    search_fields = (
        "name",
        "endpoint",
        "target_directory",
    )

    ordering = ("name",)


@admin.register(DeliveryVersionRef)
class DeliveryVersionRefAdmin(ViewOnlyMixin, PlatformScopedModelAdmin):
    list_display = (
        "version_number",
        "delivery",
        "entity_type",
        "entity_code",
        "is_validated",
        "created_at",
    )

    list_filter = (
        "entity_type",
        "is_validated",
    )

    search_fields = (
        "version_number",
        "entity_code",
        "entity_name",
        "checksum_md5",
    )

    list_select_related = ("delivery", "version")

    ordering = ("-created_at",)


@admin.register(DeliveryItemFile)
class DeliveryItemFileAdmin(ViewOnlyAdmin):
    list_display = ("storage_root_code", "relative_path", "role", "item", "frozen_at")
    list_filter = ("role",)
    search_fields = ("relative_path",)
    list_select_related = ("item",)


@admin.register(DeliveryQCCheck)
class DeliveryQCCheckAdmin(ViewOnlyAdmin):
    list_display = ("delivery", "check_name", "outcome", "checked_at")
    list_filter = ("check_name", "outcome")
    list_select_related = ("delivery",)
    ordering = ("-checked_at",)


@admin.register(DeliveryStatusChange)
class DeliveryStatusChangeAdmin(ViewOnlyAdmin):
    list_display = ("delivery", "from_status", "to_status", "actor", "override_kind", "at")
    list_filter = ("to_status", "override_kind")
    list_select_related = ("delivery", "actor")
    ordering = ("-at",)


@admin.register(DeliveryCounter)
class DeliveryCounterAdmin(ViewOnlyAdmin):
    list_display = ("project_id", "last_number")
