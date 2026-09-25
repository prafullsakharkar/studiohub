from .default_roles import (
    CLIENT_REVIEWER,
    DEFAULT_ROLE_SPECS,
    ORG_CRUD_PERMISSIONS,
    ORG_VIEW_PERMISSIONS,
    PRODUCTION_ARTIST,
    PRODUCTION_FULL,
    PRODUCTION_LEAD,
)
from .permissions import (
    DepartmentPermissions,
    OfficePermissions,
    OrganizationPermissions,
    TeamPermissions,
)

MAX_CODE_LENGTH = 32

MAX_NAME_LENGTH = 255

__all__ = [
    "CLIENT_REVIEWER",
    "DEFAULT_ROLE_SPECS",
    "DepartmentPermissions",
    "ORG_CRUD_PERMISSIONS",
    "ORG_VIEW_PERMISSIONS",
    "PRODUCTION_ARTIST",
    "PRODUCTION_FULL",
    "PRODUCTION_LEAD",
    "MAX_CODE_LENGTH",
    "MAX_NAME_LENGTH",
    "OrganizationPermissions",
    "OfficePermissions",
    "TeamPermissions",
]
