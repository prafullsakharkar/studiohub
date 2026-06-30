import logging
import time
import uuid

logger = logging.getLogger("django.request")


class RequestIDMiddleware:
    """
    Adds a request ID and logs request/response information.
    """

    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        request.request_id = str(uuid.uuid4())

        start = time.perf_counter()

        response = self.get_response(request)

        duration = (time.perf_counter() - start) * 1000

        response["X-Request-ID"] = request.request_id

        logger.info(
            ("request_id=%s method=%s path=%s " "status=%s duration=%.2fms user=%s ip=%s"),
            request.request_id,
            request.method,
            request.get_full_path(),
            response.status_code,
            duration,
            (
                getattr(request.user, "pk", None)
                if getattr(request.user, "is_authenticated", False)
                else None
            ),
            request.META.get("REMOTE_ADDR"),
        )

        return response
