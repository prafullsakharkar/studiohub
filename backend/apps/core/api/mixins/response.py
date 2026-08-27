"""
API response mixins.
"""

from __future__ import annotations

from rest_framework.response import Response

from apps.core.services.soft_delete import SoftDeleteService


class ResponseMixin:
    """
    Standard API responses.

    Returns raw response bodies with no envelope, matching the frontend API
    contract.
    """

    def success_response(
        self,
        *,
        data=None,
        message="Success.",
        status_code=200,
        meta=None,
    ):
        return Response(data, status=status_code)

    def error_response(
        self,
        *,
        message="Request failed.",
        status_code=400,
        errors=None,
        meta=None,
    ):
        return Response(errors if errors is not None else {"detail": message}, status=status_code)


class ResponseEnvelopeMixin(ResponseMixin):
    """
    Consistent CRUD response overrides for ModelViewSets.

    .. deprecated::
        Historic name. Despite the name, this mixin does **not** wrap
        responses in an envelope: it inherits ``ResponseMixin``, which emits
        raw bodies matching the frontend API contract (see
        ``docs/api/pagination.md`` / ``docs/api/errors.md``). List responses
        are paginated via the viewset's pagination class; create/update/
        retrieve return the serialized object directly.

    Provides:

        - standard list/retrieve/create/update/destroy flow overrides
        - soft-delete for models exposing ``is_deleted``
    """

    resource_name = "Resource"

    def list(self, request, *args, **kwargs):
        """Override list to use custom response format."""
        queryset = self.filter_queryset(self.get_queryset())

        page = self.paginate_queryset(queryset)
        if page is not None:
            serializer = self.get_serializer(page, many=True)
            data = serializer.data
            return self.get_paginated_response(data)

        serializer = self.get_serializer(queryset, many=True)
        return self.success_response(
            data=serializer.data,
            message=f"{self.resource_name} list retrieved successfully.",
        )

    def retrieve(self, request, *args, **kwargs):
        """Override retrieve to use custom response format."""
        instance = self.get_object()
        serializer = self.get_serializer(instance)
        return self.success_response(
            data=serializer.data,
            message=f"{self.resource_name} retrieved successfully.",
        )

    def create(self, request, *args, **kwargs):
        """Override create to use custom response format."""
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        self.perform_create(serializer)
        headers = self.get_success_headers(serializer.data)
        return self.success_response(
            data=serializer.data,
            message=f"{self.resource_name} created successfully.",
            status_code=201,
        )

    def update(self, request, *args, **kwargs):
        """Override update to use custom response format."""
        partial = kwargs.pop("partial", False)
        instance = self.get_object()
        serializer = self.get_serializer(instance, data=request.data, partial=partial)
        serializer.is_valid(raise_exception=True)
        self.perform_update(serializer)
        return self.success_response(
            data=serializer.data,
            message=f"{self.resource_name} updated successfully.",
        )

    def partial_update(self, request, *args, **kwargs):
        """Override partial_update to use custom response format."""
        kwargs["partial"] = True
        return self.update(request, *args, **kwargs)

    def destroy(self, request, *args, **kwargs):
        """Override destroy to use custom response format."""
        instance = self.get_object()
        self.perform_destroy(instance)
        return self.success_response(
            data=None,
            message=f"{self.resource_name} deleted successfully.",
            status_code=204,
        )

    def perform_destroy(self, instance):
        """
        Soft-delete soft-deletable models, hard-delete everything else.

        Matches the Core soft-delete contract described in ARCHITECTURE.md.
        """
        if hasattr(instance, "is_deleted"):
            SoftDeleteService.delete(
                instance,
                user=getattr(self.request, "user", None),
            )
        else:
            super().perform_destroy(instance)
