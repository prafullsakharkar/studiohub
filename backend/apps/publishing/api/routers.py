from rest_framework.routers import DefaultRouter

from apps.publishing.api.viewsets.publish import PublishingViewSet

router = DefaultRouter()
router.register(r"", PublishingViewSet, basename="publishing")

urlpatterns = router.urls
