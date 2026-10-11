"""
PersonalAccessToken API viewset.
"""

from apps.core.api.pagination import StandardPagination
from apps.organization.api.filtersets.personal_access_token import PersonalAccessTokenFilterSet
from apps.organization.api.serializers.personal_access_token import (
    PersonalAccessTokenCreateSerializer,
    PersonalAccessTokenDetailSerializer,
    PersonalAccessTokenListSerializer,
    PersonalAccessTokenUpdateSerializer,
)
from apps.organization.api.viewsets.base import OrganizationEntityViewSet
from apps.organization.api.viewsets.compat import FrontendStatusCompatMixin, IdOrCodeDetailMixin
from apps.organization.api.viewsets.context import OrganizationContextMixin
from apps.organization.constants.permissions import PersonalAccessTokenPermissions
from apps.organization.models.personal_access_token import PersonalAccessToken
from apps.organization.selectors.personal_access_token import PersonalAccessTokenSelector
from apps.organization.services.personal_access_token import PersonalAccessTokenService


class PersonalAccessTokenViewSet(
    OrganizationContextMixin,
    FrontendStatusCompatMixin,
    IdOrCodeDetailMixin,
    OrganizationEntityViewSet,  # pyright: ignore[reportMissingTypeArgument]
):
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

    pagination_class = StandardPagination

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

    frontend_status_target = "is_active"
    frontend_status_target_map = {"revoked": False, "expired": False, "active": True}
    frontend_status_output = {"is_active": {True: "Active", False: "Revoked"}}

    def perform_create(self, serializer):
        # Server-minted secrets: clients must never supply token material.
        # The plaintext is exposed once via plain_secret on the create
        # response and never persisted.
        from apps.identity.api_keys.generator import APIKeyGenerator
        from apps.identity.api_keys.hashing import APIKeyHasher

        prefix, _secret, combined = APIKeyGenerator.api_key()
        organization = getattr(self.request, "organization", None)
        if organization is None:
            from rest_framework.exceptions import ValidationError

            raise ValidationError(
                {"organization": "An active organization is required."}
            )
        instance = self.get_service().create(
            **{
                **serializer.validated_data,
                "prefix": prefix,
                "hashed_token": APIKeyHasher.hash(combined),
                "user": self.request.user,
                "created_by": self.request.user,
            },
        )
        instance._plain_secret = combined
        serializer.instance = instance