"""
URLs for Audit app.
"""
from django.urls import include, path

urlpatterns = [
    path("api/v1/", include("apps.audit.api.urls")),
]
