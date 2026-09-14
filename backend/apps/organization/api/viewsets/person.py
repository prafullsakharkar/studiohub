from apps.core.api.pagination import StandardPagination
from apps.organization.api.serializers.person import (
    PersonCreateSerializer,
    PersonDetailSerializer,
    PersonListSerializer,
    PersonUpdateSerializer,
)
from apps.organization.api.viewsets.base import OrganizationEntityViewSet
from apps.organization.api.viewsets.context import OrganizationContextMixin
from apps.organization.constants.permissions import PersonPermissions
from apps.organization.models.person import Person
from apps.organization.selectors.person import PersonSelector
from apps.organization.services.person import PersonService


class PersonViewSet(
    OrganizationContextMixin,
    OrganizationEntityViewSet,  # pyright: ignore[reportMissingTypeArgument]
):
    """
    API endpoint for Person (people).
    Provides CRUD for the generic Person model, exposed as /people/ (legacy flat)
    and /organization/persons/ (namespaced) for frontend compatibility.
    Frontend expects paginated Person with full_name, role, department, etc.
    Backend provides minimal mapping with defaults for missing fields.
    """

    queryset = Person.objects.all()

    selector_class = PersonSelector
    service_class = PersonService

    pagination_class = StandardPagination

    serializer_map = {
        "list": PersonListSerializer,
        "retrieve": PersonDetailSerializer,
        "create": PersonCreateSerializer,
        "update": PersonUpdateSerializer,
        "partial_update": PersonUpdateSerializer,
    }

    permission_map = {
        "list": (PersonPermissions.VIEW,),
        "retrieve": (PersonPermissions.VIEW,),
        "create": (PersonPermissions.CREATE,),
        "update": (PersonPermissions.UPDATE,),
        "partial_update": (PersonPermissions.UPDATE,),
        "destroy": (PersonPermissions.DELETE,),
    }

    def get_queryset(self):
        # Organization-scoped via OrganizationBaseSelector.scope_by_request
        # (staff/superusers unscoped; others filtered to request.organization;
        # no context yields no rows). Person.organization is nullable for
        # legacy rows, which stay invisible to scoped reads (fail closed).
        return super().get_queryset()

    def perform_create(self, serializer):
        # Default new rows to the request organization when the payload
        # does not name one, so scoped creators can read what they create.
        validated_data: dict = getattr(serializer, "validated_data", None) or {}
        if not validated_data.get("organization"):
            org = getattr(self.request, "organization", None)
            if org is not None:
                validated_data["organization"] = org
        return super().perform_create(serializer)
