from django.urls import include, path

app_name = "organization"

urlpatterns = [
    path(
        "",
        include("apps.organization.api.urls"),
    ),
]
