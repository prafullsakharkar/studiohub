from rest_framework import serializers

from apps.core.api.serializers.base import BaseReadSerializer, BaseWriteSerializer
from apps.organization.models import Client


def _resolve_region(serializer):
    """Resolve the active organization exactly as the person guard does.

    Request organization first; on updates without a request context the
    instance's organization; ``None`` keeps the legacy fail-open behavior.
    """
    region = getattr(serializer.context.get("request"), "organization", None)
    if region is None:
        region = getattr(serializer.instance, "organization", None)
    return region


def validate_organization_ref(serializer, attrs):
    """Reject a submitted organization id outside the active organization."""
    ref = attrs.pop("organization_id", None)
    if ref is None:
        return attrs
    region = _resolve_region(serializer)
    if region is not None and ref != region.id:
        raise serializers.ValidationError({"organization_id": "Unknown record."})
    return attrs


def validate_relation_ref(serializer, attrs, key, model):
    """Reject a submitted relation id owned by another organization.

    Mirrors the person guard: rows are matched by id + ``is_deleted=False``
    and, when an organization context exists, by ownership of it. Without a
    context the legacy fail-open behavior is preserved.
    """
    ref = attrs.pop(key, None)
    if ref is None:
        return attrs
    region = _resolve_region(serializer)
    qs = model.objects.filter(id=ref, is_deleted=False)
    if region is not None:
        qs = qs.filter(organization_id=region.id)
    if not qs.exists():
        raise serializers.ValidationError({key: "Unknown record."})
    return attrs


class ClientSerializer(BaseReadSerializer[Client]):
    organization_id = serializers.UUIDField(read_only=True)

    class Meta:
        model = Client
        fields = (
            "id",
            "uuid",
            "organization_id",
            "name",
            "code",
            "contact_name",
            "email",
            "phone",
            "studio_type",
            "active_projects",
            "contract_tier",
            "portal_access",
            "status",
            "logo_url",
            "headquarters",
            "total_billed_usd",
            "created_at",
            "updated_at",
        )
        read_only_fields = ("id", "uuid", "created_at", "updated_at")


class ClientListSerializer(ClientSerializer):
    pass


class ClientDetailSerializer(ClientSerializer):
    pass


class ClientCreateSerializer(BaseWriteSerializer[Client]):
    id = serializers.UUIDField(read_only=True)
    uuid = serializers.UUIDField(read_only=True)

    # Flat organization id accepted by the client forms; validated in
    # validate() and assigned server-side by the viewset.
    organization_id = serializers.UUIDField(
        required=False, allow_null=True, write_only=True
    )

    def validate(self, attrs):
        return validate_organization_ref(self, attrs)

    class Meta:
        model = Client
        fields = (
            "id",
            "uuid",
            "organization_id",
            "name",
            "code",
            "contact_name",
            "email",
            "phone",
            "studio_type",
            "active_projects",
            "contract_tier",
            "portal_access",
            "status",
            "logo_url",
            "headquarters",
            "total_billed_usd",
        )
        read_only_fields = ("id", "uuid")


class ClientUpdateSerializer(BaseWriteSerializer[Client]):
    organization_id = serializers.UUIDField(
        required=False, allow_null=True, write_only=True
    )

    def validate(self, attrs):
        return validate_organization_ref(self, attrs)

    class Meta:
        model = Client
        fields = (
            "organization_id",
            "name",
            "code",
            "contact_name",
            "email",
            "phone",
            "studio_type",
            "active_projects",
            "contract_tier",
            "portal_access",
            "status",
            "logo_url",
            "headquarters",
            "total_billed_usd",
        )
