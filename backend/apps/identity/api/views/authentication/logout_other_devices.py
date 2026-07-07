from apps.core.api.views import BaseAPIView
from rest_framework import status
from rest_framework.response import Response

from apps.identity.selectors.user_session import (
    UserSessionSelector,
)
from apps.identity.services.authentication import (
    AuthenticationService,
)


class LogoutOtherDevicesAPIView(
    BaseAPIView,
):
    def post(
        self,
        request,
        *args,
        **kwargs,
    ):
        session = UserSessionSelector.current(
            user=request.user,
        )

        count = AuthenticationService.logout_other_devices(
            current_session=session,
        )

        return Response(
            {
                "sessions": count,
            },
            status=status.HTTP_200_OK,
        )
