from __future__ import annotations

from rest_framework.permissions import IsAuthenticated
from rest_framework.views import APIView


class BaseAPIView(APIView):
    """
    Base APIView.
    """

    authentication_classes = ()

    permission_classes = (IsAuthenticated,)

    serializer_class = None

    def get_serializer_class(self):
        assert self.serializer_class is not None

        return self.serializer_class

    def get_serializer_context(self):
        return {
            "request": self.request,
            "view": self,
        }

    def get_serializer(
        self,
        *args,
        **kwargs,
    ):
        kwargs.setdefault(
            "context",
            self.get_serializer_context(),
        )

        return self.get_serializer_class()(
            *args,
            **kwargs,
        )
