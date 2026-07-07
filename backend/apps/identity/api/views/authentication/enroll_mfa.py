from apps.identity.services.mfa import MFAService

from apps.core.api.builders.response import ResponseBuilder
from apps.core.api.views import BaseAPIView
from apps.identity.api.serializers.authentication import (
    MFAEnrollResponseSerializer,
    MFAEnrollSerializer,
)


class MFAEnrollAPIView(BaseAPIView):
    serializer_class = MFAEnrollSerializer

    def post(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        mfa = MFAService.enroll(
            user=request.user,
            method=serializer.validated_data["method"],
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

        return ResponseBuilder.success(
            data=MFAEnrollResponseSerializer(data).data,
        )
