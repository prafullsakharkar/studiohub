from apps.identity.models import Role


class RoleSelector:

    @staticmethod
    def get(pk):
        return Role.objects.select_related(
            "organization",
            "parent",
        ).get(pk=pk)

    @staticmethod
    def list():
        return Role.objects.select_related(
            "organization",
            "parent",
        )
