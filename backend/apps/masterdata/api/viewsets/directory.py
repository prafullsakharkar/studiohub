"""
Global directory viewsets (org-removal B3).

Flat platform-global CRUD for departments, teams, offices, positions and people
(clients, vendors, contacts and contracts live in ``partners.py``). Reads are open
to every authenticated user; writes need ``masterdata.directory.manage`` (the
legacy ``platform.master_data.configure`` still counts until Phase 8). Personal
data is gated field by field (H1). Responses are paginated to match the
frontend contract.
"""

from __future__ import annotations

from django_filters.rest_framework import DjangoFilterBackend
from rest_framework import filters, mixins

from apps.core.api.pagination import StandardPagination
from apps.core.api.viewsets.platform import PlatformScopedViewSet
from apps.core.permissions.base import IsAuthenticatedPermission
from apps.masterdata.api.serializers.directory import (
    DepartmentSerializer,
    OfficeSerializer,
    PersonSerializer,
    PositionSerializer,
    TeamSerializer,
)
from apps.masterdata.api.viewsets.gating import GatedQueryMixin, GatedSearchFilter
from apps.masterdata.constants.permissions import MasterdataPermissions
from apps.masterdata.permissions import AliasAwareHasPermission
from apps.masterdata.selectors.directory import (
    DepartmentSelector,
    OfficeSelector,
    PersonSelector,
    PositionSelector,
    TeamSelector,
)


class GlobalDirectoryGuard:
    """Open reads, ``masterdata.directory.manage`` for writes (the legacy code still counts)."""

    permission_classes = (
        IsAuthenticatedPermission,
        AliasAwareHasPermission,
    )

    permission_map = {
        "list": (),
        "retrieve": (),
        "create": (MasterdataPermissions.DIRECTORY_MANAGE,),
        "update": (MasterdataPermissions.DIRECTORY_MANAGE,),
        "partial_update": (MasterdataPermissions.DIRECTORY_MANAGE,),
        "destroy": (MasterdataPermissions.DIRECTORY_MANAGE,),
    }


class DirectoryModelViewSet(
    GatedQueryMixin,
    GlobalDirectoryGuard,
    mixins.ListModelMixin,
    mixins.CreateModelMixin,
    mixins.RetrieveModelMixin,
    mixins.UpdateModelMixin,
    mixins.DestroyModelMixin,
    PlatformScopedViewSet,
):
    filter_backends = [DjangoFilterBackend, GatedSearchFilter, filters.OrderingFilter]
    ordering = ["name"]
    pagination_class = StandardPagination


class DepartmentViewSet(DirectoryModelViewSet):
    serializer_class = DepartmentSerializer
    selector_class = DepartmentSelector
    filterset_fields = ["department_type", "parent"]
    search_fields = ["name", "code"]
    ordering_fields = ["name", "code", "created_at"]


class TeamViewSet(DirectoryModelViewSet):
    serializer_class = TeamSerializer
    selector_class = TeamSelector
    filterset_fields = ["department"]
    search_fields = ["name", "code"]
    ordering_fields = ["name", "code", "created_at"]


class OfficeViewSet(DirectoryModelViewSet):
    serializer_class = OfficeSerializer
    selector_class = OfficeSelector
    filterset_fields = ["country", "city", "is_active", "is_headquarters"]
    search_fields = ["name", "code", "city"]
    ordering_fields = ["name", "code", "created_at"]


class PositionViewSet(DirectoryModelViewSet):
    serializer_class = PositionSerializer
    selector_class = PositionSelector
    filterset_fields = ["department", "is_managerial"]
    search_fields = ["name", "code"]
    ordering_fields = ["level", "name", "created_at"]
    gated_query_fields = {MasterdataPermissions.PERSON_VIEW_SENSITIVE: ("salary_range",)}


class PersonViewSet(DirectoryModelViewSet):
    serializer_class = PersonSerializer
    selector_class = PersonSelector
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
