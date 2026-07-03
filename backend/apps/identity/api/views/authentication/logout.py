from rest_framework.response import Response
from rest_framework.views import APIView

from apps.identity.api.serializers.authentication import LogoutSerializer


class LogoutAPIView(APIView):

    serializer_class = LogoutSerializer

    def post(self, request):

        serializer = self.serializer_class(
            data=request.data,
        )

        serializer.is_valid(
            raise_exception=True,
        )

        return Response(status=204)
