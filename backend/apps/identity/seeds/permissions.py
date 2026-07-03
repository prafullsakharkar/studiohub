from apps.identity.models import Permission


class PermissionSeeder:

    DATA = [
        {
            "name": "View Organizations",
            "code": "organization.view",
            "module": "organization",
            "action": "view",
        },
        {
            "name": "Create Organizations",
            "code": "organization.create",
            "module": "organization",
            "action": "create",
        },
        {
            "name": "Update Organizations",
            "code": "organization.update",
            "module": "organization",
            "action": "update",
        },
        {
            "name": "Delete Organizations",
            "code": "organization.delete",
            "module": "organization",
            "action": "delete",
        },
        # Continue for:
        # Departments
        # Teams
        # Offices
        # Roles
        # Users
        # Memberships
        # Invitations
        # Production (later)
    ]

    @classmethod
    def run(cls):

        for permission in cls.DATA:

            Permission.objects.update_or_create(
                code=permission["code"],
                defaults=permission,
            )
