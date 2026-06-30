class AuditSerializerMixin:
    """
    Automatically populate audit fields.
    """

    def create(self, validated_data):
        user = self.user

        if user and user.is_authenticated:
            validated_data.setdefault("created_by", user)
            validated_data.setdefault("updated_by", user)

        return super().create(validated_data)

    def update(self, instance, validated_data):
        user = self.user

        if user and user.is_authenticated:
            validated_data["updated_by"] = user

        return super().update(instance, validated_data)
