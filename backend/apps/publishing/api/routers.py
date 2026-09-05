from rest_framework.routers import DefaultRouter

from apps.publishing.api.viewsets.destination import DestinationViewSet
from apps.publishing.api.viewsets.publish import PublishingViewSet

router = DefaultRouter()
# NOTE: destinations registers first — the root ("") viewset's detail route
# would otherwise swallow single-segment paths like "destinations/".
router.register(r"destinations", DestinationViewSet, basename="destination")
router.register(r"", PublishingViewSet, basename="publishing")

urlpatterns = router.urls
