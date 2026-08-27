from rest_framework.decorators import action
from rest_framework.response import Response
from apps.core.api.pagination import StandardPagination
from apps.core.api.viewsets import ServiceModelViewSet
from apps.core.permissions.base import IsAuthenticatedPermission
from apps.identity.permissions import HasPermission
from apps.production.constants.permissions import ReviewPermissions
from apps.organization.middleware.organization_context import resolve_organization_context
from apps.production.api.filtersets.review import ReviewFilterSet
from apps.production.api.serializers.review.create import ReviewCreateSerializer
from apps.production.api.serializers.review.detail import ReviewDetailSerializer
from apps.production.api.serializers.review.list import ReviewListSerializer
from apps.production.api.serializers.review.update import ReviewUpdateSerializer
from apps.production.models import Review
from apps.production.selectors.review import ReviewSelector
from apps.production.services.review import ReviewService
import uuid, datetime

class ReviewViewSet(ServiceModelViewSet):
    queryset = Review.objects.all()
    selector_class = ReviewSelector
    service_class = ReviewService
    pagination_class = StandardPagination
    filterset_class = ReviewFilterSet
    permission_classes = (IsAuthenticatedPermission, HasPermission,)
    serializer_map = {
        "list": ReviewListSerializer,
        "retrieve": ReviewDetailSerializer,
        "create": ReviewCreateSerializer,
        "update": ReviewUpdateSerializer,
        "partial_update": ReviewUpdateSerializer,
    }

    permission_map = {
        "list": (ReviewPermissions.VIEW,),
        "retrieve": (ReviewPermissions.VIEW,),
        "create": (ReviewPermissions.CREATE,),
        "update": (ReviewPermissions.UPDATE,),
        "partial_update": (ReviewPermissions.UPDATE,),
        "destroy": (ReviewPermissions.DELETE,),
        "submit": (ReviewPermissions.UPDATE,),
        "start_review": (ReviewPermissions.UPDATE,),
        "approve": (ReviewPermissions.APPROVE,),
        "reject": (ReviewPermissions.APPROVE,),
        "request_changes": (ReviewPermissions.APPROVE,),
        "close": (ReviewPermissions.UPDATE,),
        "verdict": (ReviewPermissions.APPROVE,),
        "annotations": (ReviewPermissions.UPDATE,),
        "comments": (ReviewPermissions.UPDATE,),
        "resolve_comment": (ReviewPermissions.UPDATE,),
        "reopen_comment": (ReviewPermissions.UPDATE,),
        "notes": (ReviewPermissions.UPDATE,),
    }

    search_fields = ("title", "code", "entity_code")
    ordering_fields = ("title", "created_at", "status")

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
        serializer.save(organization=org, lead_reviewer=self.request.user if self.request.user.is_authenticated else None)

    def _update_status(self, instance, status, notes=None):
        instance.status = status
        if status in ("Approved", "Retake", "Changes Requested"):
            instance.supervisor_verdict = status
        if notes:
            # Append to activity
            activity = instance.activity or []
            activity.append({"action": status.upper(), "notes": notes, "user": getattr(self.request.user, "email", ""), "timestamp": datetime.datetime.now().isoformat()})
            instance.activity = activity
        instance.save(update_fields=["status", "supervisor_verdict", "activity"])
        return instance

    @action(detail=True, methods=["post"], url_path="submit")
    def submit(self, request, *args, **kwargs):
        instance = self.get_object()
        self._update_status(instance, "Submitted", request.data.get("notes"))
        return Response(ReviewDetailSerializer(instance).data)

    @action(detail=True, methods=["post"], url_path="start-review")
    def start_review(self, request, *args, **kwargs):
        instance = self.get_object()
        self._update_status(instance, "In Review", request.data.get("notes"))
        return Response(ReviewDetailSerializer(instance).data)

    @action(detail=True, methods=["post"], url_path="approve")
    def approve(self, request, *args, **kwargs):
        instance = self.get_object()
        self._update_status(instance, "Approved", request.data.get("notes"))
        return Response(ReviewDetailSerializer(instance).data)

    @action(detail=True, methods=["post"], url_path="reject")
    def reject(self, request, *args, **kwargs):
        instance = self.get_object()
        self._update_status(instance, "Rejected", request.data.get("notes"))
        return Response(ReviewDetailSerializer(instance).data)

    @action(detail=True, methods=["post"], url_path="request-changes")
    def request_changes(self, request, *args, **kwargs):
        instance = self.get_object()
        self._update_status(instance, "Changes Requested", request.data.get("notes"))
        return Response(ReviewDetailSerializer(instance).data)

    @action(detail=True, methods=["post"], url_path="close")
    def close(self, request, *args, **kwargs):
        instance = self.get_object()
        self._update_status(instance, "Closed", request.data.get("notes"))
        return Response(ReviewDetailSerializer(instance).data)

    @action(detail=True, methods=["post"], url_path="verdict")
    def verdict(self, request, *args, **kwargs):
        instance = self.get_object()
        verdict = request.data.get("verdict", "Pending Review")
        notes = request.data.get("notes")
        instance.supervisor_verdict = verdict
        if verdict == "Approved":
            instance.status = "Approved"
        elif verdict == "Retake":
            instance.status = "Retake"
        instance.save(update_fields=["supervisor_verdict", "status"])
        if notes:
            activity = instance.activity or []
            activity.append({"action": "VERDICT", "verdict": verdict, "notes": notes})
            instance.activity = activity
            instance.save(update_fields=["activity"])
        return Response(ReviewDetailSerializer(instance).data)

    @action(detail=True, methods=["post"], url_path="annotations")
    def annotations(self, request, *args, **kwargs):
        instance = self.get_object()
        ann = {
            "id": str(uuid.uuid4()),
            "frame_number": request.data.get("frame_number"),
            "timecode": request.data.get("timecode"),
            "author_name": request.data.get("author_name") or getattr(request.user, "email", ""),
            "comment": request.data.get("comment", ""),
            "drawing_coordinates": request.data.get("drawing_coordinates"),
            "created_at": datetime.datetime.now().isoformat(),
        }
        instance.annotations = (instance.annotations or []) + [ann]
        instance.save(update_fields=["annotations"])
        return Response(ann, status=201)

    @action(detail=True, methods=["post"], url_path="comments")
    def comments(self, request, *args, **kwargs):
        instance = self.get_object()
        comment = {
            "id": str(uuid.uuid4()),
            "frame_number": request.data.get("frame_number"),
            "timecode": request.data.get("timecode"),
            "author": request.data.get("author") or getattr(request.user, "email", ""),
            "text": request.data.get("text") or request.data.get("comment", ""),
            "is_client_visible": request.data.get("is_client_visible", True),
            "tags": request.data.get("tags", []),
            "created_at": datetime.datetime.now().isoformat(),
            "replies": [],
        }
        instance.comments = (instance.comments or []) + [comment]
        instance.save(update_fields=["comments"])
        return Response(comment, status=201)

    @action(detail=True, methods=["post"], url_path=r"comments/(?P<comment_id>[^/.]+)/resolve")
    def resolve_comment(self, request, comment_id=None, *args, **kwargs):
        instance = self.get_object()
        # Find comment and mark resolved
        comments = instance.comments or []
        for c in comments:
            if c.get("id") == comment_id:
                c["is_resolved"] = True
        instance.comments = comments
        instance.save(update_fields=["comments"])
        return Response(ReviewDetailSerializer(instance).data)

    @action(detail=True, methods=["post"], url_path=r"comments/(?P<comment_id>[^/.]+)/reopen")
    def reopen_comment(self, request, comment_id=None, *args, **kwargs):
        instance = self.get_object()
        comments = instance.comments or []
        for c in comments:
            if c.get("id") == comment_id:
                c["is_resolved"] = False
        instance.comments = comments
        instance.save(update_fields=["comments"])
        return Response(ReviewDetailSerializer(instance).data)

    @action(detail=True, methods=["post"], url_path="notes")
    def notes(self, request, *args, **kwargs):
        instance = self.get_object()
        note = {
            "id": str(uuid.uuid4()),
            "category": request.data.get("category", "General"),
            "author_name": request.data.get("author_name") or getattr(request.user, "email", ""),
            "author_role": request.data.get("author_role", ""),
            "content": request.data.get("content", ""),
            "is_pinned": request.data.get("is_pinned", False),
            "created_at": datetime.datetime.now().isoformat(),
        }
        instance.notes = (instance.notes or []) + [note]
        instance.save(update_fields=["notes"])
        return Response(note, status=201)
