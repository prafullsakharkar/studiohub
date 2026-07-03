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
