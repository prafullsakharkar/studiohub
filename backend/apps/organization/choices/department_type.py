from django.db import models


class DepartmentType(models.TextChoices):
    PRODUCTION = "production", "Production"
    CREATIVE = "creative", "Creative"
    TECHNICAL = "technical", "Technical"
    SUPPORT = "support", "Support"
    ADMINISTRATION = "administration", "Administration"
