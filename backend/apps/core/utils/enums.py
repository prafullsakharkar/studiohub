"""
Enum helper functions.
"""


def choices(enum_cls):
    """
    Return choices for Django enums.
    """
    return enum_cls.choices


def values(enum_cls):
    """
    Return enum values.
    """
    return [member.value for member in enum_cls]


def labels(enum_cls):
    """
    Return enum labels.
    """
    return [member.label for member in enum_cls]
