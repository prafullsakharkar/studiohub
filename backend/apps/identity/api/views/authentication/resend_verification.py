from rest_framework.response import Response
from rest_framework.views import APIView

from apps.identity.api.serializers.authentication import (
    ResendVerificationSerializer,
)


class ResendVerificationAPIView(APIView):

    serializer_class = ResendVerificationSerializer

    def post(self, request):

        serializer = self.serializer_class(
            data=request.data,
            context={
                "request": request,
            },
        )

        serializer.is_valid(
            raise_exception=True,
        )

        serializer.save()

        return Response(
            {
                "detail": ("Verification email sent."),
            }
        )
