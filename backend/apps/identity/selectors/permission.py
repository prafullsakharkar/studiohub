"""
Permission selectors.
"""

from apps.identity.models import Permission


class PermissionSelector:
    """
    Read-only permission queries.
    """

    @staticmethod
    def get(pk):
        return Permission.objects.get(pk=pk)

    @staticmethod
    def list():
        return Permission.objects.all()

    @staticmethod
    def by_module(module):
        return Permission.objects.by_module(module)

    @staticmethod
    def by_action(action):
        return Permission.objects.by_action(action)

    @staticmethod
    def by_category(category):
        return Permission.objects.by_category(category)

    @staticmethod
    def by_code(code):
        return Permission.objects.get_by_code(code)
