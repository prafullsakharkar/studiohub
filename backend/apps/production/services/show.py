from apps.core.services.business import BusinessService
from apps.production.models import Show


class ShowService(BusinessService):
    model = Show
