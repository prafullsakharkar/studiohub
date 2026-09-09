from apps.core.services.business import BusinessService
from apps.production.models import Workflow


class WorkflowService(BusinessService):
    model = Workflow
