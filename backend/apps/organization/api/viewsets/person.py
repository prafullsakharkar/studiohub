from rest_framework import status
from rest_framework.decorators import action
from rest_framework.exceptions import PermissionDenied
from rest_framework.response import Response

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
        "set_password": (PersonPermissions.UPDATE,),
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

    @action(detail=True, methods=["POST"], url_path="set-password")
    def set_password(self, request, *args, **kwargs):
        """Set a person's linked user password. Django's set_password handles hashing —
        plaintext is never persisted. Membership is the gate; person.update must
        be granted. Self-change additionally requires the old password."""
        from rest_framework.exceptions import NotFound, ValidationError
        from django.contrib.auth.hashers import check_password
        from apps.identity.models import User

        person = self.get_object()
        organization = getattr(request, "organization", None)
        if organization is not None and person.organization_id != organization.id:
            # scoped detail in foreign org reaches HasPermission already, but
            # pin the rule explicitly for the action path
            raise NotFound()

        user = User.objects.filter(email=person.email, is_deleted=False).first()
        if not user:
            return Response(
                {"detail": "No linked user account for this person."},
                status=status.HTTP_404_NOT_FOUND,
            )

        current_password = request.data.get("current_password", "")
        new_password = request.data.get("new_password", "")
        is_self = request.user.id == user.id

        if not new_password:
            raise ValidationError({"new_password": "Required."})
        if user.password and not user.check_password(current_password) and is_self:
            raise ValidationError({"current_password": "Incorrect."})
        if not is_self and not any(
            request.user.is_superuser or
            (getattr(request, "membership", None) is not None)
            for _ in [True]
        ):
            # Admin path: backend RBAC above already gates; only deny when
            # acting on someone else's account with no membership whatsoever.
            raise PermissionDenied({"detail": "Cannot reset another user's password without org membership."})

        user.set_password(new_password)
        user.save(update_fields=["password"])
        return Response({"detail": "Password updated."}, status=status.HTTP_200_OK)
