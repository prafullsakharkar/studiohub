from .base import BaseChoices


class PublishStatus(BaseChoices):

    DRAFT = "draft", "Draft"

    SCHEDULED = "scheduled", "Scheduled"

    PUBLISHED = "published", "Published"

    EXPIRED = "expired", "Expired"
