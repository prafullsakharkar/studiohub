import contextlib

from django.conf import settings
from django.contrib import admin
from django.http import JsonResponse
from django.urls import include, path
from drf_spectacular.views import SpectacularAPIView, SpectacularSwaggerView


def health(request):
    return JsonResponse({"status": "ok"})


def _request_id_for(request):
    try:
        from apps.core.api.diagnostics.context import ensure_request_id

        return ensure_request_id(request)
    except Exception:
        return None


def not_found(request, exception=None):
    """
    JSON 404 handler with structured diagnostics.

    Unmatched API routes never reach DRF, so without this they would
    return Django's HTML debug page (or plain text) with no diagnostic
    context. Logs ``not_found`` with the path and returns the canonical
    additive error envelope (``detail`` + ``error.code``/``request_id``).
    """
    from apps.core.api.diagnostics import events
    from apps.core.api.diagnostics.context import build_request_context
    from apps.core.logging.logger import get_logger

    request_id = _request_id_for(request)
    with contextlib.suppress(Exception):
        request.request_id = request_id
    try:
        context = build_request_context(request)
        context["status_code"] = 404
        get_logger("api").warning(events.NOT_FOUND, **context)
    except Exception:
        pass

    return JsonResponse(
        {
            "detail": "Not found.",
            "error": {"code": "not_found", "request_id": request_id},
        },
        status=404,
    )


def server_error(request):
    """
    JSON 500 handler: API consumers always receive a DRF-shaped JSON body,
    never Django's HTML debug/technical page.

    Logs ``unhandled_exception`` with the full traceback server-side
    (tracebacks are never sent to clients). The response carries the same
    ``request_id`` so operators can correlate the client error with logs.
    """
    from apps.core.api.diagnostics import events
    from apps.core.api.diagnostics.context import build_request_context
    from apps.core.logging.logger import get_logger

    request_id = _request_id_for(request)
    with contextlib.suppress(Exception):
        request.request_id = request_id
    try:
        context = build_request_context(request)
        context["status_code"] = 500
        # No active exception here (Django already captured it); the
        # traceback is logged by the request lifecycle middleware's
        # ``unhandled_exception`` record for the same request_id.
        get_logger("api").error(events.UNHANDLED_EXCEPTION, **context)
    except Exception:
        pass

    return JsonResponse(
        {
            "detail": "Internal server error.",
            "error": {
                "code": "internal_server_error",
                "request_id": request_id,
            },
        },
        status=500,
    )


handler500 = server_error
handler404 = not_found


urlpatterns = [
    path("admin/", admin.site.urls),
    path("health/", health),
    path("api/", include("config.api_urls")),
    path("api/schema/", SpectacularAPIView.as_view(), name="schema"),
    path(
        "api/schema/swagger-ui/",
        SpectacularSwaggerView.as_view(url_name="schema"),
        name="swagger-ui",
    ),
]

if settings.DEBUG:
    import debug_toolbar

    urlpatterns += [
        path("__debug__/", include(debug_toolbar.urls)),
    ]
