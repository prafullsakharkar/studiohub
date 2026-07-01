"""
Response helpers.
"""

from apps.core.api.builders import ResponseBuilder


def success(**kwargs):
    return ResponseBuilder.success(**kwargs)


def error(**kwargs):
    return ResponseBuilder.error(**kwargs)
