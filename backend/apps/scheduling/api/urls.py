"""
Scheduling API URLs.
"""
from django.urls import include, path

from .routers import router

app_name = "scheduling"

urlpatterns = [
    path("", include(router.urls)),
]
