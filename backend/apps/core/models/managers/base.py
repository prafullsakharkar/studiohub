from django.db import models


class BaseManager(models.Manager):
    """
    Root manager for the entire project.

    All managers MUST inherit from this or be created using
    BaseManager.from_queryset().
    """

    # NOTE: Kept False because several managers are created dynamically via
    # ``BaseManager.from_queryset(...)`` at module level. Enabling migration
    # serialization for such dynamically generated managers requires them to be
    # importable by their generated class name, which they are not.
    use_in_migrations = False
