from apps.production.api.serializers.task.update import TaskUpdateSerializer
from apps.production.models import Task
from apps.production.services.bulk import BulkOperationService


class TaskService(BulkOperationService):
    model = Task
    bulk_update_serializer = TaskUpdateSerializer
