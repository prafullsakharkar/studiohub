"""
Masterdata API URL configuration.

Exposes the platform catalog, directory and overview endpoints that match
the frontend API contract.
"""

from django.urls import path
from rest_framework.routers import DefaultRouter

from apps.masterdata.api.viewsets.catalog import PlatformOverviewViewSet
from apps.masterdata.api.viewsets.directory import (
    DepartmentViewSet,
    OfficeViewSet,
    PersonViewSet,
    PositionViewSet,
    TeamMembershipViewSet,
    TeamViewSet,
)
from apps.masterdata.api.viewsets.lookup import (
    MasterAssetTypeViewSet,
    MasterFileTypeViewSet,
    MasterReviewTypeViewSet,
    MasterShotTypeViewSet,
    MasterStatusViewSet,
    MasterTaskTypeViewSet,
    SoftwareVersionViewSet,
    SoftwareViewSet,
)
from apps.masterdata.api.viewsets.partners import (
    ClientContactViewSet,
    ClientContractViewSet,
    ClientViewSet,
    VendorContactViewSet,
    VendorContractViewSet,
    VendorViewSet,
)

app_name = "masterdata"

directory_router = DefaultRouter()
directory_router.register(r"departments", DepartmentViewSet, basename="department")
directory_router.register(r"teams", TeamViewSet, basename="team")
directory_router.register(r"team-memberships", TeamMembershipViewSet, basename="team-membership")
directory_router.register(r"offices", OfficeViewSet, basename="office")
directory_router.register(r"positions", PositionViewSet, basename="position")
directory_router.register(r"people", PersonViewSet, basename="person")
# Contacts/contracts stay flat: filter with ?client=<id> / ?vendor=<id>.
directory_router.register(r"client-contacts", ClientContactViewSet, basename="client-contact")
directory_router.register(r"vendor-contacts", VendorContactViewSet, basename="vendor-contact")
directory_router.register(r"client-contracts", ClientContractViewSet, basename="client-contract")
directory_router.register(r"vendor-contracts", VendorContractViewSet, basename="vendor-contract")
directory_router.register(r"clients", ClientViewSet, basename="client")
directory_router.register(r"vendors", VendorViewSet, basename="vendor")

CATALOG_TYPES = {
    "statuses": MasterStatusViewSet,
    "task-types": MasterTaskTypeViewSet,
    "asset-types": MasterAssetTypeViewSet,
    "shot-types": MasterShotTypeViewSet,
    "review-types": MasterReviewTypeViewSet,
    "file-types": MasterFileTypeViewSet,
}

urlpatterns = [
    path(
        "platform/overview",
        PlatformOverviewViewSet.as_view({"get": "overview"}),
        name="platform-overview",
    ),
    path(
        "platform/master-data/software",
        SoftwareViewSet.as_view({"get": "list", "post": "create"}),
        name="platform-software-list",
    ),
    path(
        "platform/master-data/software/reorder",
        SoftwareViewSet.as_view({"post": "reorder"}),
        name="platform-software-reorder",
    ),
    path(
        "platform/master-data/software/<uuid:pk>",
        SoftwareViewSet.as_view(
            {
                "get": "retrieve",
                "put": "update",
                "patch": "partial_update",
                "delete": "destroy",
            }
        ),
        name="platform-software-detail",
    ),
    path(
        "platform/master-data/software/<uuid:pk>/archive",
        SoftwareViewSet.as_view({"post": "archive"}),
        name="platform-software-archive",
    ),
    path(
        "platform/master-data/software/<uuid:pk>/restore",
        SoftwareViewSet.as_view({"post": "restore"}),
        name="platform-software-restore",
    ),
    path(
        "platform/master-data/software/<uuid:software_pk>/versions",
        SoftwareVersionViewSet.as_view({"get": "list", "post": "create"}),
        name="platform-software-versions-list",
    ),
    path(
        "platform/master-data/software/<uuid:software_pk>/versions/<uuid:pk>",
        SoftwareVersionViewSet.as_view(
            {
                "get": "retrieve",
                "put": "update",
                "patch": "partial_update",
                "delete": "destroy",
            }
        ),
        name="platform-software-versions-detail",
    ),
    path(
        "platform/master-data/software/<uuid:software_pk>/versions/<uuid:pk>/archive",
        SoftwareVersionViewSet.as_view({"post": "archive"}),
        name="platform-software-versions-archive",
    ),
    path(
        "platform/master-data/software/<uuid:software_pk>/versions/<uuid:pk>/restore",
        SoftwareVersionViewSet.as_view({"post": "restore"}),
        name="platform-software-versions-restore",
    ),
]

urlpatterns += directory_router.urls


for _data_type, _viewset in CATALOG_TYPES.items():
    urlpatterns += [
        path(
            f"platform/master-data/{_data_type}/reorder",
            _viewset.as_view({"post": "reorder"}),
            name=f"platform-{_data_type}-reorder",
        ),
        path(
            f"platform/master-data/{_data_type}",
            _viewset.as_view({"get": "list", "post": "create"}),
            name=f"platform-{_data_type}-list",
        ),
        path(
            f"platform/master-data/{_data_type}/<uuid:pk>",
            _viewset.as_view(
                {
                    "get": "retrieve",
                    "put": "update",
                    "patch": "partial_update",
                    "delete": "destroy",
                }
            ),
            name=f"platform-{_data_type}-detail",
        ),
        path(
            f"platform/master-data/{_data_type}/<uuid:pk>/archive",
            _viewset.as_view({"post": "archive"}),
            name=f"platform-{_data_type}-archive",
        ),
        path(
            f"platform/master-data/{_data_type}/<uuid:pk>/restore",
            _viewset.as_view({"post": "restore"}),
            name=f"platform-{_data_type}-restore",
        ),
    ]
