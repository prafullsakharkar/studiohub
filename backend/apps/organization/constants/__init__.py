from .permissions import (
    DepartmentPermissions,
    OfficePermissions,
    OrganizationPermissions,
    TeamPermissions,
)

MAX_CODE_LENGTH = 32

MAX_NAME_LENGTH = 255

__all__ = [
    "DepartmentPermissions",
    "MAX_CODE_LENGTH",
    "MAX_NAME_LENGTH",
    "OrganizationPermissions",
    "OfficePermissions",
    "TeamPermissions",
]
