from apps.core.services.business import BusinessService
from apps.production.models import Project


class ProjectService(BusinessService):
    model = Project
