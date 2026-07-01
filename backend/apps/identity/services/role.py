from apps.identity.models import Role


class RoleService:

    @staticmethod
    def create(**data):
        return Role.objects.create_role(**data)

    @staticmethod
    def activate(role):
        role.is_active = True
        role.save(update_fields=["is_active"])
        return role

    @staticmethod
    def deactivate(role):
        role.is_active = False
        role.save(update_fields=["is_active"])
        return role
