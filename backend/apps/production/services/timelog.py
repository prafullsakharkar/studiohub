from apps.core.services.business import BusinessService
from apps.production.models import Timelog


class TimelogService(BusinessService):
    model = Timelog
