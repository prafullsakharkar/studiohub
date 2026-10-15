"""
Masterdata API URL configuration.

Exposes the platform catalog, platform overview, and organization-scoped
effective master-data endpoints that match the frontend API contract.
"""

from django.urls import path
from rest_framework.routers import DefaultRouter

from apps.masterdata.api.viewsets.catalog import (
    MasterAssetTypeViewSet,
    MasterFileTypeViewSet,
    MasterReviewTypeViewSet,
    MasterShotTypeViewSet,
    MasterStatusViewSet,
    MasterTaskTypeViewSet,
    PlatformDepartmentViewSet,
    PlatformGroupViewSet,
    PlatformOverviewViewSet,
    PlatformPositionViewSet,
    PlatformRoleViewSet,
    SoftwareVersionViewSet,
    SoftwareViewSet,
)
from apps.masterdata.api.viewsets.directory import (
    ClientContactViewSet,
    ClientContractViewSet,
    ClientViewSet,
    DepartmentViewSet,
    OfficeViewSet,
    PersonViewSet,
    PositionViewSet,
    TeamViewSet,
    VendorContactViewSet,
    VendorContractViewSet,
    VendorViewSet,
)
from apps.masterdata.api.viewsets.organization import OrganizationMasterDataViewSet

app_name = "masterdata"

directory_router = DefaultRouter()
directory_router.register(r"departments", DepartmentViewSet, basename="department")
directory_router.register(r"teams", TeamViewSet, basename="team")
directory_router.register(r"offices", OfficeViewSet, basename="office")
directory_router.register(r"positions", PositionViewSet, basename="position")
directory_router.register(r"people", PersonViewSet, basename="person")
# Nested contact/contract routes must precede the parent clients/vendors
# registration so their regexes win over the parent detail routes.
directory_router.register(
    r"clients/(?P<client_pk>[^/.]+)/contacts",
    ClientContactViewSet,
    basename="client-contact",
)
directory_router.register(
    r"vendors/(?P<vendor_pk>[^/.]+)/contacts",
    VendorContactViewSet,
    basename="vendor-contact",
)
directory_router.register(
    r"clients/(?P<client_pk>[^/.]+)/contracts",
    ClientContractViewSet,
    basename="client-contract",
)
directory_router.register(
    r"vendors/(?P<vendor_pk>[^/.]+)/contracts",
    VendorContractViewSet,
    basename="vendor-contract",
)
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
    path(
        "platform/roles",
        PlatformRoleViewSet.as_view({"get": "list", "post": "create"}),
        name="platform-role-list",
    ),
    path(
        "platform/roles/<uuid:pk>",
        PlatformRoleViewSet.as_view(
            {
                "get": "retrieve",
                "put": "update",
                "patch": "partial_update",
                "delete": "destroy",
            }
        ),
        name="platform-role-detail",
    ),
    path(
        "platform/groups",
        PlatformGroupViewSet.as_view({"get": "list", "post": "create"}),
        name="platform-group-list",
    ),
    path(
        "platform/groups/<uuid:pk>",
        PlatformGroupViewSet.as_view(
            {
                "get": "retrieve",
                "put": "update",
                "patch": "partial_update",
                "delete": "destroy",
            }
        ),
        name="platform-group-detail",
    ),
    path(
        "platform/departments",
        PlatformDepartmentViewSet.as_view({"get": "list", "post": "create"}),
        name="platform-department-list",
    ),
    path(
        "platform/departments/<uuid:pk>",
        PlatformDepartmentViewSet.as_view(
            {
                "get": "retrieve",
                "put": "update",
                "patch": "partial_update",
                "delete": "destroy",
            }
        ),
        name="platform-department-detail",
    ),
    path(
        "platform/positions",
        PlatformPositionViewSet.as_view({"get": "list", "post": "create"}),
        name="platform-position-list",
    ),
    path(
        "platform/positions/<uuid:pk>",
        PlatformPositionViewSet.as_view(
            {
                "get": "retrieve",
                "put": "update",
                "patch": "partial_update",
                "delete": "destroy",
            }
        ),
        name="platform-position-detail",
    ),
    path(
        "organizations/<uuid:organization_id>/master-data/bundle",
        OrganizationMasterDataViewSet.as_view({"get": "bundle"}),
        name="organization-master-data-bundle",
    ),
    path(
        "organizations/<uuid:organization_id>/master-data/<str:data_type>/custom",
        OrganizationMasterDataViewSet.as_view({"post": "create_custom"}),
        name="organization-master-data-custom",
    ),
    path(
        "organizations/<uuid:organization_id>/master-data/<str:data_type>/<uuid:item_id>/config",
        OrganizationMasterDataViewSet.as_view({"put": "update_config"}),
        name="organization-master-data-config",
    ),
    path(
        "organizations/<uuid:organization_id>/master-data/<str:data_type>/bulk-enable",
        OrganizationMasterDataViewSet.as_view({"post": "bulk_enable"}),
        name="organization-master-data-bulk-enable",
    ),
    path(
        "organizations/<uuid:organization_id>/master-data/<str:data_type>",
        OrganizationMasterDataViewSet.as_view({"get": "list_type"}),
        name="organization-master-data-type",
    ),
]

urlpatterns += directory_router.urls


for _data_type, _viewset in CATALOG_TYPES.items():
    urlpatterns += [
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
