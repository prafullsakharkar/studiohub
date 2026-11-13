"""
Who may upload, retry and remove a version's review movie (review-pipeline RP-10, C-RP-26, Q-RP-41 = A).

The routes ask for ``version.view``, and the version must be in reach (a 404 otherwise). Acting on the
review movie then needs ``version.update``, or being the version's artist and holding ``version.create``:
artists put movies on their own versions without being able to edit anyone else's.
"""

from __future__ import annotations

from typing import Any

from rest_framework.exceptions import PermissionDenied

from apps.production.constants.permissions import VersionPermissions
from apps.production.permissions.checks import has_permission_code


def may_manage_review_media(request: Any, version: Any) -> bool:
    """Whether the caller of ``request`` may upload, retry or remove ``version``'s review movie."""
    if has_permission_code(request, VersionPermissions.UPDATE):
        return True
    # An anonymous caller (pk None) never gets here: the route needs an authenticated user with version.view.
    user = getattr(request, "user", None)
    return getattr(version, "artist_id", None) == getattr(user, "pk", None) and has_permission_code(
        request, VersionPermissions.CREATE
    )


def require_manage_review_media(request: Any, version: Any) -> None:
    """403 unless ``may_manage_review_media``."""
    if not may_manage_review_media(request, version):
        raise PermissionDenied()
