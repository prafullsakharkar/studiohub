"""
Deliveries admin module.
"""

from .delivery import (
    DeliveryCounterAdmin,
    DeliveryDestinationAdmin,
    DeliveryItemFileAdmin,
    DeliveryPackageAdmin,
    DeliveryQCCheckAdmin,
    DeliveryStatusChangeAdmin,
    DeliveryVersionRefAdmin,
)

__all__ = [
    "DeliveryCounterAdmin",
    "DeliveryDestinationAdmin",
    "DeliveryItemFileAdmin",
    "DeliveryPackageAdmin",
    "DeliveryQCCheckAdmin",
    "DeliveryStatusChangeAdmin",
    "DeliveryVersionRefAdmin",
]
