class ErrorMessageMixin:
    """
    Shared serializer error messages.
    """

    default_error_messages = {
        "not_found": "Object not found.",
        "permission_denied": "Permission denied.",
        "validation_error": "Validation failed.",
    }
