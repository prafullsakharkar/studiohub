"""
Request utility helpers.
"""


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
        forwarded = request.META.get("HTTP_X_FORWARDED_FOR")
        if forwarded:
            return forwarded.split(",")[0].strip()

        return request.META.get("REMOTE_ADDR")
