"""
Central API URL aggregator.

Exposes the versioned ``v1`` namespace under the top-level ``api`` namespace.

Namespace structure produced:

    api:v1:tag-list                    -> core routes (directly under v1)
    api:v1:audit:audit-log-list        -> domain app routes (nested app_name)
"""

from django.urls import include, path

app_name = "api"

urlpatterns = [
    path("v1/", include(("config.v1_urls", "v1"), namespace="v1")),
]
