
from apps.core.api.serializers.base import BaseWriteSerializer
from apps.organization.models import Person


class PersonCreateSerializer(BaseWriteSerializer):
    class Meta:
        model = Person
        fields = ("name", "email", "phone", "date_of_birth", "nationality", "description")
