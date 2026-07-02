from django.urls import include, path

from .routers import router

app_name = "organization"

urlpatterns = [
    path("", include(router.urls)),
]
