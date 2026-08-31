"""
Publishing API URLs.
"""
from django.urls import include, path

from .routers import router

app_name = "publishing"

urlpatterns = [
    path("", include(router.urls)),
]
