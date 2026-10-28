"""
Separation of duties (docs/deliveries/CONTRACTS.md DOM-DLV-07, SEC-DLV-03, decision Q28).

Nobody signs off a delivery they prepared. "Prepared" is read from facts later edits cannot
rewrite: the history row of the delivery's creation, the history rows that moved it into Prepared
(a reopen from Signed Off does not count: that is the signer undoing their own step), and the
``added_by`` of each current item. The ``created_by`` column is read too, so a delivery that
predates the history is held to the stricter of the two.

Known limit: the person who added an item that was later removed is no longer known (the item row
is gone); the history and the audit log still record the removal.
"""

from __future__ import annotations

from typing import Any

from apps.deliveries.constants import workflow as wf
from apps.deliveries.models import DeliveryPackage, DeliveryStatusChange, DeliveryVersionRef


def preparer_ids(package: DeliveryPackage) -> set[str]:
    """The ids of the users who prepared ``package``."""
    ids: set[Any] = set()
    ids.add(package.created_by_id)  # pyright: ignore[reportAttributeAccessIssue]
    history = DeliveryStatusChange.objects.filter(delivery=package, actor__isnull=False)
    ids.update(history.filter(from_status="").values_list("actor_id", flat=True))
    ids.update(
        history.filter(to_status=wf.PREPARED)
        .exclude(from_status=wf.SIGNED_OFF)
        .values_list("actor_id", flat=True)
    )
    ids.update(
        DeliveryVersionRef.objects.filter(delivery=package, added_by__isnull=False).values_list(
            "added_by_id", flat=True
        )
    )
    return {str(pk) for pk in ids if pk is not None}


def prepared_by(package: DeliveryPackage, user: Any) -> bool:
    """Whether ``user`` is among those who prepared ``package``."""
    pk = getattr(user, "pk", None)
    return pk is not None and str(pk) in preparer_ids(package)
