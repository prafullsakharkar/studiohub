from apps.identity.models import (
    Permission,
    Role,
)


class RolePermissionSeeder:

    MAP = {
        "studio_admin": [
            "*",
        ],
        "producer": [
            "project.*",
            "sequence.*",
            "shot.*",
        ],
        "artist": [
            "asset.view",
            "task.view",
            "task.update",
        ],
    }

    @classmethod
    def run(cls):

        for role_code, permissions in cls.MAP.items():

            role = Role.objects.get(
                code=role_code,
            )

            if "*" in permissions:

                role.permissions.set(
                    Permission.objects.all(),
                )

                continue

            permission_objects = Permission.objects.filter(
                code__in=permissions,
            )

            role.permissions.set(
                permission_objects,
            )
