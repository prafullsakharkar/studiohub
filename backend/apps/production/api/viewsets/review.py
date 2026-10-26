import datetime
import uuid

from drf_spectacular.utils import extend_schema
from rest_framework.decorators import action
from rest_framework.exceptions import NotFound
from rest_framework.response import Response

from apps.core.api.pagination import StandardPagination
from apps.production.api.filtersets.review import ReviewFilterSet
from apps.production.api.serializers.actions import (
    AnnotationSerializer,
    ParticipantVerdictSerializer,
    ReviewCommentSerializer,
    ReviewNoteSerializer,
    ReviewNotesSerializer,
    ReviewVerdictSerializer,
    validated,
)
from apps.production.api.serializers.review.create import ReviewCreateSerializer
from apps.production.api.serializers.review.detail import ReviewDetailSerializer
from apps.production.api.serializers.review.list import ReviewListSerializer
from apps.production.api.serializers.review.update import ReviewUpdateSerializer
from apps.production.api.viewsets.base import ProductionEntityViewSet
from apps.production.api.viewsets.status_history import StatusHistoryMixin
from apps.production.constants.permissions import ReviewPermissions
from apps.production.selectors.review import ReviewSelector
from apps.production.services.review import ReviewService


class ReviewViewSet(StatusHistoryMixin, ProductionEntityViewSet):  # pyright: ignore[reportMissingTypeArgument]
    selector_class = ReviewSelector
    service_class = ReviewService
    pagination_class = StandardPagination
    filterset_class = ReviewFilterSet
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
        "status_history": (ReviewPermissions.VIEW,),
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
        "participant_verdict": (ReviewPermissions.UPDATE,),
        "archived": (ReviewPermissions.VIEW,),
        "restore": (ReviewPermissions.UPDATE,),
    }

    search_fields = ("title", "code", "entity_code")
    ordering_fields = ("title", "created_at", "status")

    def perform_create(self, serializer):
        if self.request.user.is_authenticated:
            serializer.validated_data["lead_reviewer"] = self.request.user
        super().perform_create(serializer)

    def _update_status(self, instance, status, body):
        return ReviewService.change_status(
            actor=self.request.user,
            review=instance,
            to_status=status,
            notes=body.get("notes"),
            **self.status_kwargs(body.get("override_reason")),
        )

    @extend_schema(request=ReviewNotesSerializer)
    @action(detail=True, methods=["post"], url_path="submit")
    def submit(self, request, *args, **kwargs):
        instance = self.get_object()
        self._update_status(instance, "Submitted", validated(ReviewNotesSerializer, request.data))
        return Response(ReviewDetailSerializer(instance).data)

    @extend_schema(request=ReviewNotesSerializer)
    @action(detail=True, methods=["post"], url_path="start-review")
    def start_review(self, request, *args, **kwargs):
        instance = self.get_object()
        self._update_status(instance, "In Review", validated(ReviewNotesSerializer, request.data))
        return Response(ReviewDetailSerializer(instance).data)

    @extend_schema(request=ReviewNotesSerializer)
    @action(detail=True, methods=["post"], url_path="approve")
    def approve(self, request, *args, **kwargs):
        instance = self.get_object()
        self._update_status(instance, "Approved", validated(ReviewNotesSerializer, request.data))
        return Response(ReviewDetailSerializer(instance).data)

    @extend_schema(request=ReviewNotesSerializer)
    @action(detail=True, methods=["post"], url_path="reject")
    def reject(self, request, *args, **kwargs):
        instance = self.get_object()
        self._update_status(instance, "Rejected", validated(ReviewNotesSerializer, request.data))
        return Response(ReviewDetailSerializer(instance).data)

    @extend_schema(request=ReviewNotesSerializer)
    @action(detail=True, methods=["post"], url_path="request-changes")
    def request_changes(self, request, *args, **kwargs):
        instance = self.get_object()
        self._update_status(instance, "Changes Requested", validated(ReviewNotesSerializer, request.data))
        return Response(ReviewDetailSerializer(instance).data)

    @extend_schema(request=ReviewNotesSerializer)
    @action(detail=True, methods=["post"], url_path="close")
    def close(self, request, *args, **kwargs):
        instance = self.get_object()
        self._update_status(instance, "Closed", validated(ReviewNotesSerializer, request.data))
        return Response(ReviewDetailSerializer(instance).data)

    @extend_schema(request=ReviewVerdictSerializer)
    @action(detail=True, methods=["post"], url_path="verdict")
    def verdict(self, request, *args, **kwargs):
        instance = self.get_object()
        body = validated(ReviewVerdictSerializer, request.data)
        ReviewService.record_verdict(
            actor=request.user,
            review=instance,
            verdict=body["verdict"],
            notes=body.get("notes"),
            **self.status_kwargs(body.get("override_reason")),
        )
        return Response(ReviewDetailSerializer(instance).data)

    @extend_schema(request=AnnotationSerializer)
    @action(detail=True, methods=["post"], url_path="annotations")
    def annotations(self, request, *args, **kwargs):
        instance = self.get_object()
        body = validated(AnnotationSerializer, request.data)
        ann = {
            "id": str(uuid.uuid4()),
            "frame_number": body.get("frame_number"),
            "timecode": body.get("timecode"),
            "author_name": body.get("author_name") or getattr(request.user, "email", ""),
            "comment": body["comment"],
            "drawing_coordinates": body.get("drawing_coordinates"),
            "created_at": datetime.datetime.now().isoformat(),
        }
        instance.annotations = (instance.annotations or []) + [ann]
        instance.save(update_fields=["annotations"])
        return Response(ann, status=201)

    @extend_schema(request=ReviewCommentSerializer)
    @action(detail=True, methods=["post"], url_path="comments")
    def comments(self, request, *args, **kwargs):
        instance = self.get_object()
        body = validated(ReviewCommentSerializer, request.data)
        comment = {
            "id": str(uuid.uuid4()),
            "frame_number": body.get("frame_number"),
            "timecode": body.get("timecode"),
            "author": body.get("author") or getattr(request.user, "email", ""),
            "text": body.get("text") or body.get("comment", ""),
            "is_client_visible": body["is_client_visible"],
            "tags": body["tags"],
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

    @extend_schema(request=ReviewNoteSerializer)
    @action(detail=True, methods=["post"], url_path="notes")
    def notes(self, request, *args, **kwargs):
        instance = self.get_object()
        body = validated(ReviewNoteSerializer, request.data)
        note = {
            "id": str(uuid.uuid4()),
            "category": body["category"],
            "author_name": body.get("author_name") or getattr(request.user, "email", ""),
            "author_role": body["author_role"],
            "content": body["content"],
            "is_pinned": body["is_pinned"],
            "created_at": datetime.datetime.now().isoformat(),
        }
        instance.notes = (instance.notes or []) + [note]
        instance.save(update_fields=["notes"])
        return Response(note, status=201)

    @extend_schema(request=ParticipantVerdictSerializer)
    @action(detail=True, methods=["post"], url_path="participant-verdict")
    def participant_verdict(self, request, *args, **kwargs):
        """Frontend contract: record one participant's verdict on the session."""
        instance = self.get_object()
        body = validated(ParticipantVerdictSerializer, request.data)
        participant_id = body["participant_id"]
        verdict = body["verdict"]
        notes = body["notes"]
        # Recording an approval is an approval, whoever the participant is.
        ReviewService.guard_approval(
            actor=request.user,
            review=instance,
            verdict=verdict,
            has_explicit=self.can_explicit,
            override_reason=body.get("override_reason"),
            note="participant verdict",
        )
        reviewers = list(instance.reviewers or [])
        for entry in reviewers:
            if not isinstance(entry, dict):
                continue
            if str(entry.get("id", "")) == str(participant_id) or str(
                entry.get("user_id", "")
            ) == str(participant_id):
                entry["verdict"] = verdict
                entry["verdict_notes"] = notes
                entry["verdict_date"] = datetime.datetime.now().isoformat()
                break
        else:
            raise NotFound("Participant not found on this review.")
        instance.reviewers = reviewers
        instance.save(update_fields=["reviewers"])
        return Response(ReviewDetailSerializer(instance).data)
