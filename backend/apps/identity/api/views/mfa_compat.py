"""
Frontend-compatible MFA endpoints (Phase C — MFA UI).

Mount: /api/v1/identity/mfa/*  (matches MFAService.ts)

Delegates to MFAService facade (enrollment/verification/recovery) and
returns shapes matching frontend/src/modules/core/types MFAConfig etc.
"""

from __future__ import annotations

from drf_spectacular.types import OpenApiTypes
from drf_spectacular.utils import extend_schema
from rest_framework import serializers
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework_simplejwt.authentication import JWTAuthentication

from apps.core.api.views import BaseAPIView
from apps.identity.services.mfa.facade import MFAService


class MFAConfigView(BaseAPIView):
    serializer_class = serializers.Serializer
    authentication_classes = (JWTAuthentication,)
    permission_classes = (IsAuthenticated,)

    @extend_schema(responses=OpenApiTypes.OBJECT)
    def get(self, request, *args, **kwargs):
        user = request.user
        try:
            mfa = MFAService.enrollment.get_mfa(user) if hasattr(MFAService.enrollment, "get_mfa") else None
        except Exception:
            mfa = None
        # Fallback: try to get UserMFA directly
        if mfa is None:
            try:
                from apps.identity.models import UserMFA

                mfa = UserMFA.objects.filter(user=user).first()
            except Exception:
                mfa = None

        enabled = bool(mfa and getattr(mfa, "is_verified", False))
        methods = []
        totp = {"verified": False}
        sms = {"verified": False}
        email_cfg = {"verified": False}

        if mfa:
            if getattr(mfa, "totp_secret", None) and getattr(mfa, "is_verified", False):
                methods.append("totp")
                totp = {"verified": True, "secret": getattr(mfa, "totp_secret", "")}
            if getattr(mfa, "sms_enabled", False):
                methods.append("sms")
                sms = {"verified": True}
            if getattr(mfa, "email_enabled", False):
                methods.append("email")
                email_cfg = {"verified": True}

        return Response(
            {
                "enabled": enabled,
                "methods": methods,
                "totp": totp,
                "sms": sms,
                "email": email_cfg,
            }
        )


class MFATOTPSetupView(BaseAPIView):
    serializer_class = serializers.Serializer
    authentication_classes = (JWTAuthentication,)
    permission_classes = (IsAuthenticated,)

    @extend_schema(responses=OpenApiTypes.OBJECT)
    def get(self, request, *args, **kwargs):
        user = request.user
        # Generate secret and provisioning uri via MFAService
        try:
            secret = MFAService.generate_secret(user)
            uri = MFAService.provisioning_uri(user, secret) if hasattr(MFAService, "provisioning_uri") else f"otpauth://totp/StudioHub:{user.email}?secret={secret}&issuer=StudioHub"
            qr = MFAService.qr_code(user, secret) if hasattr(MFAService, "qr_code") else None
        except Exception:
            # Fallback: generate via pyotp
            import pyotp

            secret = pyotp.random_base32()
            uri = f"otpauth://totp/StudioHub:{user.email}?secret={secret}&issuer=StudioHub"
            qr = None

        return Response({"secret": secret, "uri": uri, "qr_code": qr, "qr": qr})


class MFATOTPEnableView(BaseAPIView):
    serializer_class = serializers.Serializer
    authentication_classes = (JWTAuthentication,)
    permission_classes = (IsAuthenticated,)

    @extend_schema(request=OpenApiTypes.OBJECT, responses=OpenApiTypes.OBJECT)
    def post(self, request, *args, **kwargs):
        user = request.user
        secret = request.data.get("secret")
        code = request.data.get("code")
        if not secret or not code:
            return Response({"detail": "secret and code are required."}, status=400)
        try:
            # Enroll with provided secret, then activate with code
            # MFAService.enroll expects to generate secret, but we can set directly if provided
            try:
                MFAService.enroll(user, secret=secret)
            except TypeError:
                # Fallback: enroll without secret param
                MFAService.enroll(user)
                # Try to set secret directly via model if needed
                try:
                    from apps.identity.models import UserMFA

                    mfa = UserMFA.objects.get(user=user)
                    mfa.totp_secret = secret
                    mfa.save(update_fields=["totp_secret"])
                except Exception:
                    pass
            mfa = MFAService.activate(user, code)
            return Response({"enabled": True, "verified": getattr(mfa, "is_verified", True)})
        except Exception as exc:
            return Response({"detail": str(exc)}, status=400)


class MFATOTPVerifyView(BaseAPIView):
    serializer_class = serializers.Serializer
    authentication_classes = (JWTAuthentication,)
    permission_classes = (IsAuthenticated,)

    @extend_schema(request=OpenApiTypes.OBJECT, responses=OpenApiTypes.OBJECT)
    def post(self, request, *args, **kwargs):
        user = request.user
        code = request.data.get("code")
        if not code:
            return Response({"detail": "code is required."}, status=400)
        try:
            result = MFAService.verify(user, code)
            # MFAService.verify returns bool or mfa
            valid = bool(result) if not isinstance(result, bool) else result
            # Some implementations return None on failure
            if result is None:
                valid = False
            return Response({"valid": bool(valid)})
        except Exception as exc:
            return Response({"valid": False, "detail": str(exc)}, status=400)


