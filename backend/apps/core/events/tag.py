"""
Tag events.
"""

from __future__ import annotations

from dataclasses import dataclass


@dataclass
class TagCreated:
    """Event triggered when a tag is created."""

    tag_uuid: str
    tag_name: str
    organization_uuid: str


@dataclass
class TagUpdated:
    """Event triggered when a tag is updated."""

    tag_uuid: str
    tag_name: str
    organization_uuid: str


@dataclass
class TagDeleted:
    """Event triggered when a tag is deleted."""

    tag_uuid: str
    tag_name: str
    organization_uuid: str


__all__ = ["TagCreated", "TagUpdated", "TagDeleted", "TagEvent"]

# Alias for backward compatibility
TagEvent = TagCreated
