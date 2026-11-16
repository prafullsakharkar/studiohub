"""
Review media rows (C-RP-20, C-RP-22): retry a failed job, remove a ready movie; a sequence's frames
and its completion, and cancelling it (C-RP-31).

Upload and the version's list are actions on ``versions/{id}/review-media/`` (``VersionViewSet``).
A row is reached through its version: one the caller cannot read is a 404 like an unknown id.
Acting on it needs ``version.update``, or being the version's artist with ``version.create`` (C-RP-26).
"""

from __future__ import annotations

from django.conf import settings
from drf_spectacular.types import OpenApiTypes
from drf_spectacular.utils import OpenApiParameter, extend_schema
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import NotFound
from rest_framework.response import Response

from apps.core.permissions.base import IsAuthenticatedPermission
from apps.identity.permissions import HasPermission
from apps.production.api.serializers.review_media import (
    ReviewMediaFramesResultSerializer,
    ReviewMediaFramesSerializer,
    ReviewMediaSerializer,
)
from apps.production.constants.permissions import VersionPermissions
from apps.production.exceptions import ReviewMediaDisabled
from apps.production.permissions.review_media import require_manage_review_media
from apps.production.selectors.review_media import ReviewMediaSelector
from apps.production.services.review_media import ReviewMediaService

_ID = OpenApiParameter("id", OpenApiTypes.UUID, OpenApiParameter.PATH)


class ReviewMediaViewSet(viewsets.ViewSet):
    permission_classes = (IsAuthenticatedPermission, HasPermission)
    # C-RP-26: reach decides the 404 (``_row``); require_manage_review_media the 403
    permission_map = {
        "retry": (VersionPermissions.VIEW,),
        "destroy": (VersionPermissions.VIEW,),
        "frames": (VersionPermissions.VIEW,),
        "complete": (VersionPermissions.VIEW,),
    }

    def get_permission_required(self):
        if self.action is None:
            return ()
        return self.permission_map.get(self.action)

    def _row(self, request, pk):
        row = ReviewMediaSelector.resolve_for(request.user, pk)
        if row is None:
            raise NotFound()
        require_manage_review_media(request, row.version)
        return row

    @extend_schema(parameters=[_ID], request=None, responses={202: ReviewMediaSerializer})
    @action(detail=True, methods=["post"], url_path="retry")
    def retry(self, request, pk=None):
        row = ReviewMediaService.retry(actor=request.user, media=self._row(request, pk))
        body = ReviewMediaSerializer(row, context={"request": request}).data
        return Response(body, status=status.HTTP_202_ACCEPTED)

    @extend_schema(parameters=[_ID], request=None, responses={204: None})
    def destroy(self, request, pk=None):
        ReviewMediaService.remove(actor=request.user, media=self._row(request, pk))
        return Response(status=status.HTTP_204_NO_CONTENT)

    @extend_schema(
        parameters=[_ID],
        request={"multipart/form-data": ReviewMediaFramesSerializer},
        responses={200: ReviewMediaFramesResultSerializer},
    )
    @action(detail=True, methods=["post"], url_path="frames")
    def frames(self, request, pk=None):
        """One part of a sequence's frames, up to 50 files under ``frames`` (C-RP-31)."""
        row = self._row(request, pk)
        if not settings.REVIEW_MEDIA_ENABLED:
            raise ReviewMediaDisabled()  # before the body is read
        files = request.FILES.getlist("frames")
        body = ReviewMediaFramesResultSerializer(
            ReviewMediaService.add_frames(actor=request.user, media=row, files=files)
        )
        return Response(body.data)

    @extend_schema(parameters=[_ID], request=None, responses={202: ReviewMediaSerializer})
    @action(detail=True, methods=["post"], url_path="complete")
    def complete(self, request, pk=None):
        """Queue a sequence whose every frame is in (C-RP-31)."""
        row = ReviewMediaService.complete(actor=request.user, media=self._row(request, pk))
        body = ReviewMediaSerializer(row, context={"request": request}).data
        return Response(body, status=status.HTTP_202_ACCEPTED)
