from apps.core.services.business import BusinessService
from apps.production.models import Review


class ReviewService(BusinessService):
    model = Review
