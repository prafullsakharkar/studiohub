from rest_framework import status
from rest_framework.viewsets import ModelViewSet

from .responses import APIResponse


class BaseViewSet(ModelViewSet):
    """
    Base ViewSet for all API endpoints.
    """

    def success_response(
        self,
        *,
        data=None,
        message="",
        status_code=status.HTTP_200_OK,
        meta=None,
    ):
        return APIResponse(
            request=self.request,
            data=data,
            message=message,
            status=status_code,
            meta=meta,
        )

    def created_response(
        self,
        *,
        data=None,
        message="Created successfully.",
    ):
        return self.success_response(
            data=data,
            message=message,
            status_code=status.HTTP_201_CREATED,
        )

    def no_content_response(self):
        return self.success_response(
            data=None,
            message="Deleted successfully.",
            status_code=status.HTTP_204_NO_CONTENT,
        )
