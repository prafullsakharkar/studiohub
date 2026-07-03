from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.identity.api.serializers.authentication import (
    VerifyEmailSerializer,
)


class VerifyEmailAPIView(APIView):

    permission_classes = (AllowAny,)

    authentication_classes = ()

    serializer_class = VerifyEmailSerializer

    def post(self, request):

        serializer = self.serializer_class(
            data=request.data,
        )

        serializer.is_valid(
            raise_exception=True,
        )

        serializer.save()

        return Response(
            {
                "detail": "Email verified successfully.",
            }
        )
