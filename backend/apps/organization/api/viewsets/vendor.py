from django.http import Http404
from django.shortcuts import get_object_or_404
from rest_framework.decorators import action
from rest_framework.response import Response

from apps.core.api.pagination import StandardPagination
from apps.core.api.viewsets import ServiceModelViewSet
from apps.core.permissions.base import IsAuthenticatedPermission
from apps.identity.permissions import HasPermission
from apps.organization.api.serializers.vendor import (
    VendorCreateSerializer,
    VendorDetailSerializer,
    VendorListSerializer,
    VendorUpdateSerializer,
)
from apps.organization.api.viewsets.context import OrganizationContextMixin
from apps.organization.constants.permissions import OrganizationPermissions
from apps.organization.models import Vendor


class VendorViewSet(
    OrganizationContextMixin,
    ServiceModelViewSet,  # pyright: ignore[reportMissingTypeArgument]
):
    queryset = Vendor.objects.all()
    serializer_map = {
        "list": VendorListSerializer,
        "retrieve": VendorDetailSerializer,
        "create": VendorCreateSerializer,
        "update": VendorUpdateSerializer,
        "partial_update": VendorUpdateSerializer,
    }
    permission_classes = (IsAuthenticatedPermission, HasPermission)
    permission_map = {
        "list": (OrganizationPermissions.VIEW,),
        "retrieve": (OrganizationPermissions.VIEW,),
        "create": (OrganizationPermissions.CREATE,),
        "update": (OrganizationPermissions.UPDATE,),
        "partial_update": (OrganizationPermissions.UPDATE,),
        "destroy": (OrganizationPermissions.DELETE,),
        "restore": (OrganizationPermissions.UPDATE,),
    }
    pagination_class = StandardPagination
    search_fields = ("name", "code", "contact_name")
    filterset_fields = ("status", "specialization")
    ordering_fields = ("name", "code", "created_at")

    def get_queryset(self):
        qs = Vendor.objects.select_related("organization").all()
        # Scope by the resolved organization context (header or nested URL,
        # resolved post-authentication by OrganizationContextMixin). The raw
        # header is never trusted directly, and a missing context fails
        # closed instead of returning unscoped rows.
        org = getattr(self.request, "organization", None)
        if org is None:
            return qs.none()
        return qs.filter(organization=org)

    def perform_create(self, serializer):
        from rest_framework.exceptions import ValidationError

        org = getattr(self.request, "organization", None)
        if org is None:
            # Fail closed: never assign to an arbitrary organization (the
            # previous Organization.objects.first() fallback).
            raise ValidationError({"organization": "An active organization is required."})
        serializer.save(organization=org)

    def perform_destroy(self, instance):
        # This legacy viewset defines no service_class, so the service
        # mixin cannot soft-delete — invoke the model helper directly.
        instance.soft_delete(user=getattr(self.request, "user", None))

    @action(detail=True, methods=["post"], url_path="restore")
    def restore(self, request, *args, **kwargs):
        """Recover a soft-deleted vendor."""
        lookup_value = self.kwargs.get(self.lookup_url_kwarg or self.lookup_field)
        org = getattr(request, "organization", None)
        if org is None:
            # Fail closed: restoring without an organization context could
            # expose or mutate another organization's rows.
            raise Http404
        queryset = Vendor.all_objects.filter(is_deleted=True, organization=org)
        instance = queryset.filter(id=lookup_value).first()
        if instance is None:
            instance = queryset.filter(code__iexact=lookup_value).first()
        if instance is None:
            raise Http404
        self.check_object_permissions(request, instance)
        instance.restore()
        return Response(VendorDetailSerializer(instance).data)

    def get_object(self):
        """
        Override to support both UUID and code lookup.
        """
        from django.core.exceptions import ValidationError

        queryset = self.filter_queryset(self.get_queryset())

        lookup_url_kwarg = self.lookup_url_kwarg or self.lookup_field
        lookup_value = self.kwargs[lookup_url_kwarg]

        # Try UUID lookup first
        filter_kwargs = {"id": lookup_value}
        try:
            obj = get_object_or_404(queryset, **filter_kwargs)
            self.check_object_permissions(self.request, obj)
            return obj
        except (Http404, ValidationError):
            pass

        # Try code lookup
        filter_kwargs = {"code__iexact": lookup_value}
        obj = queryset.filter(**filter_kwargs).first()
        if obj:
            self.check_object_permissions(self.request, obj)
            return obj

        raise Http404
