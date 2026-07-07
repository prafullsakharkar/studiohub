from apps.core.api.views import BaseAPIView
from rest_framework.response import Response

from apps.identity.api.serializers.authentication import (
    MeSerializer,
)
from apps.identity.services.authentication import (
    AuthenticationService,
)


class MeAPIView(
    BaseAPIView,
):
    serializer_class = MeSerializer

    def get(
        self,
        request,
        *args,
        **kwargs,
    ):
        data = AuthenticationService.me(
            user=request.user,
        )

        serializer = self.get_serializer(
            data,
        )

        return Response(
            serializer.data,
        )
