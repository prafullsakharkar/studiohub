from __future__ import annotations


class OrganizationBaseValidator:
    """
    Base validator for Organization module.
    """

    @classmethod
    def validate_create(cls, **kwargs):
        return

    @classmethod
    def validate_update(cls, instance, **kwargs):
        return

    @classmethod
    def validate_delete(cls, instance):
        return

    @classmethod
    def validate_restore(cls, instance):
        return

    @classmethod
    def validate_activate(cls, instance):
        return

    @classmethod
    def validate_deactivate(cls, instance):
        return

    @classmethod
    def validate_archive(cls, instance):
        return

    @classmethod
    def validate_draft(cls, instance):
        return
