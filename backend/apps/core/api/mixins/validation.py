class ValidationMixin:
    """
    Common validation hooks.
    """

    def validate(self, attrs):
        attrs = super().validate(attrs)

        return attrs
