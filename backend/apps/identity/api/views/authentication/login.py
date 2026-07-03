from rest_framework.response import Response
from rest_framework.views import APIView

from apps.identity.api.serializers.authentication.login import LoginSerializer


class LoginAPIView(APIView):

    permission_classes = ()

    authentication_classes = ()

    serializer_class = LoginSerializer

    def post(self, request):

        serializer = self.serializer_class(
            data=request.data,
        )

        serializer.is_valid(
            raise_exception=True,
        )

        return Response(
            serializer.validated_data,
        )
