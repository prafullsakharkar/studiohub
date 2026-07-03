from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.identity.api.serializers.authentication import (
    ResetPasswordSerializer,
)


class ResetPasswordAPIView(APIView):
    """
    Reset user password using a valid reset token.
    """

    permission_classes = (AllowAny,)

    authentication_classes = ()

    serializer_class = ResetPasswordSerializer

    def post(self, request, *args, **kwargs):
        serializer = self.serializer_class(
            data=request.data,
        )

        serializer.is_valid(
            raise_exception=True,
        )

        serializer.save()

        return Response(
            {
                "detail": "Password has been reset successfully.",
            }
        )
