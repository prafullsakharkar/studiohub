"""
A project's vendors (CR-42).

``Project.vendor_ids`` holds the ids of masterdata vendors as strings. A write may only name vendors that exist
and are not deleted, each once; ``vendor_names`` is never written by a client: it is read from the vendors.
"""

from __future__ import annotations

from collections.abc import Iterable
from uuid import UUID

from rest_framework.exceptions import ValidationError

from apps.masterdata.selectors.directory import VendorSelector

UNKNOWN_VENDOR = "Unknown vendor: {id}"
DUPLICATE_VENDOR = "Vendor listed twice: {id}"


def validate_vendor_ids(ids: Iterable[UUID]) -> list[str]:
    """
    The ids as the strings to store, in the order given.

    Raises a ``ValidationError`` (one message per bad id) for an id listed twice or one that names no live vendor.
    """
    wanted = [str(i) for i in ids]
    errors: list[str] = []
    seen: set[str] = set()
    for vendor_id in wanted:
        if vendor_id in seen:
            errors.append(DUPLICATE_VENDOR.format(id=vendor_id))
        seen.add(vendor_id)
    known = VendorSelector.names_by_id(seen)
    errors.extend(UNKNOWN_VENDOR.format(id=vendor_id) for vendor_id in sorted(seen - known.keys()))
    if errors:
        raise ValidationError(errors)
    return wanted
