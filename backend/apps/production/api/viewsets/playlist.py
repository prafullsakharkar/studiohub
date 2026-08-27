from rest_framework.decorators import action
from rest_framework.response import Response
from apps.core.api.viewsets import ServiceModelViewSet
from apps.core.permissions.base import IsAuthenticatedPermission
from apps.identity.permissions import HasPermission
from apps.production.constants.permissions import PlaylistPermissions
from apps.organization.middleware.organization_context import resolve_organization_context
from apps.production.api.serializers.playlist.create import PlaylistCreateSerializer
from apps.production.api.serializers.playlist.detail import PlaylistDetailSerializer
from apps.production.api.serializers.playlist.list import PlaylistListSerializer
from apps.production.api.serializers.playlist.update import PlaylistUpdateSerializer
from apps.production.models import Playlist
from apps.production.selectors.playlist import PlaylistSelector
from apps.production.services.playlist import PlaylistService
import uuid, datetime

class PlaylistViewSet(ServiceModelViewSet):
    queryset = Playlist.objects.all()
    selector_class = PlaylistSelector
    service_class = PlaylistService
    pagination_class = None
    permission_classes = (IsAuthenticatedPermission, HasPermission,)
    serializer_map = {
        "list": PlaylistListSerializer,
        "retrieve": PlaylistDetailSerializer,
        "create": PlaylistCreateSerializer,
        "update": PlaylistUpdateSerializer,
        "partial_update": PlaylistUpdateSerializer,
    }

    permission_map = {
        "list": (PlaylistPermissions.VIEW,),
        "retrieve": (PlaylistPermissions.VIEW,),
        "create": (PlaylistPermissions.CREATE,),
        "update": (PlaylistPermissions.UPDATE,),
        "partial_update": (PlaylistPermissions.UPDATE,),
        "destroy": (PlaylistPermissions.DELETE,),
        "add_entry": (PlaylistPermissions.UPDATE,),
        "remove_entry": (PlaylistPermissions.UPDATE,),
        "reorder": (PlaylistPermissions.UPDATE,),
        "share": (PlaylistPermissions.UPDATE,),
        "archive": (PlaylistPermissions.UPDATE,),
        "restore": (PlaylistPermissions.UPDATE,),
    }

    search_fields = ("name", "code")
    filterset_fields = ("status", "project", "client_only")
    ordering_fields = ("name", "created_at")

    def perform_authentication(self, request):
        super().perform_authentication(request)
        resolve_organization_context(request, force=True)
        return request

    def perform_create(self, serializer):
        org = getattr(self.request, "organization", None)
        if org is None:
            org_id = self.request.headers.get("X-Organization-Id")
            if org_id:
                from apps.organization.models import Organization
                try:
                    org = Organization.objects.get(pk=org_id)
                except Exception:
                    pass
        if org is None and self.request.user.is_authenticated:
            from apps.organization.models import OrganizationMembership
            m = OrganizationMembership.objects.filter(user=self.request.user).first()
            if m:
                org = m.organization
        if org is None:
            from apps.organization.models import Organization
            org = Organization.objects.first()
        serializer.save(organization=org)

    @action(detail=True, methods=["post"], url_path="add-entry")
    def add_entry(self, request, *args, **kwargs):
        instance = self.get_object()
        entry = {
            "id": str(uuid.uuid4()),
            "version_id": request.data.get("version_id"),
            "item_order": len(instance.entries or []) + 1,
            **request.data,
        }
        instance.entries = (instance.entries or []) + [entry]
        instance.save(update_fields=["entries"])
        return Response(PlaylistDetailSerializer(instance).data)

    @action(detail=True, methods=["post"], url_path="remove-entry")
    def remove_entry(self, request, *args, **kwargs):
        instance = self.get_object()
        entry_id = request.data.get("entry_id")
        instance.entries = [e for e in (instance.entries or []) if e.get("id") != entry_id and e.get("entry_id") != entry_id]
        instance.save(update_fields=["entries"])
        return Response(PlaylistDetailSerializer(instance).data)

    @action(detail=True, methods=["post"], url_path="reorder")
    def reorder(self, request, *args, **kwargs):
        instance = self.get_object()
        entries = request.data.get("entries")
        if entries is not None:
            instance.entries = entries
            instance.save(update_fields=["entries"])
        return Response(PlaylistDetailSerializer(instance).data)

    @action(detail=True, methods=["post"], url_path="share")
    def share(self, request, *args, **kwargs):
        instance = self.get_object()
        # Merge share_settings
        share = instance.share_settings or {}
        share.update(request.data)
        instance.share_settings = share
        instance.save(update_fields=["share_settings"])
        return Response(PlaylistDetailSerializer(instance).data)

    @action(detail=True, methods=["post"], url_path="archive")
    def archive(self, request, *args, **kwargs):
        instance = self.get_object()
        instance.is_archived = True
        instance.status = "Archived"
        instance.save(update_fields=["is_archived", "status"])
        return Response(PlaylistDetailSerializer(instance).data)

    @action(detail=True, methods=["post"], url_path="restore")
    def restore(self, request, *args, **kwargs):
        instance = self.get_object()
        instance.is_archived = False
        instance.status = "Active"
        instance.save(update_fields=["is_archived", "status"])
        return Response(PlaylistDetailSerializer(instance).data)
