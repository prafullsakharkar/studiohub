from apps.identity.permissions.registry import (
    PermissionDefinition,
)

PROJECT_PERMISSIONS = [
    PermissionDefinition(
        code="project.view",
        name="View Project",
        module="project",
        action="view",
    ),
    PermissionDefinition(
        code="project.create",
        name="Create Project",
        module="project",
        action="create",
    ),
    PermissionDefinition(
        code="project.update",
        name="Update Project",
        module="project",
        action="update",
    ),
    PermissionDefinition(
        code="project.delete",
        name="Delete Project",
        module="project",
        action="delete",
    ),
    PermissionDefinition(
        code="project.archive",
        name="Archive Project",
        module="project",
        action="archive",
    ),
]
