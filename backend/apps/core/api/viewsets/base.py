"""
Base ViewSets.
"""

from __future__ import annotations

from django.core.exceptions import ValidationError
from django.http import Http404
from django.shortcuts import get_object_or_404
from rest_framework import viewsets

from apps.core.api.mixins import (
    ContextMixin,
    ErrorMixin,
    FilteringMixin,
    PaginationMixin,
    PermissionMixin,
    QuerysetMixin,
    ResponseMixin,
)
from apps.core.permissions.base import IsAuthenticatedPermission


class BaseViewSet(
    ResponseMixin,
    ContextMixin,
    ErrorMixin,
    FilteringMixin,
    PaginationMixin,
    PermissionMixin,
    QuerysetMixin,
    viewsets.GenericViewSet,
):
    """
    Root ViewSet for the project.

    Every ViewSet should inherit from this class.
    """

    permission_classes = (IsAuthenticatedPermission,)

    permission_map = {}

    def get_object(self):
        """
        Resolve the URL lookup against the UUID primary key.

        ``UUIDModel`` exposes ``uuid`` as a property alias for the ``id``
        primary key field. DRF can only filter real fields, so a
        ``lookup_field = "uuid"`` would raise FieldError. Translate the
        lookup to the ``id`` field instead.
        """
        queryset = self.filter_queryset(self.get_queryset())

        lookup_url_kwarg = self.lookup_url_kwarg or self.lookup_field

        lookup_value = self.kwargs[lookup_url_kwarg]

        filter_kwargs = self.get_object_filter_kwargs(lookup_value)

        try:
            obj = get_object_or_404(queryset, **filter_kwargs)
        except ValidationError:
            # Invalid UUID (or other malformed lookup value) must 404,
            # not 500.
            raise Http404

        self.check_object_permissions(self.request, obj)

        return obj

    def get_object_filter_kwargs(self, lookup_value):
        """
        Build the filter kwargs used to resolve the detail object.
        
        Supports UUID lookup (translates to 'id') and code lookup for models
        that have a 'code' field.
        """
        if self.lookup_field == "uuid":
            return {"id": lookup_value}

        return {self.lookup_field: lookup_value}

    def get_permission_required(self):
        """
        Return the permissions required for the current action.

        Returns the full tuple from ``permission_map`` so consumers (e.g.
        ``apps.identity.permissions.HasPermission``) can iterate over every
        required permission code.
        """

        permissions = self.permission_map.get(
            self.action,
            (),
        )

        if not permissions:
            return None

        return permissions


class ServiceModelViewSet(BaseViewSet):
    """
    Base ViewSet for service-based model operations.

    Provides a base implementation that uses selectors and services
    for data access and business logic.
    """

    selector_class = None
    service_class = None

    def get_queryset(self):
        """
        Get queryset using selector if available.
        """
        if self.selector_class:
            return self.selector_class.get_queryset(
                request=self.request,
                view=self,
            )
        return super().get_queryset()

    def get_serializer_context(self):
        """
        Add request to serializer context.
        """
        context = super().get_serializer_context()
        context["request"] = self.request
        return context
