from rest_framework.routers import DefaultRouter

from apps.deliveries.api.viewsets.delivery import DeliveryViewSet
from apps.deliveries.api.viewsets.destination import DestinationViewSet

router = DefaultRouter()
# NOTE: destinations registers first — the root ("") viewset's detail route
# would otherwise swallow single-segment paths like "destinations/".
router.register(r"destinations", DestinationViewSet, basename="destination")
router.register(r"", DeliveryViewSet, basename="delivery")

urlpatterns = router.urls
