from apps.organization.api.filtersets.personal_access_token import PersonalAccessTokenFilterSet
from apps.organization.api.serializers.personal_access_token import (
    PersonalAccessTokenCreateSerializer,
    PersonalAccessTokenDetailSerializer,
    PersonalAccessTokenListSerializer,
    PersonalAccessTokenUpdateSerializer,
)
from apps.organization.api.viewsets.base import OrganizationEntityViewSet
from apps.organization.constants.permissions import PersonalAccessTokenPermissions
from apps.organization.models.personal_access_token import PersonalAccessToken
from apps.organization.selectors.personal_access_token import PersonalAccessTokenSelector
from apps.organization.services.personal_access_token import PersonalAccessTokenService


class PersonalAccessTokenViewSet(OrganizationEntityViewSet):
    """
    API endpoint for PersonalAccessToken.
    """

    queryset = PersonalAccessToken.objects.all()

    selector_class = PersonalAccessTokenSelector
    service_class = PersonalAccessTokenService

    search_fields = (
        "name",
    )

    filterset_class = PersonalAccessTokenFilterSet

    serializer_map = {
        "list": PersonalAccessTokenListSerializer,
        "retrieve": PersonalAccessTokenDetailSerializer,
        "create": PersonalAccessTokenCreateSerializer,
        "update": PersonalAccessTokenUpdateSerializer,
        "partial_update": PersonalAccessTokenUpdateSerializer,
    }

    permission_map = {
        "list": (PersonalAccessTokenPermissions.VIEW,),
        "retrieve": (PersonalAccessTokenPermissions.VIEW,),
        "create": (PersonalAccessTokenPermissions.CREATE,),
        "update": (PersonalAccessTokenPermissions.UPDATE,),
        "partial_update": (PersonalAccessTokenPermissions.UPDATE,),
        "destroy": (PersonalAccessTokenPermissions.DELETE,),
    }
