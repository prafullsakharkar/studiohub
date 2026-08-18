from datetime import timedelta

from django.db.models import Q
from django.utils import timezone

from apps.identity.querysets.base import (
    IdentityQuerySet,
)


class LoginAttemptQuerySet(
    IdentityQuerySet,
):

    def successful(self):
        return self.filter(
            success=True,
        )

    def failed(self):
        return self.filter(
            success=False,
        )

    def for_username(
        self,
        username,
    ):
        return self.filter(
            username=username,
        )

    def for_user(
        self,
        user,
    ):
        return self.filter(
            user=user,
        )

    def by_reason(
        self,
        reason,
    ):
        return self.filter(
            reason=reason,
        )

    def ip_address(
        self,
        ip_address,
    ):
        return self.filter(
            ip_address=ip_address,
        )

    def recent(
        self,
        minutes=None,
    ):
        queryset = self

        if minutes is not None:
            queryset = queryset.filter(
                attempted_at__gte=timezone.now() - timedelta(minutes=minutes),
            )

        return queryset

    def expired(
        self,
    ):
        return self.filter(
            locked_until__lte=timezone.now(),
        )

    # ------------------------------------------------------------------
    # Selector-style helpers
    # ------------------------------------------------------------------

    def list_login_attempts(
        self,
        limit=None,
        offset=None,
        user_id=None,
        success=None,
        start_date=None,
        end_date=None,
        order_by=None,
    ):
        queryset = self.all()

        if user_id is not None:
            queryset = queryset.filter(user_id=user_id)

        if success is not None:
            queryset = queryset.filter(success=success)

        if start_date is not None:
            queryset = queryset.filter(attempted_at__gte=start_date)

        if end_date is not None:
            queryset = queryset.filter(attempted_at__lte=end_date)

        if order_by:
            queryset = queryset.order_by(order_by)
        else:
            queryset = queryset.order_by("-attempted_at")

        if offset:
            queryset = queryset[offset:]

        if limit:
            queryset = queryset[:limit]

        return queryset

    def count_login_attempts(
        self,
    ):
        return self.count()

    def get_login_attempt_with_user(
        self,
        id,
    ):
        return (
            self.filter(pk=id)
            .select_related("user")
            .first()
        )

    def search(
        self,
        term,
    ):
        return self.filter(
            Q(username__icontains=term)
            | Q(ip_address__icontains=term)
        )
