from apps.identity.seeds.permissions import (
    PermissionSeeder,
)
from apps.identity.seeds.role_permissions import (
    RolePermissionSeeder,
)
from apps.identity.seeds.roles import (
    RoleSeeder,
)
from apps.identity.seeds.superuser import (
    SuperUserSeeder,
)


class IdentitySeeder:

    @classmethod
    def run(cls):

        PermissionSeeder.run()

        RoleSeeder.run()

        RolePermissionSeeder.run()

        SuperUserSeeder.run()
