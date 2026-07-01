from .base import BaseChoices


class Priority(BaseChoices):

    LOW = "low", "Low"

    MEDIUM = "medium", "Medium"

    HIGH = "high", "High"

    CRITICAL = "critical", "Critical"
