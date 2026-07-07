from apps.core.api.views import BaseAPIView
from rest_framework import status
from rest_framework.response import Response

from apps.identity.services.authentication import (
    AuthenticationService,
)


class LogoutAllAPIView(
    BaseAPIView,
):
    def post(
        self,
        request,
        *args,
        **kwargs,
    ):
        count = AuthenticationService.logout_all(
            user=request.user,
        )

        return Response(
            {
                "sessions": count,
            },
            status=status.HTTP_200_OK,
        )
