from apps.identity.services.mfa import MFAService

from apps.core.api.builders.response import ResponseBuilder
from apps.core.api.views import BaseAPIView
from apps.identity.api.serializers.authentication import (
    MFAVerifySerializer,
)


class MFAVerifyAPIView(BaseAPIView):
    serializer_class = MFAVerifySerializer

    def post(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        verified = MFAService.verify(
            user=request.user,
            code=serializer.validated_data["code"],
        )

        if not verified:
            return ResponseBuilder.bad_request(
                message="Invalid verification code.",
            )

        response = ResponseBuilder.success(
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
