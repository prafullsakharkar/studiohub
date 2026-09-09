from django.conf import settings
from django.contrib import admin
from django.http import JsonResponse
from django.urls import include, path
from drf_spectacular.views import SpectacularAPIView, SpectacularSwaggerView


def health(request):
    return JsonResponse({"status": "ok"})


def server_error(request):
    """
    JSON 500 handler: API consumers always receive a DRF-shaped JSON body,
    never Django's HTML debug/technical page.
    """
    return JsonResponse({"detail": "Internal server error."}, status=500)


handler500 = server_error


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
