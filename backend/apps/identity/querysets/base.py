from apps.core.choices.record import RecordStatus
from apps.core.models.querysets.base import BaseQuerySet


class IdentityQuerySet(BaseQuerySet):
    """
    Base QuerySet for all Identity models.
    """

    def active(self):
        if not hasattr(self.model, "status"):
            return self

        return self.filter(
            status=RecordStatus.ACTIVE,
        )

    def inactive(self):
        if not hasattr(self.model, "status"):
            return self

        return self.filter(
            status=RecordStatus.INACTIVE,
        )

    def system(self):
        """
        Return system-defined records.
        """
        if hasattr(self.model, "is_system"):
            return self.filter(is_system=True)
        return self.none()

    def custom(self):
        """
        Return user-defined records.
        """
        if hasattr(self.model, "is_system"):
            return self.filter(is_system=False)
        return self.none()

    def by_name(self, name: str):
        """
        Filter by name.
        """
        if hasattr(self.model, "name"):
            return self.filter(name__icontains=name)
        return self.none()

    def by_code(self, code: str):
        """
        Filter by code.
        """
        if hasattr(self.model, "code"):
            return self.filter(code=code)
        return self.none()

    def search(self, term: str):
        """
        Generic search.
        """
        if hasattr(self.model, "name"):
            return self.filter(name__icontains=term)
        return self

    def get_by_id(self, id):
        """
        Get a single record by primary key.
        """
        return self.filter(pk=id).first()

    def count_all(self):
        """
        Count all records.
        """
        return self.count()
