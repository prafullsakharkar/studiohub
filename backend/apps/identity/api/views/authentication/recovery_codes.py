from drf_spectacular.types import OpenApiTypes
from drf_spectacular.utils import extend_schema

from apps.core.api.throttling import FailClosedScopedRateThrottle
from apps.core.api.views import BaseAPIView
from apps.identity.api.serializers.authentication import (
    MFAReauthSerializer,
    RecoveryCodeVerifySerializer,
)
from apps.identity.api.views.mfa_support import (
    bad_request,
    mfa_http_errors,
    ok,
)
from apps.identity.models import UserMFA
from apps.identity.services.mfa import MFAService


class MFARecoveryCodesAPIView(BaseAPIView):
    """
    GET reports how many recovery codes remain; it never creates or shows
    codes (API-MFA-04). POST regenerates them after re-authentication and
    returns the new set once (API-MFA-05).
    """

    serializer_class = MFAReauthSerializer

    throttle_classes = (FailClosedScopedRateThrottle,)

    throttle_scope = "sensitive"

    @extend_schema(responses=OpenApiTypes.OBJECT)
    def get(self, request, *args, **kwargs):
        return ok(
            data={
                "remaining": MFAService.remaining_recovery_codes(
                    user=request.user,
                ),
            },
        )

    @extend_schema(request=MFAReauthSerializer, responses=OpenApiTypes.OBJECT)
    def post(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        mfa = UserMFA.objects.filter(user=request.user).first()

        if mfa is None or not mfa.requires_challenge:
            return bad_request("MFA is not enabled.")

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

        return ok(data={"codes": codes})


class MFARecoveryVerifyAPIView(BaseAPIView):
    throttle_classes = (FailClosedScopedRateThrottle,)

    throttle_scope = "sensitive"

    serializer_class = RecoveryCodeVerifySerializer

    def post(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        with mfa_http_errors():
            success = MFAService.verify_recovery_code(
                user=request.user,
                code=serializer.validated_data["code"],
                request=request,
            )

        if not success:
            return bad_request("Invalid recovery code.")

        return ok(message="Recovery code accepted.")
