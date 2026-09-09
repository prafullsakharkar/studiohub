from django.db import models


class OfficeType(models.TextChoices):
    HEADQUARTERS = "headquarters", "Headquarters"
    BRANCH = "branch", "Branch Office"
    REMOTE = "remote", "Remote"
    FIELD = "field", "Field Office"
    WAREHOUSE = "warehouse", "Warehouse"
    SHOWROOM = "showroom", "Showroom"
