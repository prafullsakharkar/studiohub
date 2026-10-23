from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.core.api.throttling import FailClosedScopedRateThrottle
from apps.identity.api.serializers.authentication import ForgotPasswordSerializer


class ForgotPasswordAPIView(APIView):
    """
    Request a password reset link.

    Always returns the same message so the endpoint cannot be used to enumerate
    accounts. Throttled to limit email-bombing.
    """

    permission_classes = (AllowAny,)
    authentication_classes = ()
    serializer_class = ForgotPasswordSerializer
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
                "detail": "If an account exists, a password reset email has been sent.",
            }
        )
