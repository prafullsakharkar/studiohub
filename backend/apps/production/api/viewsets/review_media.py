"""
Review media rows (C-RP-20, C-RP-22): retry a failed job, remove a ready movie.

Upload and the version's list are actions on ``versions/{id}/review-media/`` (``VersionViewSet``).
A row is reached through its version: one the caller cannot read is a 404 like an unknown id.
"""

from __future__ import annotations

from drf_spectacular.types import OpenApiTypes
from drf_spectacular.utils import OpenApiParameter, extend_schema
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import NotFound
from rest_framework.response import Response

from apps.core.permissions.base import IsAuthenticatedPermission
from apps.identity.permissions import HasPermission
from apps.production.api.serializers.review_media import ReviewMediaSerializer
from apps.production.constants.permissions import VersionPermissions
from apps.production.selectors.review_media import ReviewMediaSelector
from apps.production.services.review_media import ReviewMediaService

_ID = OpenApiParameter("id", OpenApiTypes.UUID, OpenApiParameter.PATH)


class ReviewMediaViewSet(viewsets.ViewSet):
    permission_classes = (IsAuthenticatedPermission, HasPermission)
    permission_map = {
        "retry": (VersionPermissions.UPDATE,),
        "destroy": (VersionPermissions.UPDATE,),
    }

    def get_permission_required(self):
        if self.action is None:
            return ()
        return self.permission_map.get(self.action)

    def _row(self, request, pk):
        row = ReviewMediaSelector.resolve_for(request.user, pk)
        if row is None:
            raise NotFound()
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
