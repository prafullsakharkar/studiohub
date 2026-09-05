"""
Legacy flat aliases for organization domain.

Mounted at /api/v1/ (top-level) to satisfy frontend's legacy `organizationApi.ts`
which calls /api/v1/{organizations,departments,teams,offices,people}/ directly.

See docs/api/domains/organization.md for contract.
"""

from django.urls import path
from drf_spectacular.utils import extend_schema
from rest_framework import serializers
from rest_framework.generics import GenericAPIView
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.routers import DefaultRouter

from apps.organization.api.viewsets.billing import BillingView, NotificationsView, ReportsView
from apps.organization.api.viewsets.client import ClientViewSet
from apps.organization.api.viewsets.contact import ClientContactViewSet, VendorContactViewSet
from apps.organization.api.viewsets.legacy import (
    LegacyDepartmentViewSet,
    LegacyOfficeViewSet,
    LegacyOrganizationViewSet,
    LegacyPersonViewSet,
    LegacyTeamViewSet,
)
from apps.organization.api.viewsets.vendor import VendorViewSet

router = DefaultRouter()

router.register(r"organizations", LegacyOrganizationViewSet, basename="legacy-organization")
router.register(r"departments", LegacyDepartmentViewSet, basename="legacy-department")
router.register(r"teams", LegacyTeamViewSet, basename="legacy-team")
router.register(r"offices", LegacyOfficeViewSet, basename="legacy-office")
router.register(r"people", LegacyPersonViewSet, basename="legacy-person")
# Nested contact routes must precede the parent clients/vendors registration
# so their regexes win over the parent detail routes.
router.register(
    r"clients/(?P<client_pk>[^/.]+)/contacts",
    ClientContactViewSet,
    basename="legacy-client-contact",
)
router.register(
    r"vendors/(?P<vendor_pk>[^/.]+)/contacts",
    VendorContactViewSet,
    basename="legacy-vendor-contact",
)
router.register(r"clients", ClientViewSet, basename="legacy-client")
router.register(r"vendors", VendorViewSet, basename="legacy-vendor")

app_name = "organization-legacy"


class _OrganizationSingletonSerializer(serializers.Serializer):
    id = serializers.UUIDField(read_only=True)
    name = serializers.CharField(read_only=True)

    class Meta:
        fields = ("id", "name")


class LegacyOrganizationSingletonView(GenericAPIView):
    """GET /api/v1/organization/ — returns first org for dashboard bootstrap (legacy)."""

    permission_classes = (IsAuthenticated,)
    serializer_class = _OrganizationSingletonSerializer

    @extend_schema(responses=_OrganizationSingletonSerializer)
    def get(self, request, *args, **kwargs):
        from apps.organization.api.serializers.organization import OrganizationDetailSerializer
        from apps.organization.models import Organization

        qs = Organization.objects.all()
        # Scope to user's orgs if not staff
        user = request.user
        if user and not (user.is_staff or user.is_superuser):
            qs = qs.filter(memberships__user=user)
        org = qs.first()
        if not org:
            return Response({"detail": "No organization found."}, status=404)
        serializer = OrganizationDetailSerializer(org)
        return Response(serializer.data)


urlpatterns = [
    path("organization/", LegacyOrganizationSingletonView.as_view(), name="legacy-organization-singleton"),
    path("billing/", BillingView.as_view(), name="legacy-billing"),
    path("reports/", ReportsView.as_view(), name="legacy-reports"),
    path("notifications/", NotificationsView.as_view(), name="legacy-notifications"),
] + router.urls
