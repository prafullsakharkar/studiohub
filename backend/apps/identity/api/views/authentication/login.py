from apps.core.api.views import BaseAPIView
from rest_framework import status
from rest_framework.permissions import AllowAny
from rest_framework.response import Response

from apps.identity.api.serializers.authentication import (
    LoginSerializer,
)


class LoginAPIView(BaseAPIView):
    """
    User Login API.
    """

    authentication_classes = ()

    permission_classes = (AllowAny,)

    serializer_class = LoginSerializer

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
