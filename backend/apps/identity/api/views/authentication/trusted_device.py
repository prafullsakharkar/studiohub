from django.core.exceptions import ObjectDoesNotExist
from drf_spectacular.types import OpenApiTypes
from drf_spectacular.utils import extend_schema
from rest_framework.response import Response

from apps.core.api.builders.response import ResponseBuilder
from apps.core.api.views import BaseAPIView
from apps.identity.api.serializers.authentication import (
    TrustedDeviceRevokeSerializer,
)
from apps.identity.api.serializers.user_preference import (
    TrustedDeviceListSerializer,
)
from apps.identity.services.mfa import MFAService


class TrustedDeviceListAPIView(BaseAPIView):
    @extend_schema(responses=OpenApiTypes.OBJECT)
    def get(self, request, *args, **kwargs):
        devices = MFAService.list_devices(
            user=request.user,
        )

        return Response(
            ResponseBuilder.success(
                data=TrustedDeviceListSerializer(devices, many=True).data,
            ),
        )


class TrustedDeviceRevokeAPIView(BaseAPIView):
    serializer_class = TrustedDeviceRevokeSerializer

    def post(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        # Resolve by explicit filters: never positional (selector ``get``
        # treats the first positional arg as the model class), and always
        # ownership-scoped — no superuser bypass on this surface (admin
        # reset lives on the dedicated MFA admin endpoint).
        try:
            device = MFAService.trusted_devices.trusted_device_selector.get(
                pk=serializer.validated_data["device_id"],
                user=request.user,
            )
        except ObjectDoesNotExist:
            return Response(
                ResponseBuilder.error(
                    message="Trusted device not found.",
                    status_code=404,
                ),
                status=404,
            )

        MFAService.revoke_device(
            device=device,
        )

        return Response(
            ResponseBuilder.success(
                message="Trusted device revoked.",
            ),
            status=200,
        )
