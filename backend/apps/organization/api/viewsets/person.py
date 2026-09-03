from apps.core.api.pagination import StandardPagination
from apps.organization.api.serializers.person import (
    PersonCreateSerializer,
    PersonDetailSerializer,
    PersonListSerializer,
    PersonUpdateSerializer,
)
from apps.organization.api.viewsets.base import OrganizationEntityViewSet
from apps.organization.constants.permissions import PersonPermissions
from apps.organization.models.person import Person
from apps.organization.selectors.person import PersonSelector
from apps.organization.services.person import PersonService


class PersonViewSet(OrganizationEntityViewSet):
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

    # Person is not organization-scoped in the same way as Department/Team;
    # override to avoid scoping by organization (Person has no organization FK).
    def get_queryset(self):
        # Bypass OrganizationEntityViewSet's organization scoping
        from apps.organization.selectors.person import PersonSelector

        return PersonSelector.get_queryset(request=self.request, view=self)
