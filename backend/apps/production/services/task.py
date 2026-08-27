from apps.core.services.business import BusinessService
from apps.production.models import Task


class TaskService(BusinessService):
    model = Task
