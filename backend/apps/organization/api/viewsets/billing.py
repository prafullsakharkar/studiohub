from drf_spectacular.types import OpenApiTypes
from drf_spectacular.utils import extend_schema
from rest_framework import status
from rest_framework.exceptions import PermissionDenied
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.organization.api.serializers.billing import (
    OrganizationBillingSerializer,
    OrganizationBillingUpdateSerializer,
)
from apps.organization.middleware.organization_context import (
    resolve_organization_context,
)
from apps.organization.models import Organization, OrganizationBilling
from apps.organization.services.billing import OrganizationBillingService


def _resolve_billing_organization(request):
    """
    Resolve the billing organization: explicit request context first,
    then the first org for staff (admin context).
    """
    resolve_organization_context(request, force=True)
    organization = getattr(request, "organization", None)
    if organization is not None:
        return organization
    user = getattr(request, "user", None)
    if user is not None and (user.is_staff or user.is_superuser):
        return Organization.objects.first()
    return None


class BillingView(APIView):
    """
    Per-organization billing account (backed by ``OrganizationBilling``).

    Usage counters start at zero — consumption wiring is future work.
    """

    permission_classes = (IsAuthenticated,)

    def _get_billing(self, request):
        organization = _resolve_billing_organization(request)
        if organization is None:
            return None
        billing, _ = OrganizationBilling.objects.get_or_create(
            organization=organization
        )
        return billing

    @extend_schema(responses=OrganizationBillingSerializer)
    def get(self, request):
        billing = self._get_billing(request)
        if billing is None:
            return Response(
                {"detail": "No organization found."},
                status=status.HTTP_404_NOT_FOUND,
            )
        return Response(OrganizationBillingSerializer(billing).data)

    @extend_schema(
        request=OrganizationBillingUpdateSerializer,
        responses=OrganizationBillingSerializer,
    )
    def patch(self, request):
        user = getattr(request, "user", None)
        if user is None or not (user.is_staff or user.is_superuser):
            raise PermissionDenied("Only staff can update billing.")
        billing = self._get_billing(request)
        if billing is None:
            return Response(
                {"detail": "No organization found."},
                status=status.HTTP_404_NOT_FOUND,
            )
        serializer = OrganizationBillingUpdateSerializer(
            instance=billing, data=request.data, partial=True
        )
        serializer.is_valid(raise_exception=True)
        updated = OrganizationBillingService.update(
            billing, user=user, **serializer.validated_data
        )
        return Response(OrganizationBillingSerializer(updated).data)


class ReportsView(APIView):
    """
    Explicit stub: the reporting domain has no backend models yet.

    Returns an empty list (never fake records) until the domain is built.
    """

    permission_classes = (IsAuthenticated,)

    @extend_schema(responses=OpenApiTypes.OBJECT)
    def get(self, request):
        return Response([])


class NotificationsView(APIView):
    """
    Explicit stub: the notifications domain has no backend models yet.

    Returns an empty list (never fake records) until the domain is built.
    """

    permission_classes = (IsAuthenticated,)

    @extend_schema(responses=OpenApiTypes.OBJECT)
    def get(self, request):
        return Response([])


class OrganizationSingletonLegacyView(APIView):
    permission_classes = (IsAuthenticated,)

    @extend_schema(responses=OpenApiTypes.OBJECT)
    def get(self, request):
        from apps.organization.api.serializers.organization import OrganizationDetailSerializer
        from apps.organization.models import Organization

        qs = Organization.objects.all()
        user = request.user
        if user and not (user.is_staff or user.is_superuser):
            qs = qs.filter(memberships__user=user)
        org = qs.first()
        if not org:
            return Response({"detail": "No organization found."}, status=404)
        return Response(OrganizationDetailSerializer(org).data)
