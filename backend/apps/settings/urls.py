"""
URLs for Settings app.
"""
from django.urls import include, path

urlpatterns = [
    path("api/v1/", include("apps.settings.api.urls")),
]
