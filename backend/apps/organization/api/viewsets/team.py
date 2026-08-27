from rest_framework.decorators import action
from rest_framework.response import Response

from apps.core.api.pagination import StandardPagination

from apps.organization.api.filtersets.team import TeamFilterSet
from apps.organization.api.serializers.team.create import TeamCreateSerializer
from apps.organization.api.serializers.team.detail import TeamDetailSerializer
from apps.organization.api.serializers.team.list import TeamListSerializer
from apps.organization.api.serializers.team.update import TeamUpdateSerializer
from apps.organization.api.viewsets.base import (
    OrganizationEntityViewSet,
)
from apps.organization.constants.permissions import TeamPermissions
from apps.organization.models.team import Team
from apps.organization.selectors.team import TeamSelector
from apps.organization.services.team import TeamService


class TeamViewSet(OrganizationEntityViewSet):
    """
    API endpoint for Team entity.
    """

    # -----------------------------
    # Core wiring
    # -----------------------------
    queryset = Team.objects.all()

    selector_class = TeamSelector
    service_class = TeamService
    filterset_class = TeamFilterSet

    pagination_class = StandardPagination

    # -----------------------------
    # Serializer mapping
    # -----------------------------
    serializer_map = {
        "list": TeamListSerializer,
        "retrieve": TeamDetailSerializer,
        "create": TeamCreateSerializer,
        "update": TeamUpdateSerializer,
        "partial_update": TeamUpdateSerializer,
    }

    # -----------------------------
    # Permission mapping
    # -----------------------------
    permission_map = {
        "list": (TeamPermissions.VIEW,),
        "retrieve": (TeamPermissions.VIEW,),
        "create": (TeamPermissions.CREATE,),
        "update": (TeamPermissions.UPDATE,),
        "partial_update": (TeamPermissions.UPDATE,),
        "destroy": (TeamPermissions.DELETE,),
        "archive": (TeamPermissions.UPDATE,),
        "transfer_ownership": (TeamPermissions.UPDATE,),
        "members": (TeamPermissions.VIEW,),
        "add_member": (TeamPermissions.UPDATE,),
        "remove_member": (TeamPermissions.UPDATE,),
    }

    @action(detail=True, methods=["post"], url_path="archive")
    def archive(self, request, *args, **kwargs):
        instance = self.get_object()
        # Use lifecycle via service if available, else soft-delete style
        try:
            self.service_class.archive(instance)
        except Exception:
            instance.delete()
        serializer = TeamDetailSerializer(instance)
        return Response(serializer.data)

    @action(detail=True, methods=["post"], url_path="transfer-ownership")
    def transfer_ownership(self, request, *args, **kwargs):
        instance = self.get_object()
        user_id = request.data.get("user") or request.data.get("user_id") or request.data.get("userId")
        if not user_id:
            return Response({"detail": "user is required."}, status=400)
        from django.contrib.auth import get_user_model

        User = get_user_model()
        try:
            user = User.objects.get(pk=user_id)
        except User.DoesNotExist:
            return Response({"detail": "User not found."}, status=404)
        instance.lead = user
        instance.save(update_fields=["lead"])
        serializer = TeamDetailSerializer(instance)
        return Response(serializer.data)

    @action(detail=True, methods=["get"], url_path="members")
    def members(self, request, *args, **kwargs):
        instance = self.get_object()
        from apps.organization.models import OrganizationMembership

        qs = OrganizationMembership.objects.filter(team=instance, is_deleted=False).select_related("user", "role")
        # Simple pagination via DRF if needed; for contract we return paginated shape if page param present
        page = self.paginate_queryset(qs)
        if page is not None:
            # Minimal representation
            data = [
                {"user": str(m.user_id), "user_email": m.user.email, "role": getattr(m.role, "name", "") if m.role else ""}
                for m in page
            ]
            return self.get_paginated_response(data)
        data = [
            {"user": str(m.user_id), "user_email": m.user.email, "role": getattr(m.role, "name", "") if m.role else ""}
            for m in qs
        ]
        return Response(data)

    @action(detail=True, methods=["post"], url_path="members/add")
    def add_member(self, request, *args, **kwargs):
        instance = self.get_object()
        user_id = request.data.get("user") or request.data.get("user_id")
        role = request.data.get("role", "member")
        if not user_id:
            return Response({"detail": "user is required."}, status=400)
        from django.contrib.auth import get_user_model
        from apps.organization.models import OrganizationMembership, Role

        User = get_user_model()
        try:
            user = User.objects.get(pk=user_id)
        except User.DoesNotExist:
            return Response({"detail": "User not found."}, status=404)
        # Resolve role if provided as string name
        role_obj = None
        if role:
            try:
                role_obj = Role.objects.filter(code=role, organization=instance.organization).first() or Role.objects.filter(name=role).first()
            except Exception:
                role_obj = None
        # Ensure membership exists — ensure a role is available (create fallback if needed)
        fallback_role = None
        if role_obj is None:
            try:
                from apps.organization.models import Role

                fallback_role = Role.objects.filter(organization=instance.organization).first()
                if fallback_role is None:
                    fallback_role = Role.objects.create(
                        organization=instance.organization,
                        code="member",
                        name="Member",
                        is_system=False,
                        is_active=True,
                    )
            except Exception:
                fallback_role = None
        effective_role = role_obj or fallback_role
        if effective_role is None:
            return Response({"detail": "No role available for membership."}, status=400)
        membership, _ = OrganizationMembership.objects.get_or_create(
            user=user,
            organization=instance.organization,
            defaults={"team": instance, "role": effective_role, "is_primary": False, "status": "active"},
        )
        # If membership existed but without team, set it
        if membership.team_id != instance.id:
            membership.team = instance
            if role_obj:
                membership.role = role_obj
            membership.save(update_fields=["team", "role"])
        serializer = TeamDetailSerializer(instance)
        return Response(serializer.data)

    @action(detail=True, methods=["post"], url_path="members/remove")
    def remove_member(self, request, *args, **kwargs):
        instance = self.get_object()
        user_id = request.data.get("user") or request.data.get("user_id")
        if not user_id:
            return Response({"detail": "user is required."}, status=400)
        from apps.organization.models import OrganizationMembership

        try:
            membership = OrganizationMembership.objects.get(user_id=user_id, team=instance)
        except OrganizationMembership.DoesNotExist:
            return Response({"detail": "Membership not found."}, status=404)
        # For team removal, either delete membership or clear team
        if membership.organization_id == instance.organization_id and OrganizationMembership.objects.filter(user_id=user_id, organization=instance.organization).count() > 1:
            membership.delete()
        else:
            membership.team = None
            membership.save(update_fields=["team"])
        serializer = TeamDetailSerializer(instance)
        return Response(serializer.data)
