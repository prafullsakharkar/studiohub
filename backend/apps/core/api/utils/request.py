"""
Request utility helpers.
"""

from apps.core.utils.client_ip import get_client_ip


class RequestUtils:
    @staticmethod
    def get_user(request):
        return getattr(request, "user", None)

    @staticmethod
    def get_organization(request):
        return getattr(request, "organization", None)

    @staticmethod
    def get_language(request):
        return getattr(request, "LANGUAGE_CODE", None)

    @staticmethod
    def get_ip(request):
        return get_client_ip(request)
