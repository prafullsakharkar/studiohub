"""
Field-level access for serializers (H1, DECISIONS D11).

A serializer lists ``gated_fields = {permission_code: (field, ...)}``. For a
caller without the permission:

* the fields are **omitted** from every representation (not blanked, not null);
* a request that **sets** one is refused with **403**, never silently ignored.

A hidden field is also never part of what the caller can update: services change
only the keys they are given, so an update by a caller who cannot see a field
cannot null it either.
"""

from __future__ import annotations

from typing import Any, ClassVar

from rest_framework.exceptions import PermissionDenied

from apps.masterdata.permissions.access import can


class GatedFieldsMixin:
    gated_fields: ClassVar[dict[str, tuple[str, ...]]] = {}

    def _hidden_fields(self) -> set[str]:
        cached = getattr(self, "_hidden_cache", None)
        if cached is None:
            request = self.context.get("request")  # pyright: ignore[reportAttributeAccessIssue]
            cached = {
                field
                for code, fields in self.gated_fields.items()
                if not can(request, code)
                for field in fields
            }
            self._hidden_cache = cached  # pyright: ignore[reportUninitializedInstanceVariable]
        return cached

    def to_representation(self, instance: Any) -> Any:
        data = super().to_representation(instance)  # pyright: ignore[reportAttributeAccessIssue]
        for field in self._hidden_fields():
            data.pop(field, None)
        return data

    def to_internal_value(self, data: Any) -> Any:
        sent = self._hidden_fields() & set(data.keys() if hasattr(data, "keys") else ())
        if sent:
            raise PermissionDenied(f"You may not set: {', '.join(sorted(sent))}.")
        return super().to_internal_value(data)  # pyright: ignore[reportAttributeAccessIssue]
