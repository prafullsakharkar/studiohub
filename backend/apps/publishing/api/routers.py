from rest_framework.routers import DefaultRouter

from apps.publishing.api.viewsets.destination import DestinationViewSet
from apps.publishing.api.viewsets.file import PublishedFileViewSet
from apps.publishing.api.viewsets.publish import PublishingViewSet
from apps.publishing.api.viewsets.storage_root import StorageRootViewSet

router = DefaultRouter()
# NOTE: the named prefixes register first. The root ("") viewset's detail route would
# otherwise swallow single-segment paths like "destinations/" and "files/".
router.register(r"files", PublishedFileViewSet, basename="published-file")
router.register(r"storage-roots", StorageRootViewSet, basename="storage-root")
router.register(r"destinations", DestinationViewSet, basename="destination")
router.register(r"", PublishingViewSet, basename="publishing")

urlpatterns = router.urls
