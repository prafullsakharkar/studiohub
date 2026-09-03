from drf_spectacular.types import OpenApiTypes
from drf_spectacular.utils import extend_schema
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView


class BillingView(APIView):
    permission_classes = (IsAuthenticated,)

    @extend_schema(responses=OpenApiTypes.OBJECT)
    def get(self, request):
        return Response({
            "tier": "Enterprise Vanguard",
            "monthly_base_fee_usd": 12500,
            "farm_credits_total": 500000,
            "farm_credits_used": 328450,
            "farm_credits_remaining": 171550,
            "storage_quota_tb": 500,
            "storage_used_tb": 342.5,
            "active_seats_count": 248,
            "max_seats_count": 300,
            "next_billing_date": "2026-09-01",
            "invoice_currency": "USD ($)",
            "payment_method": "Corporate Wire ACH ••••• 8912",
        })


class ReportsView(APIView):
    permission_classes = (IsAuthenticated,)

    @extend_schema(responses=OpenApiTypes.OBJECT)
    def get(self, request):
        return Response([
            {
                "id": "rep-001",
                "title": "Weekly Production Report",
                "project_code": "NK99",
                "generated_at": "2026-08-20T00:00:00Z",
                "status": "Ready",
            }
        ])


class NotificationsView(APIView):
    permission_classes = (IsAuthenticated,)

    @extend_schema(responses=OpenApiTypes.OBJECT)
    def get(self, request):
        return Response([
            {
                "id": "notif-01",
                "title": "Screening Room Dailies Published",
                "message": "Alex Chen approved Shot NK_010_010 v004 with 2 supervisor notes.",
                "type": "success",
                "created_at": "2026-08-20T00:00:00Z",
                "is_read": False,
            }
        ])


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
