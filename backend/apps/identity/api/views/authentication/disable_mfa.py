from apps.core.api.views import BaseAPIView
from apps.identity.api.serializers.authentication import (
    MFADisableSerializer,
)
from apps.identity.api.views.mfa_support import mfa_http_errors, ok
from apps.identity.services.mfa import MFAService


class MFADisableAPIView(BaseAPIView):
    """
    Disable MFA (API-MFA-03): needs the password and a valid second factor,
    and discards trusted devices and recovery codes.
    """

    serializer_class = MFADisableSerializer

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

        response = ok(message="MFA disabled successfully.")

        MFAService.delete_cookie(response=response)

        return response
