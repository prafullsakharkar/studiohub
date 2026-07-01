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
