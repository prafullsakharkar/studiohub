"""
Frontend-compatible auth endpoints.

Mount: /api/v1/auth/{login,refresh,logout,me}/

These are thin adapters over the existing Identity services, translating
backend shapes into frontend contract shapes defined in docs/api/authentication.md:

  POST /auth/login/  -> { tokens: {access, refresh}, user: FrontendUser }
  POST /auth/refresh/ -> { access }
  POST /auth/logout/ -> { detail }
  GET  /auth/me/     -> FrontendUser

They reuse AuthenticationService / TokenService so behavior (validation,
lockout, rotation, blacklist) remains in one place.
"""

from __future__ import annotations

from rest_framework import status
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework_simplejwt.authentication import JWTAuthentication

from apps.core.api.views import BaseAPIView
from apps.identity.api.serializers.authentication import (
    LoginSerializer,
    LogoutSerializer,
    RefreshSerializer,
)
from apps.identity.api.serializers.frontend_user import serialize_frontend_user
from apps.identity.services.authentication import AuthenticationService
from drf_spectacular.types import OpenApiTypes
from drf_spectacular.utils import extend_schema
from django.contrib.auth import get_user_model

User = get_user_model()


class AuthLoginView(BaseAPIView):
    """Frontend-compatible login: wraps identity login with tokens+user envelope."""

    authentication_classes = ()
    permission_classes = (AllowAny,)
    serializer_class = LoginSerializer

    @extend_schema(
        request=LoginSerializer,
        responses={200: OpenApiTypes.OBJECT},
        description="Frontend-compatible login. Returns {tokens:{access,refresh}, user}",
    )
    def post(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.save()  # {access, refresh, session}

        # Resolve user for frontend payload (email is normalized to lower)
        email = serializer.validated_data.get("email") or serializer.validated_data.get("username") or request.data.get("email")
        user = None
        if email:
            try:
                user = User.objects.get(email__iexact=email)
            except User.DoesNotExist:
                user = request.user if request.user and request.user.is_authenticated else None
        else:
            user = request.user if request.user and request.user.is_authenticated else None

        # In cases where AuthenticationService already logged in request.user, prefer that
        if request.user and request.user.is_authenticated:
            user = request.user

        frontend_user = serialize_frontend_user(user, request) if user else None

        return Response(
            {
                "tokens": {
                    "access": data.get("access"),
                    "refresh": data.get("refresh"),
                },
                "user": frontend_user,
            },
            status=status.HTTP_200_OK,
        )


class AuthRefreshView(BaseAPIView):
    """Frontend-compatible refresh: accepts {refresh} returns {access}."""

    authentication_classes = ()
    permission_classes = (AllowAny,)
    serializer_class = RefreshSerializer

    @extend_schema(
        request=RefreshSerializer,
        responses={200: OpenApiTypes.OBJECT},
        description="Refresh access token. Request {refresh} -> {access}",
    )
    def post(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.save()  # {access, refresh} (refresh rotated)
        # Frontend contract expects only {access}
        return Response(
            {"access": data.get("access")},
            status=status.HTTP_200_OK,
        )


class AuthLogoutView(BaseAPIView):
    """Frontend-compatible logout: clears session and blacklists refresh if provided."""

    authentication_classes = (JWTAuthentication,)
    permission_classes = (IsAuthenticated,)

    serializer_class = LogoutSerializer

    @extend_schema(
        request=LogoutSerializer,
        responses={200: OpenApiTypes.OBJECT},
        description="Logout. Frontend clears tokens regardless of outcome.",
    )
    def post(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(
            {"detail": "Logged out successfully."},
            status=status.HTTP_200_OK,
        )


class AuthMeView(BaseAPIView):
    """Frontend-compatible current user: returns FrontendUser."""

    authentication_classes = (JWTAuthentication,)
    permission_classes = (IsAuthenticated,)

    @extend_schema(
        responses={200: OpenApiTypes.OBJECT},
        description="Return current authenticated user in frontend shape.",
    )
    def get(self, request, *args, **kwargs):
        user = request.user
        data = serialize_frontend_user(user, request)
        return Response(data, status=status.HTTP_200_OK)
