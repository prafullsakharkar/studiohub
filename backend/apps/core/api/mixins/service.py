"""
Service mixins for DRF ViewSets.
"""

from __future__ import annotations

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

    def perform_create(self, serializer: serializers.Serializer):
        service = self.get_service()

        create = getattr(service, self.create_method)

        instance = create(
            **serializer.validated_data,
        )

        serializer.instance = instance

    def perform_update(self, serializer: serializers.Serializer):
        service = self.get_service()

        update = getattr(service, self.update_method)

        instance = update(
            serializer.instance,
            **serializer.validated_data,
        )

        serializer.instance = instance

    def perform_destroy(self, instance):
        service = self.get_service()

        destroy = getattr(service, self.destroy_method)

        destroy(instance)
