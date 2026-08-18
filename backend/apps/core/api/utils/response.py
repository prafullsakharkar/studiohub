"""
Response utility helpers.
"""

from apps.core.api.builders import ResponseBuilder


class ResponseUtils:
    @staticmethod
    def success(**kwargs):
        return ResponseBuilder.success(**kwargs)

    @staticmethod
    def error(**kwargs):
        return ResponseBuilder.error(**kwargs)
