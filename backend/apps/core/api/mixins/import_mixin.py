"""
Import Operations Mixin.

This mixin provides import functionality for ViewSets.
"""
from __future__ import annotations

from typing import TYPE_CHECKING

from rest_framework import serializers
from rest_framework.response import Response

from apps.core.api.utils.response import ResponseUtils

if TYPE_CHECKING:
    pass


class ImportMixin:
    """
    Mixin for import operations.
    """

    import_serializer_class: type[serializers.Serializer] | None = None

    def get_import_serializer(self) -> type[serializers.Serializer]:
        """Get the serializer class for import."""
        if self.import_serializer_class is None:
            raise NotImplementedError("import_serializer_class must be defined.")
        return self.import_serializer_class

    def import_data(self, request, *args, **kwargs) -> Response:
        """Handle import operations."""
        serializer_class = self.get_import_serializer()
        serializer = serializer_class(
            data=request.data, context=self.get_serializer_context()
        )
        serializer.is_valid(raise_exception=True)

        file = serializer.validated_data.get("file")
        format_type = serializer.validated_data.get("format", "csv")

        # Validate file type
        if format_type == "csv" and not file.name.endswith(".csv"):
            return ResponseUtils.error(
                message="Invalid file type. CSV file required.",
                code="invalid_file_type",
                status_code=400,
            )

        if format_type == "json" and not file.name.endswith(".json"):
            return ResponseUtils.error(
                message="Invalid file type. JSON file required.",
                code="invalid_file_type",
                status_code=400,
            )

        # Read file content
        try:
            if format_type == "csv":
                import csv
                import io

                decoded_file = file.read().decode("utf-8")
                csv_reader = csv.DictReader(io.StringIO(decoded_file))
                data = list(csv_reader)
            elif format_type == "json":
                import json

                decoded_file = file.read().decode("utf-8")
                data = json.loads(decoded_file)
            else:
                return ResponseUtils.error(
                    message="Unsupported file format.",
                    code="unsupported_format",
                    status_code=400,
                )
        except Exception as e:
            return ResponseUtils.error(
                message=f"Error reading file: {str(e)}",
                code="file_read_error",
                status_code=400,
            )

        # Process import
        if hasattr(self, "service_class") and self.service_class:
            service = self.service_class()
            result = service.process_import(data=data, format=format_type)
        else:
            # Fallback to direct processing
            result = self._process_import_direct(data)

        return ResponseUtils.success(
            message="Import completed successfully.",
            data={
                "processed": result.get("processed", 0),
                "successful": result.get("successful", 0),
                "failed": result.get("failed", 0),
                "errors": result.get("errors", []),
            },
        )

    def _process_import_direct(self, data: list[dict]) -> dict:
        """Process import directly without service."""
        successful = 0
        failed = 0
        errors = []

        for idx, item in enumerate(data):
            try:
                serializer = self.get_serializer(data=item)
                serializer.is_valid(raise_exception=True)
                self.perform_create(serializer)
                successful += 1
            except Exception as e:
                failed += 1
                errors.append({"index": idx, "error": str(e)})

        return {
            "processed": len(data),
            "successful": successful,
            "failed": failed,
            "errors": errors,
        }
