from apps.production.models import Task
from apps.production.services.bulk import BulkOperationService


class TaskService(BulkOperationService):
    model = Task
