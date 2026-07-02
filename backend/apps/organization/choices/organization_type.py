"""
Organization type choices.
"""

from django.db import models
from django.utils.translation import gettext_lazy as _


class OrganizationType(models.TextChoices):
    """
    Types of organizations supported by the platform.
    """

    STUDIO = "studio", _("Studio")
    CLIENT = "client", _("Client")
    VENDOR = "vendor", _("Vendor")
    FREELANCER = "freelancer", _("Freelancer")
    EDUCATIONAL = "educational", _("Educational")
    NON_PROFIT = "non_profit", _("Non-profit")
    GOVERNMENT = "government", _("Government")
    OTHER = "other", _("Other")
