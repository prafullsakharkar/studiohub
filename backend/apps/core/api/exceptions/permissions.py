"""
Permission related exceptions.
"""

from __future__ import annotations

from rest_framework import status

from .api import BaseAPIException


class PermissionDeniedException(BaseAPIException):
    status_code = status.HTTP_403_FORBIDDEN
    default_detail = "Permission denied."
    default_code = "permission_denied"


class OrganizationPermissionException(PermissionDeniedException):
    default_detail = "You are not a member of this organization."


class ProjectPermissionException(PermissionDeniedException):
    default_detail = "You do not have access to this project."
