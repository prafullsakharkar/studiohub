"""
Base service.
"""

from __future__ import annotations


class BaseService:
    """
    Base service class.
    """

    model = None

    validator_class = None

    selector_class = None

    @classmethod
    def validate(cls, **kwargs):
        """
        Execute validator hooks.
        """
        return

    @classmethod
    def before_create(cls, **kwargs):
        return

    @classmethod
    def after_create(cls, instance):
        return instance

    @classmethod
    def before_update(cls, instance, **kwargs):
        return

    @classmethod
    def after_update(cls, instance):
        return instance

    @classmethod
    def before_delete(cls, instance):
        return

    @classmethod
    def after_delete(cls, instance):
        return

    # ------------------------------------------------------------------
    # Instance helpers (convenience wrappers used by instance-method
    # services, e.g. ``service.create_xxx(**data)``)
    # ------------------------------------------------------------------

    def _create(self, **kwargs):
        """
        Create a model instance.

        Requires ``self.model`` to be set on the service class.
        """
        return self.model.objects.create(**kwargs)

    def _update(self, instance, **kwargs):
        """
        Update a model instance in place.
        """
        for field, value in kwargs.items():
            setattr(instance, field, value)
        instance.save()
        return instance

    def _delete(self, instance):
        """
        Delete (hard) a model instance.
        """
        instance.delete()
