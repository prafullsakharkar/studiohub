from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.identity.api.serializers.authentication import (
    RefreshTokenSerializer,
)


class RefreshAPIView(APIView):

    permission_classes = (AllowAny,)

    authentication_classes = ()

    serializer_class = RefreshTokenSerializer

    def post(self, request):

        serializer = self.serializer_class(
            data=request.data,
        )

        serializer.is_valid(
            raise_exception=True,
        )

        return Response(
            serializer.save(),
        )
