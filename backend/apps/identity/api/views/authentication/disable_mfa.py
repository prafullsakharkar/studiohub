from apps.identity.services.mfa import MFAService
from django.contrib.auth import authenticate

from apps.core.api.builders.response import ResponseBuilder
from apps.core.api.views import BaseAPIView
from apps.identity.api.serializers.authentication import (
    MFADisableSerializer,
)


class MFADisableAPIView(BaseAPIView):
    serializer_class = MFADisableSerializer

    def post(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        if not authenticate(
            username=request.user.email,
            password=serializer.validated_data["password"],
        ):
            return ResponseBuilder.bad_request(
                message="Invalid password.",
            )

        MFAService.disable(
            user=request.user,
        )

        response = ResponseBuilder.success(
            message="MFA disabled successfully.",
        )

        MFAService.delete_cookie(response=response)

        return response
