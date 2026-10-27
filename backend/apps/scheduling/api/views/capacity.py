"""
Capacity, overbooking and resolve-overbooking endpoints (docs/scheduling/CONTRACTS.md API-SCH-12).

They were served by Production and moved here at the same paths, with the same codes and shapes
(`/api/v1/scheduling/capacity/`, `/overbooking/`, `/resolve-overbooking/`). Production's role in
them is only the membership read behind the project filter.
"""

from __future__ import annotations

from typing import Any, ClassVar

from django.core.exceptions import ValidationError as DjangoValidationError
from drf_spectacular.types import OpenApiTypes
from drf_spectacular.utils import extend_schema
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.identity.permissions import HasPermission
from apps.production.selectors.base import ProductionBaseSelector
from apps.scheduling.api.serializers import ResolveOverbookingSerializer
from apps.scheduling.constants.permissions import SchedulingPermissions
from apps.scheduling.selectors.capacity import get_capacity_summary, get_overbooking_alerts
from apps.scheduling.services.capacity import resolve_overbooking


class MethodPermissionMixin:
    """
    Permission codes by HTTP method, checked by ``HasPermission`` (fail closed: a method
    without an entry is denied).
    """

    permission_classes = (IsAuthenticated, HasPermission)
    permission_map: ClassVar[dict[str, tuple[str, ...]]] = {}
    request: Any  # pyright: ignore[reportUninitializedInstanceVariable]

    def get_permission_required(self):
        method = (self.request.method or "").lower()
        if method == "head":
            method = "get"
        return self.permission_map.get(method)


class SchedulingCapacityView(MethodPermissionMixin, APIView):
    """
    Capacity per department for the current week.

    Needs ``schedule.view``. The figures are studio-wide aggregates (names, projects and
    titles of bookings are not part of them), so they are not narrowed by project.
    """

    permission_map = {"get": (SchedulingPermissions.VIEW,)}

    @extend_schema(responses=OpenApiTypes.OBJECT)
    def get(self, request):
        return Response(get_capacity_summary())


class SchedulingOverbookingView(MethodPermissionMixin, APIView):
    """
    Resources booked beyond their weekly capacity.

    Needs ``schedule.view``. The excess counts every booking; the bookings listed under an
    alert are limited to the caller's projects and studio-wide ones, the rest appear
    anonymously (no title, no project).
    """

    permission_map = {"get": (SchedulingPermissions.VIEW,)}

    @extend_schema(responses=OpenApiTypes.OBJECT)
    def get(self, request):
        return Response(
            get_overbooking_alerts(
                visible_project_ids=ProductionBaseSelector.visible_project_ids(request)
            )
        )


class SchedulingResolveOverbookingView(MethodPermissionMixin, APIView):
    """
    Flag a resource's bookings of the week as overbooked.

    Needs ``schedule.update``. Only bookings of the caller's projects and studio-wide ones
    are changed; other projects' bookings are left as they are.
    """

    permission_map = {"post": (SchedulingPermissions.UPDATE,)}

    @extend_schema(request=ResolveOverbookingSerializer, responses=OpenApiTypes.OBJECT)
    def post(self, request):
        body = ResolveOverbookingSerializer(data=request.data)
        body.is_valid(raise_exception=True)
        data = dict(body.validated_data)
        try:
            result = resolve_overbooking(
                organization=None,
                alert_id=data["alert_id"],
                resource_id=data.get("resource_id"),
                visible_project_ids=ProductionBaseSelector.visible_project_ids(request),
            )
        except DjangoValidationError as exc:
            return Response({"detail": str(exc)}, status=400)
        if result is None:
            return Response({"detail": "Not found."}, status=404)
        return Response(result)
