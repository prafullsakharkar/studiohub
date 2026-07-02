from django.db import models


class OrganizationType(models.TextChoices):
    """
    Types of organizations.
    """

    STUDIO = "studio", "Studio"

    CLIENT = "client", "Client"

    VENDOR = "vendor", "Vendor"

    FREELANCER = "freelancer", "Freelancer"

    EDUCATION = "education", "Education"

    INTERNAL = "internal", "Internal"
