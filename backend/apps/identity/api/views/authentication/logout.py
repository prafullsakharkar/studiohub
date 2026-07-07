from apps.core.api.views import BaseAPIView
from rest_framework import status
from rest_framework.response import Response

from apps.identity.api.serializers.authentication import (
    LogoutSerializer,
)


class LogoutAPIView(
    BaseAPIView,
):
    serializer_class = LogoutSerializer

    def post(
        self,
        request,
        *args,
        **kwargs,
    ):
        serializer = self.get_serializer(
            data=request.data,
        )

        serializer.is_valid(
            raise_exception=True,
        )

        serializer.save()

        return Response(
            {
                "detail": "Logged out successfully.",
            },
            status=status.HTTP_200_OK,
        )
