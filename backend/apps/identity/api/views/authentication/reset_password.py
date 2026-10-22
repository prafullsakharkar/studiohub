from __future__ import annotations

from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.core.api.throttling import FailClosedScopedRateThrottle
from apps.identity.api.serializers.authentication import (
    ResetPasswordSerializer,
)


class ResetPasswordAPIView(APIView):
    """
    Consume a single-use, expiring reset token and set a new password.

    The endpoint is intentionally unauthenticated: the caller proves control of
    the account through the emailed token. Every existing session is revoked by
    the service after a successful reset.
    """

    permission_classes = (AllowAny,)
    authentication_classes = ()
    serializer_class = ResetPasswordSerializer
    throttle_classes = (FailClosedScopedRateThrottle,)
    throttle_scope = "password_reset"

    def post(self, request):
        serializer = self.serializer_class(
            data=request.data,
            context={"request": request},
        )
        serializer.is_valid(raise_exception=True)
        serializer.save()

        return Response(
            {
                "detail": "Password has been reset. All sessions have been signed out.",
            }
        )
