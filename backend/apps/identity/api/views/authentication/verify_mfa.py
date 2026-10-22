from apps.core.api.views import BaseAPIView
from apps.identity.api.serializers.authentication import (
    MFAVerifySerializer,
)
from apps.identity.api.views.mfa_support import (
    bad_request,
    mfa_http_errors,
    ok,
)
from apps.identity.choices.mfa import MFAStatus
from apps.identity.models import UserMFA
from apps.identity.services.mfa import MFAService


class MFAVerifyAPIView(BaseAPIView):
    """
    Verify a TOTP code for the signed-in user.

    While enrollment is PENDING a valid code activates MFA and returns the
    one-time recovery codes (API-MFA-02). Once enabled it is a step-up check.
    """

    serializer_class = MFAVerifySerializer

    def post(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        code = serializer.validated_data["code"]

        pending = UserMFA.objects.filter(
            user=request.user,
            status=MFAStatus.PENDING,
        ).exists()

        data = None

        with mfa_http_errors():
            if pending:
                data = {
                    "recovery_codes": MFAService.activate(
                        user=request.user,
                        code=code,
                        request=request,
                    ),
                }
            elif not MFAService.verify(
                user=request.user,
                code=code,
                request=request,
            ):
                return bad_request("Invalid verification code.")

        response = ok(
            data=data,
            message="MFA verified successfully.",
        )

        if serializer.validated_data["remember_device"]:
            MFAService.register_device(
                user=request.user,
                request=request,
            )

            MFAService.create_cookie(
                response=response,
                request=request,
                user=request.user,
            )

        return response
