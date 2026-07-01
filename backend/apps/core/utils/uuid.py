"""
UUID utility functions.
"""

from __future__ import annotations

import uuid


def generate_uuid() -> uuid.UUID:
    """
    Generate a UUID4 object.
    """
    return uuid.uuid4()


def generate_uuid_hex() -> str:
    """
    Generate a UUID4 hex string.
    """
    return uuid.uuid4().hex


def generate_short_uuid(length: int = 8) -> str:
    """
    Generate a short UUID string.
    """
    return uuid.uuid4().hex[:length]


def is_valid_uuid(value: str) -> bool:
    """
    Validate UUID string.
    """
    try:
        uuid.UUID(str(value))
        return True
    except ValueError, TypeError:
        return False