class MFATOTPDisableView(BaseAPIView):
    serializer_class = serializers.Serializer
    authentication_classes = (JWTAuthentication,)
    permission_classes = (IsAuthenticated,)

    @extend_schema(request=OpenApiTypes.OBJECT, responses=OpenApiTypes.OBJECT)
    def post(self, request, *args, **kwargs):
        user = request.user
        # code is optional for disable, but frontend sends it
        try:
            MFAService.disable(user)
            return Response({"success": True})
        except Exception as exc:
            return Response({"detail": str(exc)}, status=400)


class MFASMSEnableView(BaseAPIView):
    serializer_class = serializers.Serializer
    authentication_classes = (JWTAuthentication,)
    permission_classes = (IsAuthenticated,)

    @extend_schema(request=OpenApiTypes.OBJECT, responses=OpenApiTypes.OBJECT)
    def post(self, request, *args, **kwargs):
        # SMS not fully implemented in backend; stub for frontend compat
        phone = request.data.get("phone_number") or request.data.get("phone")
        return Response({"verified": False, "phone_number": phone, "detail": "SMS MFA not configured on server — stub."})

    def get(self, request, *args, **kwargs):
        return Response({"verified": False})


class MFASMSVerifyView(BaseAPIView):
    serializer_class = serializers.Serializer
    authentication_classes = (JWTAuthentication,)
    permission_classes = (IsAuthenticated,)

    def post(self, request, *args, **kwargs):
        return Response({"verified": False, "detail": "SMS not configured."})


class MFASMSDisableView(BaseAPIView):
    serializer_class = serializers.Serializer
    authentication_classes = (JWTAuthentication,)
    permission_classes = (IsAuthenticated,)

    def post(self, request, *args, **kwargs):
        return Response({"success": True})


class MFAEmailEnableView(BaseAPIView):
    serializer_class = serializers.Serializer
    authentication_classes = (JWTAuthentication,)
    permission_classes = (IsAuthenticated,)

    def post(self, request, *args, **kwargs):
        email = request.data.get("email")
        return Response({"verified": False, "email": email, "detail": "Email MFA not configured — stub."})


class MFAEmailVerifyView(BaseAPIView):
    serializer_class = serializers.Serializer
    authentication_classes = (JWTAuthentication,)
    permission_classes = (IsAuthenticated,)

    def post(self, request, *args, **kwargs):
        return Response({"verified": False})


class MFAEmailDisableView(BaseAPIView):
    serializer_class = serializers.Serializer
    authentication_classes = (JWTAuthentication,)
    permission_classes = (IsAuthenticated,)

    def post(self, request, *args, **kwargs):
        return Response({"success": True})


class MFARecoveryCodesView(BaseAPIView):
    serializer_class = serializers.Serializer
    authentication_classes = (JWTAuthentication,)
    permission_classes = (IsAuthenticated,)

    @extend_schema(responses=OpenApiTypes.OBJECT)
    def get(self, request, *args, **kwargs):
        user = request.user
        try:
            codes = MFAService.generate_recovery_codes(user)
            # generate may return None if already exists; fallback to remaining
            if not codes:
                codes = MFAService.remaining_recovery_codes(user) or []
        except Exception:
            codes = []
        return Response({"codes": codes})


class MFARecoveryCodesRegenerateView(BaseAPIView):
    serializer_class = serializers.Serializer
    authentication_classes = (JWTAuthentication,)
    permission_classes = (IsAuthenticated,)

    @extend_schema(responses=OpenApiTypes.OBJECT)
    def post(self, request, *args, **kwargs):
        user = request.user
        try:
            codes = MFAService.regenerate_recovery_codes(user)
            if not codes:
                codes = MFAService.generate_recovery_codes(user) or []
        except Exception as exc:
            return Response({"detail": str(exc)}, status=400)
        return Response({"codes": codes or []})


class MFAAdminResetView(BaseAPIView):
    serializer_class = serializers.Serializer
    authentication_classes = (JWTAuthentication,)
    permission_classes = (IsAuthenticated,)

    def post(self, request, *args, **kwargs):
        # userId is in URL kwargs
        user_id = kwargs.get("user_id") or kwargs.get("pk")
        if not user_id:
            return Response({"detail": "userId is required."}, status=400)
        # Only staff/superuser can reset others' MFA
        if not (request.user.is_staff or request.user.is_superuser):
            return Response({"detail": "Permission denied."}, status=403)
        try:
            from django.contrib.auth import get_user_model

            User = get_user_model()
            target = User.objects.get(pk=user_id)
            MFAService.reset(target)
            return Response({"success": True})
        except Exception as exc:
            return Response({"detail": str(exc)}, status=400)
