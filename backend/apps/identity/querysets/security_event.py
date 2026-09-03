from apps.identity.querysets.base import IdentityQuerySet


class SecurityEventQuerySet(IdentityQuerySet):

    def for_user(self, user):
        return self.filter(user=user)

    def by_type(self, event_type):
        return self.filter(event_type=event_type)

    def by_event_type(self, event_type):
        return self.filter(event_type=event_type)

    def recent(self):
        return self.order_by("-occurred_at")

    def ip_address(self, ip_address):
        return self.filter(ip_address=ip_address)

    def select_related_all(self):
        return self.select_related("user")

    # ------------------------------------------------------------------
    # Selector-style helpers
    # ------------------------------------------------------------------

    def list_security_events(
        self,
        limit=None,
        offset=None,
        user_id=None,
        event_type=None,
        start_date=None,
        end_date=None,
        order_by=None,
    ):
        queryset = self.all()

        if user_id is not None:
            queryset = queryset.filter(user_id=user_id)

        if event_type is not None:
            queryset = queryset.filter(event_type=event_type)

        if start_date is not None:
            queryset = queryset.filter(occurred_at__gte=start_date)

        if end_date is not None:
            queryset = queryset.filter(occurred_at__lte=end_date)

        queryset = queryset.order_by(order_by) if order_by else queryset.order_by("-occurred_at")

        if offset:
            queryset = queryset[offset:]

        if limit:
            queryset = queryset[:limit]

        return queryset

    def count_security_events(self):
        return self.count()

    def get_security_event_with_user(self, id):
        return (
            self.filter(pk=id)
            .select_related("user")
            .first()
        )
