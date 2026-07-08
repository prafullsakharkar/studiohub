from __future__ import annotations

from django.db import transaction


class IdentityBaseService:
    """
    Base service for the Identity bounded context.
    """

    model = None
    selector = None
    validator = None

    # ------------------------------------------------------------------
    # Query Helpers
    # ------------------------------------------------------------------

    @classmethod
    def queryset(cls):
        return cls.model.objects.all()

    @classmethod
    def get(cls, *args, **kwargs):
        if cls.selector:
            return cls.selector.get(*args, **kwargs)

        return cls.model.objects.get(*args, **kwargs)

    @classmethod
    def filter(cls, **filters):
        return cls.queryset().filter(**filters)

    @classmethod
    def exists(cls, **filters):
        return cls.filter(**filters).exists()

    @classmethod
    def count(cls, **filters):
        return cls.filter(**filters).count()

    # ------------------------------------------------------------------
    # Validation
    # ------------------------------------------------------------------

    @classmethod
    def validate(cls, *args, **kwargs):
        if cls.validator:
            cls.validator.validate(*args, **kwargs)

    # ------------------------------------------------------------------
    # Create
    # ------------------------------------------------------------------

    @classmethod
    @transaction.atomic
    def create_instance(cls, **validated_data):
        instance = cls.model.objects.create(
            **validated_data,
        )

        cls.after_create(instance)

        return instance

    # ------------------------------------------------------------------
    # Update
    # ------------------------------------------------------------------

    @classmethod
    @transaction.atomic
    def update_instance(
        cls,
        instance,
        **validated_data,
    ):
        for field, value in validated_data.items():
            setattr(
                instance,
                field,
                value,
            )

        instance.save(
            update_fields=list(validated_data.keys()),
        )

        cls.after_update(instance)

        return instance

    # ------------------------------------------------------------------
    # Delete
    # ------------------------------------------------------------------

    @classmethod
    @transaction.atomic
    def delete_instance(
        cls,
        instance,
    ):
        cls.before_delete(instance)

        instance.delete()

        cls.after_delete(instance)

    # ------------------------------------------------------------------
    # Archive
    # ------------------------------------------------------------------

    @classmethod
    @transaction.atomic
    def archive_instance(
        cls,
        instance,
    ):
        instance.archive()

        cls.after_archive(instance)

        return instance

    # ------------------------------------------------------------------
    # Restore
    # ------------------------------------------------------------------

    @classmethod
    @transaction.atomic
    def restore_instance(
        cls,
        instance,
    ):
        instance.restore()

        cls.after_restore(instance)

        return instance

    # ------------------------------------------------------------------
    # Bulk
    # ------------------------------------------------------------------

    @classmethod
    @transaction.atomic
    def bulk_create(
        cls,
        objects,
    ):
        return cls.model.objects.bulk_create(
            objects,
        )

    @classmethod
    @transaction.atomic
    def bulk_update(
        cls,
        objects,
        fields,
    ):
        return cls.model.objects.bulk_update(
            objects,
            fields,
        )

    # ------------------------------------------------------------------
    # Hooks
    # ------------------------------------------------------------------

    @classmethod
    def before_delete(cls, instance):
        """
        Override in subclasses.
        """
        return None

    @classmethod
    def after_create(cls, instance):
        """
        Override in subclasses.
        """
        return None

    @classmethod
    def after_update(cls, instance):
        """
        Override in subclasses.
        """
        return None

    @classmethod
    def after_delete(cls, instance):
        """
        Override in subclasses.
        """
        return None

    @classmethod
    def after_archive(cls, instance):
        """
        Override in subclasses.
        """
        return None

    @classmethod
    def after_restore(cls, instance):
        """
        Override in subclasses.
        """
        return None
