from drf_spectacular.types import OpenApiTypes
from drf_spectacular.utils import extend_schema

from apps.core.api.builders.response import ResponseBuilder
from apps.core.api.views import BaseAPIView
from apps.identity.api.serializers.authentication import (
    RecoveryCodeVerifySerializer,
)
from apps.identity.services.mfa import MFAService


class MFARecoveryCodesAPIView(BaseAPIView):
    @extend_schema(responses=OpenApiTypes.OBJECT)
    def get(self, request, *args, **kwargs):
        codes = MFAService.generate_recovery_codes(
            user=request.user,
        )

        return ResponseBuilder.success(
            data={
                "codes": codes,
            },
        )


class MFARecoveryVerifyAPIView(BaseAPIView):
    serializer_class = RecoveryCodeVerifySerializer

    def post(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        success = MFAService.consume_recovery_code(
            user=request.user,
            code=serializer.validated_data["code"],
        )

        if not success:
            return ResponseBuilder.bad_request(
                message="Invalid recovery code.",
            )

        return ResponseBuilder.success(
            message="Recovery code accepted.",
        )
