"""
Locale middleware.
"""

from django.utils import translation

from .base import BaseMiddleware


class LocaleMiddleware(BaseMiddleware):

    def process_request(self, request):

        language = request.headers.get("Accept-Language")

        if language:
            translation.activate(language)

        return request

    def process_response(
        self,
        request,
        response,
    ):
        translation.deactivate()

        return response
