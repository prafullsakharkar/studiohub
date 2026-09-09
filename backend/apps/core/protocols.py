"""
Protocol definitions.
"""

from __future__ import annotations

from typing import Any, Protocol


class HasOrganization(Protocol):

    organization: object


class HasOwner(Protocol):

    created_by: object


class HasStatus(Protocol):

    status: str


class HasMetadata(Protocol):

    metadata: dict[Any, Any]


class HasAudit(Protocol):

    created_at: object
    updated_at: object


class HasMembers(Protocol):
    """
    Protocol describing an object that exposes a `members` relation/manager.

    This allows Core code (permissions, utilities) to rely on a small
    interface rather than importing concrete project/member implementations
    from domain apps.
    """

    # `members` is intentionally loose (Any) to avoid importing Django
    # model types at the protocol definition site.
    members: Any
