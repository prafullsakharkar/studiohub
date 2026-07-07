from apps.core.api.views import BaseAPIView
from rest_framework import status
from rest_framework.response import Response

from apps.identity.api.serializers.authentication import (
    RefreshSerializer,
)


class RefreshAPIView(
    BaseAPIView,
):
    authentication_classes = ()

    permission_classes = ()

    serializer_class = RefreshSerializer

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

        data = serializer.save()

        return Response(
            data,
            status=status.HTTP_200_OK,
        )
