from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.identity.api.serializers.authentication import ForgotPasswordSerializer


class ForgotPasswordAPIView(APIView):

    permission_classes = (AllowAny,)

    authentication_classes = ()

    serializer_class = ForgotPasswordSerializer

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
                "detail": "If an account exists, a password reset email has been sent.",
            }
        )
