from django.contrib.auth import get_user_model
from drf_spectacular.utils import extend_schema
from rest_framework.decorators import action
from rest_framework.response import Response

from apps.core.api.pagination import StandardPagination
from apps.production.api.filtersets.review import ReviewFilterSet
from apps.production.api.serializers.actions import (
    AnnotationSerializer,
    ParticipantVerdictSerializer,
    ReviewCommentSerializer,
    ReviewNoteSerializer,
    ReviewNotesSerializer,
    ReviewParticipantAddSerializer,
    ReviewVerdictSerializer,
    ReviewVersionAddSerializer,
    validated,
)
from apps.production.api.serializers.review import parts
from apps.production.api.serializers.review.create import ReviewCreateSerializer
from apps.production.api.serializers.review.detail import ReviewDetailSerializer
from apps.production.api.serializers.review.list import ReviewListSerializer
from apps.production.api.serializers.review.update import ReviewUpdateSerializer
from apps.production.api.viewsets.base import ProductionEntityViewSet
from apps.production.api.viewsets.status_history import StatusHistoryMixin
from apps.production.constants.permissions import ReviewPermissions
from apps.production.selectors.review import ReviewSelector
from apps.production.services.review import ReviewService
from apps.production.validators.references import unknown


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
        "participants": (ReviewPermissions.UPDATE,),
        "remove_participant": (ReviewPermissions.UPDATE,),
        "add_version": (ReviewPermissions.UPDATE,),
        "remove_version": (ReviewPermissions.UPDATE,),
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
        return Response(self._detail(instance))

    @extend_schema(request=ReviewNotesSerializer)
    @action(detail=True, methods=["post"], url_path="start-review")
    def start_review(self, request, *args, **kwargs):
        instance = self.get_object()
        self._update_status(instance, "In Review", validated(ReviewNotesSerializer, request.data))
        return Response(self._detail(instance))

    @extend_schema(request=ReviewNotesSerializer)
    @action(detail=True, methods=["post"], url_path="approve")
    def approve(self, request, *args, **kwargs):
        instance = self.get_object()
        self._update_status(instance, "Approved", validated(ReviewNotesSerializer, request.data))
        return Response(self._detail(instance))

    @extend_schema(request=ReviewNotesSerializer)
    @action(detail=True, methods=["post"], url_path="reject")
    def reject(self, request, *args, **kwargs):
        instance = self.get_object()
        self._update_status(instance, "Rejected", validated(ReviewNotesSerializer, request.data))
        return Response(self._detail(instance))

    @extend_schema(request=ReviewNotesSerializer)
    @action(detail=True, methods=["post"], url_path="request-changes")
    def request_changes(self, request, *args, **kwargs):
        instance = self.get_object()
        self._update_status(instance, "Changes Requested", validated(ReviewNotesSerializer, request.data))
        return Response(self._detail(instance))

    @extend_schema(request=ReviewNotesSerializer)
    @action(detail=True, methods=["post"], url_path="close")
    def close(self, request, *args, **kwargs):
        instance = self.get_object()
        self._update_status(instance, "Closed", validated(ReviewNotesSerializer, request.data))
        return Response(self._detail(instance))

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
        return Response(self._detail(instance))

    @extend_schema(request=AnnotationSerializer)
    @action(detail=True, methods=["post"], url_path="annotations")
    def annotations(self, request, *args, **kwargs):
        instance = self.get_object()
        body = validated(AnnotationSerializer, request.data)
        # ``author_name`` is accepted for the old clients and ignored: the author is the caller.
        row = ReviewService.add_annotation(
            actor=request.user,
            review=instance,
            comment=body.get("comment", ""),
            frame_number=body.get("frame_number"),
            timecode=body.get("timecode") or "",
            drawing_coordinates=body.get("drawing_coordinates"),
        )
        return Response(parts.annotation_dict(row), status=201)

    @extend_schema(request=ReviewCommentSerializer)
    @action(detail=True, methods=["post"], url_path="comments")
    def comments(self, request, *args, **kwargs):
        instance = self.get_object()
        body = validated(ReviewCommentSerializer, request.data)
        # ``author`` is accepted for the old clients and ignored: the author is the caller.
        row = ReviewService.add_comment(
            actor=request.user,
            review=instance,
            text=body.get("text") or body.get("comment", ""),
            frame_number=body.get("frame_number"),
            timecode=body.get("timecode") or "",
            is_client_visible=body["is_client_visible"],
            tags=body["tags"],
            parent_id=body.get("parent_id"),
        )
        return Response(parts.comment_dict(row), status=201)

    @action(detail=True, methods=["post"], url_path=r"comments/(?P<comment_id>[^/.]+)/resolve")
    def resolve_comment(self, request, comment_id=None, *args, **kwargs):
        instance = self.get_object()
        ReviewService.set_comment_resolved(
            actor=request.user, review=instance, comment_id=comment_id, resolved=True
        )
        return Response(self._detail(instance))

    @action(detail=True, methods=["post"], url_path=r"comments/(?P<comment_id>[^/.]+)/reopen")
    def reopen_comment(self, request, comment_id=None, *args, **kwargs):
        instance = self.get_object()
        ReviewService.set_comment_resolved(
            actor=request.user, review=instance, comment_id=comment_id, resolved=False
        )
        return Response(self._detail(instance))

    @extend_schema(request=ReviewNoteSerializer)
    @action(detail=True, methods=["post"], url_path="notes")
    def notes(self, request, *args, **kwargs):
        instance = self.get_object()
        body = validated(ReviewNoteSerializer, request.data)
        # ``author_name`` and ``author_role`` are accepted for the old clients and ignored: the
        # author is the caller and the role is the one on the project membership.
        row = ReviewService.add_note(
            actor=request.user,
            review=instance,
            category=body["category"],
            content=body["content"],
            is_pinned=body["is_pinned"],
        )
        return Response(parts.note_dict(row), status=201)

    @extend_schema(request=ParticipantVerdictSerializer)
    @action(detail=True, methods=["post"], url_path="participant-verdict")
    def participant_verdict(self, request, *args, **kwargs):
        """Frontend contract: record one participant's verdict on the session (their own, D-30)."""
        instance = self.get_object()
        body = validated(ParticipantVerdictSerializer, request.data)
        ReviewService.record_participant_verdict(
            actor=request.user,
            review=instance,
            ref=body["participant_id"],
            verdict=body["verdict"],
            notes=body["notes"],
            can_decide_unlinked=self.can(ReviewPermissions.APPROVE),
            has_explicit=self.can_explicit,
            override_reason=body.get("override_reason"),
        )
        return Response(self._detail(instance))

    @extend_schema(request=ReviewParticipantAddSerializer)
    @action(detail=True, methods=["post"], url_path="participants")
    def participants(self, request, *args, **kwargs):
        instance = self.get_object()
        body = validated(ReviewParticipantAddSerializer, request.data)
        user = get_user_model().objects.filter(pk=body["user_id"]).first()
        if user is None:
            raise unknown("user_id", "user")
        ReviewService.add_participant(
            actor=request.user, review=instance, user=user, role=body.get("role", "")
        )
        return Response(self._detail(instance), status=201)

    @action(detail=True, methods=["delete"], url_path=r"participants/(?P<participant_id>[^/.]+)")
    def remove_participant(self, request, participant_id=None, *args, **kwargs):
        instance = self.get_object()
        ReviewService.remove_participant(actor=request.user, review=instance, ref=participant_id)
        return Response(self._detail(instance))

    @extend_schema(request=ReviewVersionAddSerializer)
    @action(detail=True, methods=["post"], url_path="versions")
    def add_version(self, request, *args, **kwargs):
        instance = self.get_object()
        body = validated(ReviewVersionAddSerializer, request.data)
        ReviewService.add_version(
            actor=request.user, review=instance, version_ref=body["version_id"]
        )
        return Response(self._detail(instance), status=201)

    @action(detail=True, methods=["delete"], url_path=r"versions/(?P<version_id>[^/.]+)")
    def remove_version(self, request, version_id=None, *args, **kwargs):
        instance = self.get_object()
        ReviewService.remove_version(actor=request.user, review=instance, version_ref=version_id)
        return Response(self._detail(instance))

    def _detail(self, instance):
        """The review as the detail endpoint shows it, with its rows read afresh."""
        fresh = ReviewSelector.get_queryset().get(pk=instance.pk)
        return ReviewDetailSerializer(fresh).data
