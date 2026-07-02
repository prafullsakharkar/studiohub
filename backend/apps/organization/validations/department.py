from django.core.exceptions import ValidationError


def validate_department_parent(instance):
    """
    Prevent cyclic department hierarchies.
    """

    parent = instance.parent

    while parent:
        if parent == instance:
            raise ValidationError("Department hierarchy cannot contain cycles.")

        parent = parent.parent
