from django.db import models


class BaseManager(models.Manager):
    """
    Root manager for the entire project.

    All managers MUST inherit from this or be created using
    BaseManager.from_queryset().
    """

    use_in_migrations = True
