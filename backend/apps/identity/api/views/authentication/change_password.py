from rest_framework.response import Response
from rest_framework.views import APIView

from apps.core.api.throttling import FailClosedScopedRateThrottle
from apps.identity.api.serializers.authentication import (
    ChangePasswordSerializer,
)


class ChangePasswordAPIView(APIView):
    throttle_classes = (FailClosedScopedRateThrottle,)

    throttle_scope = "sensitive"

    serializer_class = ChangePasswordSerializer

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
                "detail": "Password changed successfully.",
            }
        )
