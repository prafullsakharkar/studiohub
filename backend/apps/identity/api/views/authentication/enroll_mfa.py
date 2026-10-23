from apps.core.api.throttling import FailClosedScopedRateThrottle
from apps.core.api.views import BaseAPIView
from apps.identity.api.serializers.authentication import (
    MFAEnrollResponseSerializer,
    MFAEnrollSerializer,
)
from apps.identity.api.views.mfa_support import mfa_http_errors, ok
from apps.identity.services.mfa import MFAService


class MFAEnrollAPIView(BaseAPIView):
    """
    Start TOTP enrollment. The secret is returned here, once, while the
    enrollment is PENDING; MFA is not enabled until a code is verified.
    """

    throttle_classes = (FailClosedScopedRateThrottle,)

    throttle_scope = "sensitive"

    serializer_class = MFAEnrollSerializer

    def post(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        with mfa_http_errors():
            mfa = MFAService.enroll(
                user=request.user,
                method=serializer.validated_data["method"],
                request=request,
            )

        data = {
            "secret": mfa.secret,
            "provisioning_uri": MFAService.provisioning_uri(
                user=request.user,
            ),
            "qr_code": MFAService.qr_code(
                user=request.user,
            ),
        }

        return ok(data=MFAEnrollResponseSerializer(data).data)
