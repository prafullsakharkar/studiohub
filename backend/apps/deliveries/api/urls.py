"""
Delivery API URLs.
"""
from django.urls import include, path

from .routers import router

app_name = "deliveries"

urlpatterns = [
    path("", include(router.urls)),
]
