"""
Bulk Operations Mixin.

This mixin provides bulk create, update, and delete operations for ViewSets.
"""
from __future__ import annotations

from rest_framework import serializers
from rest_framework.response import Response

from apps.core.api.utils.response import ResponseUtils


class BulkCreateMixin:
    """
    Mixin for bulk create operations.
    """

    bulk_create_serializer_class: type[serializers.Serializer] | None = None

    def get_bulk_create_serializer(self) -> type[serializers.Serializer]:
        """Get the serializer class for bulk create."""
        if self.bulk_create_serializer_class is None:
            raise NotImplementedError(
                "bulk_create_serializer_class must be defined."
            )
        return self.bulk_create_serializer_class

    def bulk_create(self, request, *args, **kwargs) -> Response:
        """Handle bulk create operations."""
        serializer_class = self.get_bulk_create_serializer()
        serializer = serializer_class(
            data=request.data, many=True, context=self.get_serializer_context()
        )
        serializer.is_valid(raise_exception=True)

        # Get service class if available
        if hasattr(self, "service_class") and self.service_class:
            service = self.service_class()
            created_objects = service.bulk_create(
                objects=serializer.validated_data
            )
            output_serializer = self.get_serializer(
                created_objects, many=True, context=self.get_serializer_context()
            )
            return ResponseUtils.success(
                message="Bulk create completed successfully.",
                data={
                    "processed": len(created_objects),
                    "successful": len(created_objects),
                    "failed": 0,
                    "results": output_serializer.data,
                },
            )

        # Fallback to direct creation
        objs = [self.serializer_class().Meta.model(**data) for data in serializer.validated_data]
        created_objs = self.serializer_class().Meta.model.objects.bulk_create(objs)

        return ResponseUtils.success(
            message="Bulk create completed successfully.",
            data={
                "processed": len(created_objs),
                "successful": len(created_objs),
                "failed": 0,
            },
        )


class BulkUpdateMixin:
    """
    Mixin for bulk update operations.
    """

    bulk_update_serializer_class: type[serializers.Serializer] | None = None

    def get_bulk_update_serializer(self) -> type[serializers.Serializer]:
        """Get the serializer class for bulk update."""
        if self.bulk_update_serializer_class is None:
            raise NotImplementedError(
                "bulk_update_serializer_class must be defined."
            )
        return self.bulk_update_serializer_class

    def bulk_update(self, request, *args, **kwargs) -> Response:
        """Handle bulk update operations."""
        serializer_class = self.get_bulk_update_serializer()
        serializer = serializer_class(
            data=request.data, many=True, context=self.get_serializer_context()
        )
        serializer.is_valid(raise_exception=True)

        # Get service class if available
        if hasattr(self, "service_class") and self.service_class:
            service = self.service_class()
            updated_objects = service.bulk_update(
                objects=serializer.validated_data
            )
            output_serializer = self.get_serializer(
                updated_objects, many=True, context=self.get_serializer_context()
            )
            return ResponseUtils.success(
                message="Bulk update completed successfully.",
                data={
                    "processed": len(updated_objects),
                    "successful": len(updated_objects),
                    "failed": 0,
                    "results": output_serializer.data,
                },
            )

        # Fallback to direct update
        objects_data = serializer.validated_data
        ids = [obj["id"] for obj in objects_data]
        existing_objects = {
            obj.id: obj for obj in self.get_queryset().filter(id__in=ids)
        }

        updated_objs = []
        for obj_data in objects_data:
            obj = existing_objects.get(obj_data["id"])
            if obj:
                for key, value in obj_data.items():
                    setattr(obj, key, value)
                updated_objs.append(obj)

        self.serializer_class().Meta.model.objects.bulk_update(
            updated_objs, fields=list(objects_data[0].keys())
        )

        return ResponseUtils.success(
            message="Bulk update completed successfully.",
            data={
                "processed": len(updated_objs),
                "successful": len(updated_objs),
                "failed": 0,
            },
        )


class BulkDeleteMixin:
    """
    Mixin for bulk delete operations.
    """

    def bulk_delete(self, request, *args, **kwargs) -> Response:
        """Handle bulk delete operations."""
        ids = request.data.get("ids", [])

        if not ids:
            return ResponseUtils.error(
                message="No IDs provided for deletion.",
                code="no_ids_provided",
                status_code=400,
            )

        # Get service class if available
        if hasattr(self, "service_class") and self.service_class:
            service = self.service_class()
            deleted_count = service.bulk_delete(ids=ids)
        else:
            # Fallback to direct deletion
            deleted_count, _ = self.get_queryset().filter(id__in=ids).delete()

        return ResponseUtils.success(
            message="Bulk delete completed successfully.",
            data={
                "processed": len(ids),
                "successful": deleted_count,
                "failed": len(ids) - deleted_count,
            },
        )


class BulkOperationsMixin(BulkCreateMixin, BulkUpdateMixin, BulkDeleteMixin):
    """
    Complete bulk operations mixin.
    """

    pass
