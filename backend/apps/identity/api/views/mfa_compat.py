"""
Frontend-compatible MFA endpoints.

Mount: /api/v1/identity/mfa/*  (matches MFAService.ts)

Delegates to the MFAService facade and returns the shapes the former
frontend expects. Semantics match the canonical tree (API-MFA-10):

- the TOTP secret is generated and held by the server; a client-supplied
  secret is never accepted,
- MFA is enabled only by presenting a valid code for the pending secret,
- disabling and recovery-code regeneration need the password and a valid
  second factor,
- SMS and e-mail MFA are not offered (decision A8).
"""

from __future__ import annotations

from typing import Any

from drf_spectacular.types import OpenApiTypes
from drf_spectacular.utils import extend_schema
from rest_framework import serializers
from rest_framework.exceptions import NotFound, PermissionDenied
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from apps.core.api.views import BaseAPIView
from apps.identity.api.serializers.authentication import MFAReauthSerializer
from apps.identity.api.views.mfa_support import mfa_http_errors
from apps.identity.authentication.session_bound_jwt import SessionBoundJWTAuthentication
from apps.identity.models import UserMFA
from apps.identity.services.mfa.facade import MFAService


class MFABaseView(BaseAPIView):
    serializer_class = serializers.Serializer
    authentication_classes = (SessionBoundJWTAuthentication,)
    permission_classes = (IsAuthenticated,)


class CodeSerializer(serializers.Serializer[Any]):
    code = serializers.CharField(max_length=10)


class MFAConfigView(MFABaseView):
    @extend_schema(responses=OpenApiTypes.OBJECT)
    def get(self, request, *args, **kwargs):
        mfa = UserMFA.objects.filter(user=request.user).first()

        enabled = bool(mfa and mfa.requires_challenge)

        # The stored TOTP secret is never returned (DOM-MFA-02); the secret of
        # a pending enrollment is shown only by the setup call that made it.
        return Response(
            {
                "enabled": enabled,
                "pending": bool(mfa and mfa.status == "pending"),
                "methods": ["totp"] if enabled else [],
                "totp": {"verified": enabled},
                "sms": {"verified": False},
                "email": {"verified": False},
            }
        )


class MFATOTPSetupView(MFABaseView):
    """Begin enrollment: create a pending secret and return it once."""

    @extend_schema(responses=OpenApiTypes.OBJECT)
    def get(self, request, *args, **kwargs):
        return self._setup(request)

    @extend_schema(responses=OpenApiTypes.OBJECT)
    def post(self, request, *args, **kwargs):
        return self._setup(request)

    def _setup(self, request):
        with mfa_http_errors():
            mfa = MFAService.enroll(user=request.user, request=request)

            uri = MFAService.provisioning_uri(user=request.user)
            qr = MFAService.qr_code(user=request.user)

        return Response({"secret": mfa.secret, "uri": uri, "qr_code": qr, "qr": qr})


class MFATOTPEnableView(MFABaseView):
    """Activate MFA with a code for the pending secret."""

    serializer_class = CodeSerializer

    @extend_schema(request=CodeSerializer, responses=OpenApiTypes.OBJECT)
    def post(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        # Any ``secret`` in the body is ignored: only the server's own
        # pending secret can be activated.
        with mfa_http_errors():
            codes = MFAService.activate(
                user=request.user,
                code=serializer.validated_data["code"],
                request=request,
            )

        return Response(
            {"enabled": True, "verified": True, "recovery_codes": codes},
        )


class MFATOTPVerifyView(MFABaseView):
    serializer_class = CodeSerializer

    @extend_schema(request=CodeSerializer, responses=OpenApiTypes.OBJECT)
    def post(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        with mfa_http_errors():
            valid = MFAService.verify(
                user=request.user,
                code=serializer.validated_data["code"],
                request=request,
            )

        return Response({"valid": bool(valid)})


class MFATOTPDisableView(MFABaseView):
    serializer_class = MFAReauthSerializer

    @extend_schema(request=MFAReauthSerializer, responses=OpenApiTypes.OBJECT)
    def post(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        with mfa_http_errors():
            MFAService.disable_with_reauth(
                user=request.user,
                password=serializer.validated_data["password"],
                code=serializer.validated_data["code"],
                recovery_code=serializer.validated_data["recovery_code"],
                request=request,
            )

        return Response({"success": True})


class MFARecoveryCodesView(MFABaseView):
    """Counts only. Codes are shown once, when issued (API-MFA-04)."""

    @extend_schema(responses=OpenApiTypes.OBJECT)
    def get(self, request, *args, **kwargs):
        return Response(
            {
                "codes": [],
                "remaining": MFAService.remaining_recovery_codes(user=request.user),
            }
        )


class MFARecoveryCodesRegenerateView(MFABaseView):
    serializer_class = MFAReauthSerializer

    @extend_schema(request=MFAReauthSerializer, responses=OpenApiTypes.OBJECT)
    def post(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        mfa = UserMFA.objects.filter(user=request.user).first()

        if mfa is None or not mfa.requires_challenge:
            return Response({"detail": "MFA is not enabled."}, status=400)

        with mfa_http_errors():
            MFAService.reauthenticate(
                user=request.user,
                password=serializer.validated_data["password"],
                code=serializer.validated_data["code"],
                recovery_code=serializer.validated_data["recovery_code"],
                request=request,
            )

            codes = MFAService.regenerate_recovery_codes(
                user=request.user,
                request=request,
            )

        return Response({"codes": codes})


class MFAAdminResetView(MFABaseView):
    """Superuser-only: forget another user's MFA so they can re-enroll."""

    def post(self, request, *args, **kwargs):
        from django.contrib.auth import get_user_model

        user_id = kwargs.get("user_id") or kwargs.get("pk")

        if not request.user.is_superuser:
            raise PermissionDenied("Permission denied.")

        User = get_user_model()

        target = User.objects.filter(pk=user_id).first()

        if target is None:
            raise NotFound("User not found.")

        MFAService.reset(user=target, request=request)

        return Response({"success": True})
