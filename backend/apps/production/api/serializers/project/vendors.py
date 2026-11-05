"""
A project's vendors on the wire (CR-42).

``vendor_ids`` is written as a list of vendor UUIDs, each a live vendor, each once (``VendorIdsField``).
``vendor_names`` is read-only: the names of those vendors, in that order, skipping one that is no longer a
vendor (``VendorNamesField``). A page of projects looks the names up once (``ProjectPageSerializer``); one
project on its own looks up its own.
"""

from __future__ import annotations

from typing import Any, cast

from drf_spectacular.utils import extend_schema_field
from rest_framework import serializers

from apps.masterdata.selectors.directory import VendorSelector
from apps.production.validators.vendors import validate_vendor_ids

#: The context key under which a page of projects keeps ``{vendor id: name}`` for all its projects.
VENDOR_NAMES_KEY = "vendor_names_by_id"


class ProjectPageSerializer(serializers.ListSerializer[Any]):
    """A list of projects that looks up the vendor names of the whole page in one query."""

    def to_representation(self, data: Any) -> list[Any]:
        items = list(data.all() if hasattr(data, "all") else data)
        ids = [vendor_id for project in items for vendor_id in (project.vendor_ids or [])]
        cast(dict[str, Any], self.context)[VENDOR_NAMES_KEY] = VendorSelector.names_by_id(ids)
        return super().to_representation(items)


class VendorIdsField(serializers.ListField):
    """The vendors of a project: live vendor UUIDs, each once, stored as strings in the order given."""

    def __init__(self, **kwargs: Any) -> None:
        kwargs.setdefault("child", serializers.UUIDField())
        kwargs.setdefault("required", False)
        kwargs.setdefault("allow_empty", True)
        super().__init__(**kwargs)

    def to_internal_value(self, data: Any) -> list[str]:
        return validate_vendor_ids(super().to_internal_value(data))


@extend_schema_field(serializers.ListField(child=serializers.CharField()))
class VendorNamesField(serializers.Field[Any, Any, Any, Any]):
    """The names of the project's vendors, read from the vendors (never written by a client)."""

    def __init__(self, **kwargs: Any) -> None:
        kwargs["source"] = "vendor_ids"
        kwargs["read_only"] = True
        super().__init__(**kwargs)

    def to_representation(self, value: Any) -> list[str]:
        ids = list(value or [])
        names = cast(dict[str, str] | None, self.context.get(VENDOR_NAMES_KEY))
        if names is None:
            names = VendorSelector.names_by_id(ids)
        return [names[str(i)] for i in ids if str(i) in names]
