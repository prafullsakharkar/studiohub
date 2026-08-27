from drf_spectacular.types import OpenApiTypes
from drf_spectacular.utils import extend_schema

from apps.core.api.builders.response import ResponseBuilder
from apps.core.api.views import BaseAPIView
from apps.identity.api.serializers.authentication import (
    TrustedDeviceRevokeSerializer,
)
from apps.identity.services.mfa import MFAService


class TrustedDeviceListAPIView(BaseAPIView):
    @extend_schema(responses=OpenApiTypes.OBJECT)
    def get(self, request, *args, **kwargs):
        devices = MFAService.list_devices(
            user=request.user,
        )

        return ResponseBuilder.success(
            data=devices,
        )


class TrustedDeviceRevokeAPIView(BaseAPIView):
    serializer_class = TrustedDeviceRevokeSerializer

    def post(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        device = MFAService.trusted_devices.trusted_device_selector.get(
            serializer.validated_data["device_id"],
        )

        MFAService.revoke_device(
            device=device,
        )

        return ResponseBuilder.success(
            message="Trusted device revoked.",
        )
