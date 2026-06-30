class MetadataSerializerMixin:
    """
    Shared metadata validation.
    """

    def validate_metadata(self, value):
        return value or {}
