from django.db import models

from apps.identity.querysets.profile import (
    ProfileQuerySet,
)


class ProfileManager(models.Manager.from_queryset(ProfileQuerySet)):
    """
    Profile manager.
    """

    pass
