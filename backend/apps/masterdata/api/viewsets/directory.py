"""
Department, team, office, position and person viewsets (flat, platform-global).

Reads are open to every authenticated user; writes need ``masterdata.directory.manage`` (the
legacy ``platform.master_data.configure`` still counts until Phase 8) and always go through
a service. Personal data is gated field by field (H1). Responses are paginated to match the
frontend contract. The shared base lives in ``records.py``.
"""

from __future__ import annotations

from typing import Any

from rest_framework.decorators import action
from rest_framework.response import Response

from apps.masterdata.api.serializers.directory import (
    DeactivateSerializer,
    DepartmentSerializer,
    LinkUserSerializer,
    OfficeSerializer,
    PersonSerializer,
    PositionSerializer,
    TeamSerializer,
)
from apps.masterdata.api.viewsets.records import ServiceRecordViewSet
from apps.masterdata.constants.permissions import MasterdataPermissions
from apps.masterdata.selectors.directory import (
    DepartmentSelector,
    OfficeSelector,
    PersonSelector,
    PositionSelector,
    TeamSelector,
)
from apps.masterdata.services.organization import (
    DepartmentService,
    OfficeService,
    PositionService,
    TeamService,
)
from apps.masterdata.services.person import PersonService


class DepartmentViewSet(ServiceRecordViewSet):
    serializer_class = DepartmentSerializer
    selector_class = DepartmentSelector
    service_class = DepartmentService
    filterset_fields = ["department_type", "parent"]
    search_fields = ["name", "code"]
    ordering_fields = ["name", "code", "created_at"]


class TeamViewSet(ServiceRecordViewSet):
    serializer_class = TeamSerializer
    selector_class = TeamSelector
    service_class = TeamService
    filterset_fields = ["department"]
    search_fields = ["name", "code"]
    ordering_fields = ["name", "code", "created_at"]


class OfficeViewSet(ServiceRecordViewSet):
    serializer_class = OfficeSerializer
    selector_class = OfficeSelector
    service_class = OfficeService
    filterset_fields = ["country", "city", "is_active", "is_headquarters"]
    search_fields = ["name", "code", "city"]
    ordering_fields = ["name", "code", "created_at"]


class PositionViewSet(ServiceRecordViewSet):
    serializer_class = PositionSerializer
    selector_class = PositionSelector
    service_class = PositionService
    filterset_fields = ["department", "is_managerial"]
    search_fields = ["name", "code"]
    ordering_fields = ["level", "name", "created_at"]
    gated_query_fields = {MasterdataPermissions.PERSON_VIEW_SENSITIVE: ("salary_range",)}


class PersonViewSet(ServiceRecordViewSet):
    serializer_class = PersonSerializer
    selector_class = PersonSelector
    service_class = PersonService
    extra_write_actions = ("link_user", "unlink_user", "deactivate", "reactivate")
    filterset_fields = ["status", "department", "team", "office"]
    # Without masterdata.person.view_sensitive the search runs over ``name`` only.
    search_fields = ["name", "email"]
    ordering_fields = ["name", "created_at"]
    gated_query_fields = {
        MasterdataPermissions.PERSON_VIEW_SENSITIVE: (
            "email",
            "phone",
            "date_of_birth",
            "nationality",
            "security_clearance",
        )
    }

    # ---- update: report the manager/lead links a deactivation cleared ----

    def perform_update(self, serializer):
        data = dict(serializer.validated_data)
        updated = PersonService.update(
            actor=self.request.user, instance=serializer.instance, data=data
        )
        self._warnings = PersonService.warnings(updated)  # pyright: ignore[reportUninitializedInstanceVariable]
        serializer.instance = self.present(updated)

    def _with_warnings(self, response: Response) -> Response:
        warnings = getattr(self, "_warnings", [])
        if warnings:
            response.data = {**response.data, "warnings": warnings}
        return response

    def update(self, request, *args, **kwargs):
        return self._with_warnings(super().update(request, *args, **kwargs))

    # ---- actions ---------------------------------------------------------

    def _person_response(self, person: Any, *, warnings: Any = None) -> Response:
        body: dict[str, Any] = dict(self.get_serializer(self.present(person)).data)
        if warnings:
            body["warnings"] = warnings
        return Response(body)

    @action(detail=True, methods=["post"], url_path="link-user")
    def link_user(self, request, *args, **kwargs):
        body = LinkUserSerializer(data=request.data)
        body.is_valid(raise_exception=True)
        person = PersonService.link_user(
            actor=request.user, person=self.get_object(), user=body.validated_data["user"]
        )
        return self._person_response(person)

    @action(detail=True, methods=["post"], url_path="unlink-user")
    def unlink_user(self, request, *args, **kwargs):
        person = PersonService.unlink_user(actor=request.user, person=self.get_object())
        return self._person_response(person)

    @action(detail=True, methods=["post"], url_path="deactivate")
    def deactivate(self, request, *args, **kwargs):
        body = DeactivateSerializer(data=request.data)
        body.is_valid(raise_exception=True)
        person = PersonService.deactivate(
            actor=request.user, person=self.get_object(), status=body.validated_data["status"]
        )
        return self._person_response(person, warnings=PersonService.warnings(person))

    @action(detail=True, methods=["post"], url_path="reactivate")
    def reactivate(self, request, *args, **kwargs):
        person = PersonService.reactivate(actor=request.user, person=self.get_object())
        return self._person_response(person)


__all__ = [
    "DepartmentViewSet",
    "OfficeViewSet",
    "PersonViewSet",
    "PositionViewSet",
    "TeamViewSet",
]
