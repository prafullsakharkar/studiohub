"""
OpenAPI helpers for the masterdata API (docs/masterdata/PLAN.md WP 8.3, finding M7).

The real response bodies and statuses differ from what DRF infers: DELETE answers 204 (directory)
or 200 ``{success, message}`` (catalogs), archive and restore wrap the row in ``{success, data}``,
errors use the core error format, and the overview is a plain object. These shared pieces
document that, so each viewset states it once.
"""

from __future__ import annotations

from typing import Any

from drf_spectacular.openapi import AutoSchema
from drf_spectacular.utils import OpenApiParameter, OpenApiResponse, inline_serializer
from rest_framework import serializers


class ErrorBodySerializer(serializers.Serializer[dict[str, Any]]):
    """``{"detail": "...", "error": {"code": "...", "request_id": "..."}}`` (API-MD-02)."""

    detail = serializers.CharField()
    error = inline_serializer(
        name="MasterdataErrorDetail",
        fields={"code": serializers.CharField(), "request_id": serializers.CharField()},
    )


class ValidationErrorBodySerializer(serializers.Serializer[dict[str, Any]]):
    """``{"<field>": ["message", ...], "error": {"code": "validation_error", "request_id": "..."}}``.

    The field keys depend on the request, so only ``error`` is declared.
    """

    error = inline_serializer(
        name="MasterdataValidationErrorDetail",
        fields={"code": serializers.CharField(), "request_id": serializers.CharField()},
    )


class SuccessMessageSerializer(serializers.Serializer[dict[str, Any]]):
    success = serializers.BooleanField()
    message = serializers.CharField()


class ActionResultSerializer(serializers.Serializer[dict[str, Any]]):
    """Catalog archive / restore: ``{"success": true, "data": <the row>}``."""

    success = serializers.BooleanField()
    data = serializers.DictField()  # pyright: ignore[reportIncompatibleMethodOverride, reportAssignmentType]


class PlatformOverviewSerializer(serializers.Serializer[dict[str, Any]]):
    global_software_count = serializers.IntegerField()
    global_version_count = serializers.IntegerField()
    global_status_count = serializers.IntegerField()
    global_task_type_count = serializers.IntegerField()
    global_asset_type_count = serializers.IntegerField()
    global_shot_type_count = serializers.IntegerField()
    global_review_type_count = serializers.IntegerField()
    global_file_type_count = serializers.IntegerField()
    system_health = serializers.CharField()
    last_definition_update = serializers.DateTimeField(allow_null=True)


HARD_PARAMETER = OpenApiParameter(
    name="hard",
    type=bool,
    required=False,
    description=(
        "`true` permanently deletes a row that is already soft-deleted (needs "
        "`masterdata.hard_delete`). Omitted or `false` soft-deletes."
    ),
)


def error(status: int) -> OpenApiResponse:
    descriptions = {
        400: "Validation failed.",
        401: "Authentication credentials were not provided.",
        403: "Missing permission.",
        404: "Unknown or soft-deleted id.",
        409: "Conflict: duplicate, dependants, illegal transition or overlap (see `error.code`).",
    }
    body = ValidationErrorBodySerializer if status == 400 else ErrorBodySerializer
    return OpenApiResponse(response=body, description=descriptions[status])


def errors(*statuses: int) -> dict[int, OpenApiResponse]:
    """Error responses for ``extend_schema(responses=...)``."""
    return {status: error(status) for status in statuses}


class MasterdataAutoSchema(AutoSchema):
    """Adds the standard error responses to every masterdata operation.

    The statuses follow API-MD-03: 401 always; 403 on every write (and on reads of the contact
    endpoints, which need ``masterdata.person.view_sensitive``); 404 when the path names a row;
    400 and 409 on anything that writes.
    """

    def _get_response_bodies(self, direction: str = "response"):  # pyright: ignore[reportIncompatibleMethodOverride]
        bodies = super()._get_response_bodies(direction)  # pyright: ignore[reportArgumentType]
        if direction != "response":
            return bodies
        writes = self.method in ("POST", "PUT", "PATCH", "DELETE")
        wanted = {401}
        if writes or getattr(self.view, "read_permissions", ()):
            wanted.add(403)
        if "{" in self.path:
            wanted.add(404)
        if writes:
            wanted |= {409}
            if self.method != "DELETE":
                wanted.add(400)
        for code in sorted(wanted):
            if str(code) not in bodies:
                bodies[str(code)] = self._get_response_for_code(
                    error(code),
                    str(code),
                    direction=direction,  # pyright: ignore[reportArgumentType]
                )
        return bodies
