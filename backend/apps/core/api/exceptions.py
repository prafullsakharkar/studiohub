from rest_framework.views import exception_handler

from .builders import ResponseBuilder


def custom_exception_handler(exc, context):
    response = exception_handler(exc, context)

    if response is None:
        return response

    request = context.get("request")

    if isinstance(response.data, dict):
        message = response.data.get("detail")

        if message:
            errors = None
        else:
            message = "Validation failed."
            errors = response.data
    else:
        message = "Request failed."
        errors = response.data

    response.data = ResponseBuilder.error(
        status_code=response.status_code,
        request=request,
        message=message,
        errors=errors,
    )

    return response
