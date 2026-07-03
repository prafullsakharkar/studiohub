from apps.identity.models import Role


class RoleSeeder:

    DATA = [
        {
            "name": "Studio Administrator",
            "code": "studio_admin",
        },
        {
            "name": "Producer",
            "code": "producer",
        },
        {
            "name": "Production Manager",
            "code": "production_manager",
        },
        {
            "name": "CG Supervisor",
            "code": "cg_supervisor",
        },
        {
            "name": "Lead Artist",
            "code": "lead_artist",
        },
        {
            "name": "Artist",
            "code": "artist",
        },
        {
            "name": "Coordinator",
            "code": "coordinator",
        },
        {
            "name": "Client",
            "code": "client",
        },
    ]

    @classmethod
    def run(cls):

        for role in cls.DATA:

            Role.objects.update_or_create(
                code=role["code"],
                defaults=role,
            )
