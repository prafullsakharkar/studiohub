from apps.identity.querysets.base import IdentityQuerySet


class PermissionQuerySet(IdentityQuerySet):

    def by_module(self, module):
        return self.filter(module=module)

    def by_action(self, action):
        return self.filter(action=action)

    def by_category(self, category):
        return self.filter(category=category)

    def system_permissions(self):
        return self.system()
