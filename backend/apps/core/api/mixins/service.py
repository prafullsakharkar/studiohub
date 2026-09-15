"""
Service mixins for DRF ViewSets.
"""

from __future__ import annotations

from typing import Any, cast

from rest_framework import serializers


class ServiceMixin:
    """
    Delegates write operations to the configured service class.

    Subclasses must define:

        service_class
    """

    service_class = None

    create_method = "create"
    update_method = "update"
    destroy_method = "delete"

    def get_service(self):
        if self.service_class is None:
            raise NotImplementedError("service_class must be defined.")
        return self.service_class

    def perform_create(self, serializer: serializers.BaseSerializer[Any]):
        service = self.get_service()

        create = getattr(service, self.create_method)
        writable = cast(serializers.Serializer[Any], serializer)

        instance = create(
            **writable.validated_data,
        )

        writable.instance = instance

    def perform_update(self, serializer: serializers.BaseSerializer[Any]):
        service = self.get_service()

        update = getattr(service, self.update_method)
        writable = cast(serializers.Serializer[Any], serializer)

        instance = update(
            writable.instance,
            **writable.validated_data,
        )

        writable.instance = instance

    def perform_destroy(self, instance):
        if self.service_class is None:
            # No service configured (previously a guaranteed 500 via
            # get_service). Fall back to the Core soft-delete contract:
            # soft-delete when the model supports it, hard-delete otherwise.
            from apps.core.services.soft_delete import SoftDeleteService

            if hasattr(instance, "is_deleted"):
                SoftDeleteService.delete(
                    instance,
                    user=getattr(getattr(self, "request", None), "user", None),
                )
            else:
                instance.delete()
            return

        service = self.get_service()

        destroy = getattr(service, self.destroy_method)

        destroy(instance)
