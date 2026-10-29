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
    # Project-scoped nested routes for the frontend contract, served as
    # /api/organizations/projects/<project>/... (slash-optional). The
    # `/api/organizations/` prefix is vestigial from the org architecture:
    # the organization app is gone (B7) and the tree carries no org segment
    # or org scoping. The old org-scoped trees 404 by absence.
    path("organizations/", include("apps.production.api.urls_project_scoped")),
]
