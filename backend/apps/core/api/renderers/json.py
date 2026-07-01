"""
Custom JSON renderer.
"""

from rest_framework.renderers import JSONRenderer


class StandardJSONRenderer(JSONRenderer):
    """
    Default JSON renderer.

    Reserved for future enhancements like:
    - camelCase conversion
    - envelope wrapping
    - API version metadata
    """

    media_type = "application/json"
    format = "json"
