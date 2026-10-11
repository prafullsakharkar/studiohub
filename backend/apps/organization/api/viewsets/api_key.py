"""
APIKey API viewset.
"""

from apps.core.api.pagination import StandardPagination
from apps.organization.api.filtersets.api_key import APIKeyFilterSet
from apps.organization.api.serializers.api_key import (
    APIKeyCreateSerializer,
    APIKeyDetailSerializer,
    APIKeyListSerializer,
    APIKeyUpdateSerializer,
)
from apps.organization.api.viewsets.base import OrganizationEntityViewSet
from apps.organization.api.viewsets.compat import FrontendStatusCompatMixin, IdOrCodeDetailMixin
from apps.organization.api.viewsets.context import OrganizationContextMixin
from apps.organization.constants.permissions import APIKeyPermissions
from apps.organization.models.api_key import APIKey
from apps.organization.selectors.api_key import APIKeySelector
from apps.organization.services.api_key import APIKeyService


class APIKeyViewSet(
    OrganizationContextMixin,
    FrontendStatusCompatMixin,
    IdOrCodeDetailMixin,
    OrganizationEntityViewSet,  # pyright: ignore[reportMissingTypeArgument]
):
    """
    API endpoint for APIKey.
    """

    queryset = APIKey.objects.all()

    selector_class = APIKeySelector
    service_class = APIKeyService

    search_fields = (
        "name",
        "description",
    )

    filterset_class = APIKeyFilterSet

    pagination_class = StandardPagination

    serializer_map = {
        "list": APIKeyListSerializer,
        "retrieve": APIKeyDetailSerializer,
        "create": APIKeyCreateSerializer,
        "update": APIKeyUpdateSerializer,
        "partial_update": APIKeyUpdateSerializer,
    }

    permission_map = {
        "list": (APIKeyPermissions.VIEW,),
        "retrieve": (APIKeyPermissions.VIEW,),
        "create": (APIKeyPermissions.CREATE,),
        "update": (APIKeyPermissions.UPDATE,),
        "partial_update": (APIKeyPermissions.UPDATE,),
        "destroy": (APIKeyPermissions.DELETE,),
    }

    frontend_status_target = "is_active"
    frontend_status_target_map = {"revoked": False, "expired": False, "active": True}
    frontend_status_output = {"is_active": {True: "Active", False: "Revoked"}}

    def perform_create(self, serializer):
        # Server-minted secrets: clients must never supply key material.
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
            user=self.request.user,
            **{
                **serializer.validated_data,
                "organization": organization,
                "prefix": prefix,
                "hashed_key": APIKeyHasher.hash(combined),
                "owner": self.request.user,
            },
        )
        instance._plain_secret = combined
        serializer.instance = instance