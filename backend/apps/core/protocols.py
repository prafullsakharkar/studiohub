"""
Protocol definitions.
"""

from __future__ import annotations

from typing import Protocol


class HasOrganization(Protocol):

    organization: object


class HasOwner(Protocol):

    created_by: object


class HasStatus(Protocol):

    status: str


class HasMetadata(Protocol):

    metadata: dict


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

    # `members` is intentionally typed as `object` to avoid importing Django
    # model types at the protocol definition site. Consumers can use typing
    # hints or runtime checks as needed.
    members: object
