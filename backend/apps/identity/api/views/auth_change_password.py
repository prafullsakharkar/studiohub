from __future__ import annotations

from drf_spectacular.types import OpenApiTypes
from drf_spectacular.utils import extend_schema
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework_simplejwt.authentication import JWTAuthentication

from apps.core.api.views import BaseAPIView
from apps.identity.api.serializers.authentication import (
    ChangePasswordSerializer,
)


class AuthChangePasswordView(BaseAPIView):
    """
    Frontend-compatible self password change.

    Deliberately returns NO replacement tokens: the backend revokes every
    session on password change, so the SPA must re-login.
    """

    authentication_classes = (JWTAuthentication,)
    permission_classes = (IsAuthenticated,)
    serializer_class = ChangePasswordSerializer

    @extend_schema(
        request=OpenApiTypes.OBJECT,
        responses={200: OpenApiTypes.OBJECT},
    )
    def post(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        serializer.save()

        return Response(
            {"detail": "Password changed. All sessions have been signed out."},
            status=status.HTTP_200_OK,
        )
