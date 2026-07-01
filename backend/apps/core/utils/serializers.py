"""
Serializer helpers.
"""


def get_serializer_fields(serializer):
    return list(serializer.fields.keys())
