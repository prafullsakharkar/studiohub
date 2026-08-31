from rest_framework.routers import DefaultRouter

from apps.deliveries.api.viewsets.delivery import DeliveryViewSet

router = DefaultRouter()
router.register(r"", DeliveryViewSet, basename="delivery")

urlpatterns = router.urls
