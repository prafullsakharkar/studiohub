from rest_framework.renderers import JSONRenderer


class StandardJSONRenderer(JSONRenderer):
    """
    Standard JSON renderer.

    Response formatting is handled by ResponseBuilder.
    """

    charset = "utf-8"
